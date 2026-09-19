# Essentia Todo List

App web de gerenciamento de tarefas (to-do list) para os funcionários da Essentia organizarem o dia a dia.

> Desafio técnico Essentia Technologies (Menatech): CRUD de tarefas com **Angular** no front,
> API RESTful **Node.js + TypeScript (Fastify)** no back e **MySQL** como fonte da verdade —
> com extras opcionais (auth **JWT**, histórico em **MongoDB**).

## Stack e porquê

| Peça | Escolha | Porquê |
| --- | --- | --- |
| API | Fastify 5 | Schemas JSON de validação por rota, erro padronizado, Ajv estrito (`coerceTypes: false`, sem `removeAdditional` silencioso) |
| Schemas | TypeBox | Contratos TypeScript-first compartilhados entre validação Fastify, tipos do domínio e o OpenAPI do Swagger |
| ORM | TypeORM | Entidades + migrations versionadas (`migrationsRun: true` — schema roda no boot, zero passo manual) |
| Fonte da verdade | MySQL 8 | CRUD relacional com escopo por usuário (`userId`) |
| Histórico | MongoDB 7 | Log de atividades append-only, isolado do relacional (degrada sem derrubar o CRUD) |
| Front | Angular 22 (signals) | Estado reativo com `signal`/`computed` nos stores (`task-store`, `auth-store`), sem NgRx para este escopo |
| Estilo | Tailwind v4 via PostCSS | `@tailwindcss/postcss` + `@import "tailwindcss"` em `styles.css` |
| Proxy prod | Caddy | Uma porta pública (:80): SPA estática + `reverse_proxy` de `/api/*` e `/health` para `backend:3000` |
| Segurança | helmet + rate-limit | Headers de segurança no app todo; limite de 5 req/min por IP nos POSTs de auth (brute-force) |
| Docs da API | @fastify/swagger + Swagger UI | OpenAPI gerado dos schemas TypeBox — UI em `/api/docs`, JSON em `/api/docs/json` |
| Lint/format | Biome | `biome.json` na raiz; `npx biome check .` limpo, lint dos apps também no CI |
| Testes | Vitest + Stryker | Unit + e2e no back, unit/component no front; mutation testing escopado aos services de domínio |

## Arquitetura

```
browser → Caddy :80 ─┬─ /api/*, /health ─→ backend:3000 (Fastify: helmet · rate-limit · jwt · swagger)
                      └─ demais rotas ───→ SPA Angular (try_files → /index.html)
backend → MySQL 8 (users, tasks) · MongoDB 7 (activity_log, opcional/degradável)
```

- **Camadas (back):** `controller` (HTTP + TypeBox) → `service` (regras: escopo por dono, posição, eventos) → `repository` (TypeORM/Mongo) → `entity`. As dependências apontam para dentro (ports definidos onde são consumidos) — SOLID sem ceremonia: interfaces `ITaskRepository`/`IUserRepository`/`IActivityRepository` com implementações TypeORM/Mongo/in-memory.
- **DI por composition root** (`backend/src/container.ts`): factories `createTaskService` / `createAuthService` / `createActivityRepository` injetadas no `registerModules`; `overrides` existem para testes (ex.: service fake no e2e de edge).
- **Migrations** (`backend/src/database/mysql.data-source.ts`): `migrationsRun: true`, `synchronize: false`.
- **Front:** `pages` → `components` → `stores` (signals) → `api services` (`/api/*` relativo; dev usa `proxy.conf.json` → `http://localhost:3000`, prod resolve no próprio host via Caddy).

## Pré-requisitos

- **Docker** (engine + compose v2) — para bancos e para o quickstart completo.
- **Node 24.15** via nvm: `nvm use` (o `.nvmrc` trava `24.15.0`) — só para dev local/testes; o compose não precisa de Node no host.
- **Portas livres:** `80` (frontend/Caddy), `3306` (MySQL), `27017` (Mongo).

## Quickstart (Docker — caminho principal)

```bash
cp .env.example .env          # ajuste JWT_SECRET se quiser (32+ chars)
docker compose up --build
```

- O compose exige `JWT_SECRET` **fail-fast** (`${JWT_SECRET:?...}` — sem a var, o `up` nem sobe). O `.env` da raiz é lido automaticamente pelo compose; `openssl rand -base64 32` gera um segredo de verdade.
- Dois `.env.example` de propósito: o da **raiz** documenta só o `JWT_SECRET` que o compose lê; o de `backend/` cobre o dev local/e2e (`DB_*`, Mongo, JWT).
- Aguarde os healthchecks (MySQL → Mongo → backend → frontend). Abra **http://localhost** — o Caddy serve a SPA e proxya a API.
- No compose o backend roda com `NODE_ENV=production` e o **seed demo não roda em produção** (gated em `backend/src/seed.ts`). Para popular o usuário demo, rode da raiz do repo (o seed roda no host, em modo dev, contra o MySQL exposto em `:3306`):

```bash
npm run seed --prefix backend
```

- Credenciais demo: **`demo@essentia.com` / `demo1234`** (+ 5 tarefas de exemplo). Idempotente: segunda execução não duplica (usuário por `findByEmail`, tarefas só se a tabela estiver vazia).
- Cheque a API pelo próprio host:

```bash
curl http://localhost/health
# {"status":"ok","db":"up"}
```

> Nota: o backend expõe `/health` (sem prefixo `/api`); o Caddy proxya tanto `/health` quanto `/api/*` para `backend:3000`.

## Desenvolvimento local (fallback sem compose full)

```bash
npm run setup                                  # install de backend/ + frontend/
docker compose up -d mysql mongo               # só os bancos (healthchecks inclusos; o init.sql cria todo_dev + todo_test)
cp backend/.env.example backend/.env           # ajuste se precisar (DB_* localhost, JWT local)
```

Em um terminal (API em `:3000`):

```bash
npm run dev --prefix backend
```

> **`JWT_SECRET` obrigatória em QUALQUER ambiente (hardening-03):** sem fallback dev — o boot falha sem ela. Exporte a var (`export JWT_SECRET=$(openssl rand -base64 32)`) ou deixe o `backend/.env` carregá-la: os scripts `dev` e `seed` usam `--env-file-if-exists=.env` (Node 24) e leem o `.env` quando ele existir.

Em outro (SPA com proxy `/api` → `http://localhost:3000`):

```bash
npm start --prefix frontend
```

- Front dev: `ng serve --proxy-config proxy.conf.json` (ver `frontend/proxy.conf.json`).
- `npm run setup` é o **único** script da raiz (além do smoke `test:compose`) — todo o resto vive em `backend/` ou `frontend/`.
- **Rede/auth dos bancos (hardening):** MySQL e Mongo publicam **só em `127.0.0.1`** (`127.0.0.1:3306` / `127.0.0.1:27017` — LAN e `::1` recebem recusa). O Mongo **exige auth**: usuário app `todo` criado por `docker/db/mongo-init.js` (`readWrite` em `todo_activity` + `todo_activity_test`, `authSource=admin`); os defaults de dev (`todo`/`todo`, root `root`) são sobrescritíveis por env (`MYSQL_*`, `MONGO_*` — ver `.env.example` da raiz).
- **Atenção a volume legado:** `MONGO_INITDB_*` e os scripts de `docker-entrypoint-initdb.d` **não reaplicam** em volume já existente (só rodam com datadir vazio). Se seu `mongo_data` é anterior ao auth, rode `docker compose down -v` e suba de novo (apaga dados dev; rode o seed depois). Verificação manual:

```bash
# anônimo → esperado falhar:
docker exec essentia-todo-list-mongo mongosh --quiet todo_activity --eval 'db.tasks.findOne()'
# MongoServerError: command requires authentication
# com credenciais → funciona:
docker exec essentia-todo-list-mongo mongosh --quiet \
  'mongodb://todo:todo@localhost:27017/todo_activity?authSource=admin' \
  --eval 'db.getCollectionNames().length'
```

### Sem Docker nenhum (bancos instalados na máquina)

Se nem Docker você tem, instale MySQL 8 e MongoDB 7 localmente, crie os bancos `todo_dev`/`todo_test` com permissão para o usuário `todo` (o `docker/db/init.sql` é a referência dos grants) e aponte o `backend/.env` para `localhost`. O resto do fluxo é idêntico ao fallback acima.

## Endpoints

Base no compose: `http://localhost` (Caddy). Dev local: API em `http://localhost:3000`, front com proxy `/api`.

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | não¹ | Cria usuário → `201 { id, name, email, createdAt }` (senha com bcrypt, nunca retornada) |
| `POST` | `/api/auth/login` | não¹ | Credenciais → `200 { token }` (JWT `sub` = userId, exp `12h`) |
| `GET` | `/api/tasks` | sim | Lista do dono, ordem de `position` |
| `GET` | `/api/tasks/:id` | sim | Detalhe do dono (`404` cross-user) |
| `POST` | `/api/tasks` | sim | Cria (`position` = MAX+1 do dono, input ignorado; `completed?` default `false`, `completed:true` nasce em Concluídas) → `201` |
| `PATCH` | `/api/tasks/reorder` | sim | Reordena (`{ ids: [...] }`, `position` = índice 0-based) — declarada **antes** de `/:id` |
| `PATCH` | `/api/tasks/:id` | sim | Atualiza parcial (título/descrição/completed/`position`) |
| `DELETE` | `/api/tasks/:id` | sim | Remove → `204` |
| `GET` | `/api/tasks/:id/history` | sim | Histórico da tarefa (dono validado primeiro) |
| `GET` | `/api/activity` | sim | Feed global do usuário |
| `GET` | `/api/docs` | não | Swagger UI (OpenAPI gerado dos schemas TypeBox) |
| `GET` | `/api/docs/json` | não | Documento OpenAPI 3.x |
| `GET` | `/health` | não | Liveness + MySQL (`200 {status:"ok",db:"up"}` ou `503 DB_UNAVAILABLE`) |

¹ **Rate limit:** POSTs de auth aceitam **5 requisições/min por IP** (`RATE_LIMIT_MAX`, janela `RATE_LIMIT_WINDOW`); a 6ª recebe `429 { code: "RATE_LIMITED" }`. IPs na `RATE_LIMIT_ALLOWLIST` (csv) passam livre — em `NODE_ENV=test` o default é `127.0.0.1`.

```bash
BASE=http://localhost
curl -s -X POST $BASE/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Demo","email":"voce@example.com","password":"demo1234"}'
curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"voce@example.com","password":"demo1234"}'
# {"token":"<JWT>"}
TOKEN=<cole o token>
curl -s $BASE/api/tasks -H "Authorization: Bearer $TOKEN"
curl -s -X POST $BASE/api/tasks -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Estudar README","description":"Ler com calma"}'
curl -s -X POST $BASE/api/tasks -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Já feita","completed":true}'
curl -s -X PATCH $BASE/api/tasks/1 -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"completed":true}'
curl -s -X PATCH $BASE/api/tasks/reorder -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"ids":[2,1]}'
curl -s $BASE/api/tasks/1/history -H "Authorization: Bearer $TOKEN"
curl -s $BASE/api/activity -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE $BASE/api/tasks/1 -H "Authorization: Bearer $TOKEN" -i
curl -s $BASE/health
```

- **Erros:** envelope `{ code, message, details? }` — validação TypeBox/Ajv → `400 VALIDATION_ERROR` (com `details` por campo; email com mensagem amigável pt-BR); outros 4xx do Fastify (JSON malformado, etc.) → `400 BAD_REQUEST`; sem token/inválido → `401 UNAUTHORIZED` (`Token ausente ou inválido`); tarefa de outro usuário/inexistente → `404 TASK_NOT_FOUND` (sem vazar existência alheia); email duplicado (incluindo condição de corrida via `ER_DUP_ENTRY`/1062) → `409 EMAIL_CONFLICT`; rate limit → `429 RATE_LIMITED`; rota inexistente → `404 NOT_FOUND`; resto → `500 INTERNAL_ERROR`.
- **`position`:** inteiro ≥ 0; só-`position` no PATCH não gera evento de histórico (ver seção seguinte).

## Autenticação e segurança

- **JWT HS256** (`@fastify/jwt`), `sub` = userId, exp padrão `12h` (`JWT_EXPIRES_IN`); guard `requireAuth` nas rotas de tasks/activity/history; **login em tempo constante** para emails desconhecidos (mesma verificação bcrypt mesmo sem usuário).
- **bcrypt** (cost 10) para senhas; senha nunca sai da API.
- **helmet** em todas as respostas (CSP desligada só para o Swagger UI embutido funcionar).
- **Rate limit** escopado: `global: false` — só os POSTs de auth pagam o tributo; CRUD autenticado não é afetado.
- **Seed demo gated:** `runSeed` retorna cedo em `NODE_ENV=production` (o compose não popula dados demo sem comando explícito).

## Histórico / activity

- **5 ações** (`backend/src/modules/activity/activity-log.entity.ts`): `created`, `updated`, `completed`, `uncompleted`, `deleted`.
- **Escopo:** leitura sempre pelo `userId` do token — `GET /api/tasks/:id/history` valida o dono via `getById` escopado (cross-user → `404 TASK_NOT_FOUND`) e o feed `GET /api/activity` filtra por `userId`. DTO serializável (`ObjectId` → string, `changes` ausente → `null`).
- **Degradação sem Mongo (HIST-04):** se o Mongo cair no boot, o backend sobe com warn (`[main] mongo indisponível…`) e o CRUD MySQL segue; escrita de evento falha em silêncio e as rotas de leitura retornam `[]` com `200`.

## Testes

Números verificados em 2026-09-19 (todas as suítes executadas; e2e exige bancos no ar):

```bash
npm test --prefix backend                # unit (sem bancos)
npm run test:coverage --prefix backend   # unit + gate de cobertura (linhas ≥80, statements ≥80, branches ≥70)
npm run test:e2e --prefix backend        # e2e de API (com MySQL + Mongo no ar)
npm run test:mutation --prefix backend   # Stryker (unit only; lento ~ minutos)
npm test --prefix frontend -- --watch=false     # sem watch (CI usa igual)
npm run test:compose                     # smoke full docker na raiz (porta 80 livre)
```

| Suíte | Cwd / comando | Resultado |
| --- | --- | --- |
| Back unit | `backend/` — `npm test` (`vitest run test/unit`) | **62** passed (task.service + auth.service + schemas + repos) |
| Back e2e | `backend/` — `npm run test:e2e` (`vitest run test/e2e`) | **49** its (auth, rate-limit, health, docs, history, tasks) — **exige MySQL + Mongo no ar** (`DB_TEST_*`, `MONGO_TEST_URL`; ver `backend/.env.example` e `ci.yml`) |
| Back mutation | `backend/` — `npm run test:mutation` (Stryker) | Score **75.35%** (auth.service.ts 75.72%, task.service.ts 75.10% — por arquivo, gate 70) — artefato: 2026-09-19 via npm run test:mutation |
| Front | `frontend/` — `npm test -- --watch=false` | **71** passed |
| Smoke full docker | raiz — `npm run test:compose` | Sobe `up --build --wait`, valida health/register/login/duplicado/CRUD via Caddy :80 e derruba com `down -v` |

Pré-requisitos por suíte: unit roda sozinho; e2e precisa de `docker compose up -d mysql mongo` (o init.sql já cria `todo_test`) + `backend/.env`; mutation só usa unit (sem bancos); smoke exige a **porta 80 livre** (ele mesmo faz down do projeto ao sair).

## CI

Workflow **CI** (`.github/workflows/ci.yml`), três jobs no `push`/PR para `main` (`permissions: contents: read`):

- **`verify`**: Node via `.nvmrc`, `npm ci` nos 2 apps, então **typecheck (back+front) → lint (back+front, Biome) → audit (back+front, bloqueante: `npm audit --prefix <app> --omit=dev --audit-level=high`, sem `continue-on-error`) → cria `todo_test` → unit back → gate de cobertura back → build back → testes front → build front → e2e** com MySQL 8 + Mongo 7 como services (`DB_TEST_*`/`MONGO_TEST_URL` apontando para eles).
- **`mutation`** (após `verify`): `npm ci` do backend + `npm run test:mutation` (Stryker, thresholds high 80 / low 70 / break 70) com os mesmos services MySQL 8 + Mongo 7 do `verify`; o relatório em `backend/reports/mutation/` é publicado como artefato `mutation-report` (`if: always()`). Números por arquivo na tabela de Testes acima (escopo e gates definidos em T11).
- **`smoke`** (após `verify`): gera um `JWT_SECRET` descartável em `.env` e roda `npm run test:compose` — a stack full via Caddy :80 validada de ponta a ponta.
- **Deploy fora de escopo** (placeholder comentado no fim do `ci.yml`).

Gates que reprovam o `verify`: typecheck, lint, **audit (alta ou superior, só deps de prod)**, testes (sem `--passWithNoTests` — glob inexistente falha), **cobertura** (provider v8, `src/**/*.ts`, excluídos `src/main.ts`, `src/seed.ts`, `src/container.ts`, `src/database/migrations/**` e `src/**/*.data-source.ts`; `functions` sem gate) e build/e2e.

## Decisões técnicas

- **SOLID em camadas finas:** controllers só traduzem HTTP ⇄ schemas TypeBox; services concentram regras (escopo por dono, `position`, eventos de histórico); repositories escondem TypeORM/Mongo atrás de ports. O composition root (`container.ts`) amarra tudo — trocar implementação (ex.: repositório in-memory dos testes) não toca nos services.
- **TypeBox em vez de JSON Schema solto:** o mesmo objeto valida a rota no Fastify, tipa o domínio e alimenta o OpenAPI do Swagger — uma fonte de verdade só.
- **Extras JWT + MongoDB:** auth individual escopa cada tarefa ao dono (`userId`); o histórico vive no Mongo (polyglot persistence) com degradação graciosa — API de tarefas nunca depende do Mongo.
- **Caddy > Traefik:** 1 porta para o avaliador (`:80`), zero CORS em prod e um `Caddyfile` de ~15 linhas; Traefik traria labels/complexidade desnecessária para 2 serviços.
- **Rate limit escopado a auth:** o vetor de brute-force é o POST de login/registro; limitar globalmente puniria o CRUD legítimo. Allowlist por env mantém testes/e2e determinísticos.
- **`position` transacional:** reorder grava as novas posições em transação (`PATCH /api/tasks/reorder`), evitando estados intermediários visíveis.
- **Limitações conhecidas:**
  - JWT de 12h **sem refresh token** (logout = descarte local do token).
  - Lista sem paginação/busca server-side (filtro, busca e ordenação são client-side nos signals); endpoint preparado para `?page/limit` quando entrar.
  - Sem E2E de navegador (Cypress/Playwright) — cobertura é Vitest (unit/e2e de API no back, unit/component no front) + smoke HTTP do compose.
  - Sem i18n (UI e mensagens de API em pt-BR, `code` de erro estável em inglês).
  - Boot via compose leva ~30s+ por conta dos healthchecks encadeados (MySQL → Mongo → backend → frontend).
  - Concorrência de update é last-write-wins (sem versionamento otimista).

## Screenshots

| Lista de tarefas | Feed de atividades |
| --- | --- |
| ![Lista de tarefas do usuário demo](docs/screenshots/tasks-list.png) | ![Feed de atividades recentes](docs/screenshots/activity-feed.png) |

> Capturas reais do compose + seed demo (`demo@essentia.com`), logado na UI servida pelo Caddy.

## Histórico de commits

O repositório conta a evolução em fases (~60 commits, Conventional Commits):

1. **Bootstrap + MVP:** monorepo, compose MySQL, API Fastify com health/erros padronizados, domínio de tarefas (schemas → service → repository → CRUD + e2e), front Angular (store com signals, form, lista, filtros, estados de UI).
2. **Ordenação manual:** coluna `position`, reorder transacional e drag & drop na UI.
3. **Extras:** auth JWT (entity/endpoints/escopo por usuário, login/register na UI com guard e interceptor), histórico em MongoDB (eventos, histórico por tarefa, feed de atividades) e full docker prod-like com Caddy.
4. **CI + docs:** workflow de check e README inicial.
5. **Hardening/QA (~19 commits):** lint-clean com Biome, mensagens de erro de email em pt-BR, Swagger UI, helmet + rate-limit em auth, gates de typecheck/lint/audit no CI, smoke do compose, mutation testing com Stryker, login em tempo constante, seed gated em produção, reorder atômico e rebranding techx → essentia.
