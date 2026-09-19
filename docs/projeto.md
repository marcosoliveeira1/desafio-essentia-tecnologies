# Projeto — CI, decisões e evoluções

## CI

Workflow **CI** (`.github/workflows/ci.yml`), três jobs no `push`/PR para `main`
(`permissions: contents: read`):

- **`verify`**: Node via `.nvmrc`, `npm ci` nos 2 apps, então typecheck (back+front) →
  lint (back+front, Biome) → audit (back+front, bloqueante:
  `npm audit --prefix <app> --omit=dev --audit-level=high`) → cria `todo_test` →
  unit back → gate de cobertura back → build back → testes front → build front → e2e
  com MySQL 8 + Mongo 7 como services (`DB_TEST_*`/`MONGO_TEST_URL` apontando para eles).
- **`mutation`** (após `verify`): `npm ci` do backend + `npm run test:mutation` (Stryker,
  thresholds high 80 / low 70 / break 70) com os mesmos services; o relatório em
  `backend/reports/mutation/` é publicado como artefato `mutation-report` (`if: always()`).
- **`smoke`** (após `verify`): gera um `JWT_SECRET` descartável em `.env` e roda
  `npm run test:compose` — a stack full via Caddy :80 validada de ponta a ponta.
- **Deploy fora de escopo** (placeholder comentado no fim do `ci.yml`).

Gates que reprovam o `verify`: typecheck, lint, **audit (alta ou superior, só deps de prod)**,
testes (sem `--passWithNoTests`), **cobertura** (provider v8, `src/**/*.ts`, excluídos
`src/main.ts`, `src/seed.ts`, `src/container.ts`, `src/database/migrations/**` e
`src/**/*.data-source.ts`; `functions` sem gate) e build/e2e.

> Nota mutação: o gate por arquivo (≥ 70 em cada service) é verificado no artefato
> `backend/reports/mutation/mutation.json` (gitignored — evidência local regenerável;
> o CI publica como artefato `mutation-report`) — a chave `perFile` não existe no
> schema do Stryker v10 (só `high`/`low`/`break`, aqui 80/70/70).

Pré-requisitos por suíte: unit roda sozinho; e2e precisa de
`docker compose up -d mysql mongo` + `backend/.env` + `JWT_SECRET` exportado
(`JWT_SECRET=$(openssl rand -base64 32) npm run test:e2e --prefix backend`);
mutation só usa unit (sem bancos); smoke exige a **porta 80 livre**.

## Decisões técnicas

- **SOLID em camadas finas:** controllers traduzem HTTP ⇄ schemas TypeBox; services
  concentram regras (escopo por dono, `position`, eventos); repositories escondem
  TypeORM/Mongo atrás de ports. O composition root (`container.ts`) amarra tudo —
  trocar implementação (ex.: in-memory nos testes) não toca nos services.
- **TypeBox em vez de JSON Schema solto:** o mesmo objeto valida a rota no Fastify,
  tipa o domínio e alimenta o OpenAPI — uma fonte de verdade só.
- **Extras JWT + MongoDB:** auth escopa cada tarefa ao dono (`userId`); o histórico
  vive no Mongo (polyglot persistence) com degradação graciosa — a API de tarefas
  nunca depende do Mongo.
- **Caddy > Traefik:** 1 porta para o avaliador (`:80`), zero CORS em prod e um
  `Caddyfile` de ~15 linhas.
- **Rate limit escopado a auth:** o vetor de brute-force é o login/registro; limitar
  globalmente puniria o CRUD legítimo. Allowlist por env mantém testes determinísticos.
- **`position` transacional:** reorder grava as novas posições em transação,
  evitando estados intermediários visíveis.
- **Sem paginação por decisão:** é um app simples de uso individual — o volume por usuário
  cabe folgado em uma listagem única, então filtro, busca e ordenação ficam client-side
  (signals). Paginação keyset fica como evolução futura, quando houver caso de uso real.

## Limitações conhecidas

- JWT de 12h **sem refresh token** (logout = descarte local do token).
- Lista sem paginação/busca server-side (decisão consciente — ver acima).
- Sem E2E de navegador (Cypress/Playwright) — cobertura é Vitest + smoke HTTP do compose.
- Sem i18n (UI e mensagens em pt-BR, `code` de erro estável em inglês).
- Boot via compose leva ~30s+ (healthchecks encadeados MySQL → Mongo → backend → frontend).
- Concorrência de update é last-write-wins (sem versionamento otimista).

## Trade-offs conscientes (demo, sem TLS em localhost)

- HTTP puro sem TLS — compose demo localhost-only (`:80`); em produção, terminar TLS no edge.
- JWT em `localStorage` — aceitável para o escopo; o endurecimento seria cookie `HttpOnly` + refresh token.
- Registro retorna `409 EMAIL_CONFLICT` para email duplicado — permite enumeração de emails;
  trocado por UX do desafio (o login segue genérico `401`).

## Evoluções futuras (fora de escopo)

- Paginação keyset no `GET /api/tasks` (+ envelope `{data, meta}`).
- TTL de logs no Mongo (`expireAfterSeconds` em `occurredAt`).
- Refresh token com cookie `HttpOnly` (+ revogação).
- `/metrics` + split liveness/readiness.
- Versionamento otimista (ETag/coluna `version`).
- Drag por teclado + a11y completa (focus trap, ARIA live).
- Trivy/SBOM/CodeQL no CI.
