# API — detalhes

Base no compose: `http://localhost` (Caddy). Dev local: API em `http://localhost:3000`, front com proxy `/api`.

## Erros

Envelope `{ code, message, details? }`:

- Validação TypeBox/Ajv → `400 VALIDATION_ERROR` (com `details` por campo; email com mensagem amigável pt-BR).
- Outros 4xx do Fastify (JSON malformado, etc.) → `400 BAD_REQUEST`.
- Sem token/inválido → `401 UNAUTHORIZED` (`Token ausente ou inválido`).
- Tarefa de outro usuário/inexistente → `404 TASK_NOT_FOUND` (sem vazar existência alheia).
- Email duplicado (incluindo condição de corrida via `ER_DUP_ENTRY`/1062) → `409 EMAIL_CONFLICT`.
- Rate limit → `429 RATE_LIMITED`.
- Rota inexistente → `404 NOT_FOUND`; resto → `500 INTERNAL_ERROR`.

**`position`:** inteiro ≥ 0; só-`position` no PATCH não gera evento de histórico.

## Exemplos

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

## Histórico / activity

5 ações (`backend/src/modules/activity/activity-log.entity.ts`):
`created`, `updated`, `completed`, `uncompleted`, `deleted`.

- **Escopo:** leitura sempre pelo `userId` do token — `GET /api/tasks/:id/history` valida
  o dono via `getById` escopado (cross-user → `404 TASK_NOT_FOUND`) e o feed
  `GET /api/activity` filtra por `userId`. DTO serializável (`ObjectId` → string,
  `changes` ausente → `null`).
- **Degradação sem Mongo:** se o Mongo cair no boot, o backend sobe com warn
  (`[main] mongo indisponível…`) e o CRUD MySQL segue; escrita de evento falha em
  silêncio e as rotas de leitura retornam `[]` com `200`.

## Segurança

- **JWT HS256** (`@fastify/jwt`), `sub` = userId, exp padrão `12h` (`JWT_EXPIRES_IN`);
  guard `requireAuth` nas rotas de tasks/activity/history;
  **login em tempo constante** para emails desconhecidos.
- **bcrypt** (cost 10); senha nunca sai da API.
- **helmet** com **CSP ativa** em todas as respostas (isenção só no Swagger UI `/api/docs`);
  `/api/docs` retorna `404` em production sem `SWAGGER_ENABLED=true`.
- **Rate limit escopado:** `global: false` — só os POSTs de auth (5 req/min por IP,
  `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW`; a 6ª recebe `429`). CRUD autenticado não é afetado.
  IPs na `RATE_LIMIT_ALLOWLIST` (csv) passam livre — em `NODE_ENV=test` o default é `127.0.0.1`.
- **Seed demo gated:** `runSeed` retorna cedo em `NODE_ENV=production`.
