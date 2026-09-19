# Essentia Todo List

App web de gerenciamento de tarefas (to-do list) para os funcionários da Essentia organizarem o dia a dia.

> Desafio técnico Essentia Technologies (Menatech): CRUD de tarefas com **Angular** no front,
> API RESTful **Node.js + TypeScript (Fastify)** no back e **MySQL** como fonte da verdade —
> com extras opcionais (auth **JWT**, histórico em **MongoDB**).

## Stack e porquê

| Peça | Escolha | Porquê |
| --- | --- | --- |
| API | Fastify 5 | Schemas JSON de validação por rota, erro padronizado |
| Schemas | TypeBox | Um contrato só: valida no Fastify, tipa o domínio e gera o OpenAPI |
| ORM | TypeORM | Entidades + migrations versionadas (schema roda no boot, zero passo manual) |
| Fonte da verdade | MySQL 8 | CRUD relacional com escopo por usuário |
| Histórico | MongoDB 7 | Log append-only isolado (cai sem derrubar o CRUD) |
| Front | Angular 22 (signals) | Estado reativo sem NgRx para este escopo |
| Proxy prod | Caddy | Uma porta pública (:80): SPA + `/api/*` e `/health` |
| Docs da API | Swagger UI | OpenAPI gerado dos schemas — `/api/docs` |
| Testes | Vitest + Stryker | Unit + e2e no back, unit/component no front, mutation nos services |

## Arquitetura

```
browser → Caddy :80 ─┬─ /api/*, /health ─→ backend:3000 (Fastify)
                      └─ demais rotas ───→ SPA Angular
backend → MySQL 8 (users, tasks) · MongoDB 7 (activity_log, degradável)
```

- **Back:** `controller` (HTTP + TypeBox) → `service` (regras: dono, posição, eventos) → `repository` (TypeORM/Mongo) → `entity`. Composition root em `backend/src/container.ts` (overrides para testes).
- **Front:** `pages` → `components` → `stores` (signals) → `api services` (`/api/*` relativo; dev usa `proxy.conf.json`).
- Detalhes de segurança, erros e histórico: [docs/api-detalhes.md](docs/api-detalhes.md).

## Pré-requisitos

- **Docker** (engine + compose v2).
- **Node 24.15** via nvm: `nvm use` — só para dev local/testes; o compose não precisa de Node no host.
- **Portas livres:** `80`, `3306`, `27017`.

## Quickstart (Docker — caminho principal)

```bash
npm run up:dev             # stack + seed demo (demo@essentia.com/demo1234) + logs -f
# npm run up              # stack prod-like pura, sem seed
# npm run up:dev:d / up:d # variantes detached
```

- Aguarda os healthchecks (MySQL → Mongo → backend → frontend). Abra **http://localhost**.
- O compose exige `JWT_SECRET` fail-fast (o script `up` gera via `openssl` se faltar; ver `.env.example`).
- Credenciais demo: **`demo@essentia.com` / `demo1234`** (+ 5 tarefas). Seed idempotente.
- Cheque a API:

```bash
curl http://localhost/health
# {"status":"ok","db":"up"}
```

> Desenvolvimento sem compose full (só bancos no Docker, bancos locais, vars de ambiente):
> [docs/desenvolvimento.md](docs/desenvolvimento.md).

## Endpoints

Base no compose: `http://localhost`. Dev local: API em `http://localhost:3000`.

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | não | Cria usuário → `201` (senha com bcrypt, nunca retornada) |
| `POST` | `/api/auth/login` | não | Credenciais → `200 { token }` (JWT, exp `12h`; 5 req/min por IP) |
| `GET` | `/api/tasks` | sim | Lista do dono, ordem de `position` |
| `GET` | `/api/tasks/:id` | sim | Detalhe do dono (`404` cross-user) |
| `POST` | `/api/tasks` | sim | Cria (`position` = MAX+1, `completed?` default `false`) → `201` |
| `PATCH` | `/api/tasks/reorder` | sim | Reordena (`{ ids: [...] }`, transacional) |
| `PATCH` | `/api/tasks/:id` | sim | Atualiza parcial |
| `DELETE` | `/api/tasks/:id` | sim | Remove → `204` |
| `GET` | `/api/tasks/:id/history` | sim | Histórico da tarefa |
| `GET` | `/api/activity` | sim | Feed global do usuário |
| `GET` | `/api/docs` | não | Swagger UI |
| `GET` | `/health` | não | Liveness + MySQL |

Erros no envelope `{ code, message, details? }`, exemplos curl e regras de segurança:
[docs/api-detalhes.md](docs/api-detalhes.md).

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@essentia.com","password":"demo1234"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s http://localhost/api/tasks -H "Authorization: Bearer $TOKEN"
```

## Testes

```bash
npm test --prefix backend                # unit (sem bancos)
npm run test:e2e --prefix backend        # e2e de API (com MySQL + Mongo no ar)
npm run test:mutation --prefix backend   # Stryker (lento ~ minutos)
npm test --prefix frontend -- --watch=false
npm run test:compose                     # smoke full docker (porta 80 livre)
```

| Suíte | Resultado |
| --- | --- |
| Back unit (`vitest run test/unit`) | **127** passed |
| Back e2e (`vitest run test/e2e`, 8 arquivos) | **60** its — exige bancos no ar + `JWT_SECRET` 32+ chars |
| Back mutation (Stryker) | **75.35%** (gate 70 por service) |
| Front (14 arquivos) | **123** passed |
| Smoke compose | Health/register/login/CRUD via Caddy :80 |

Números verificados em 2026-09-19. Pré-requisitos por suíte e gates de cobertura:
[docs/projeto.md](docs/projeto.md).

## CI

Workflow **CI** (`.github/workflows/ci.yml`), jobs `verify` → `mutation` → `smoke` no `push`/PR para `main`:
typecheck + lint + audit (bloqueante em alta) + unit + cobertura + build + e2e, mutation com
artefato `mutation-report` e smoke full via Caddy. Detalhe dos gates: [docs/projeto.md](docs/projeto.md).

## Decisões e limitações

- TypeBox como fonte única (validação + tipos + OpenAPI); repositories atrás de ports (troca sem tocar services).
- Histórico no Mongo com degradação graciosa; rate limit só em auth (não pune o CRUD).
- Limitações: JWT sem refresh, sem paginação server-side (decisão — app simples, filtro client-side), sem E2E de navegador, sem i18n, boot ~30s+ (healthchecks), update last-write-wins.
- Trade-offs e evoluções futuras: [docs/projeto.md](docs/projeto.md).

## Screenshots

| Lista de tarefas | Feed de atividades |
| --- | --- |
| ![Lista de tarefas do usuário demo](docs/screenshots/tasks-list.png) | ![Feed de atividades recentes](docs/screenshots/activity-feed.png) |

> Capturas reais do compose + seed demo, logado na UI servida pelo Caddy.

## Histórico de commits

Evolução em fases (Conventional Commits): bootstrap + MVP (API, domínio, front) →
ordenação manual (`position`, reorder, drag & drop) → extras (JWT, Mongo, Caddy) → CI + docs → QA
(lint Biome, Swagger, helmet + rate-limit, gates, smoke, mutation, CSP, indexes).
