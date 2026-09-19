# Desenvolvimento local

Fallback sem o compose full. O caminho principal (Docker) está no README.

```bash
npm run setup                                  # install de backend/ + frontend/
docker compose up -d mysql mongo               # só os bancos (o init.sql cria todo_dev + todo_test)
cp backend/.env.example backend/.env           # ajuste se precisar (DB_* localhost, JWT local)
```

Em um terminal (API em `:3000`):

```bash
npm run dev --prefix backend
```

> **`JWT_SECRET` obrigatória em qualquer ambiente:** sem fallback dev — o boot falha sem ela.
> Exporte a var (`export JWT_SECRET=$(openssl rand -base64 32)`) ou deixe o `backend/.env`
> carregá-la: os scripts `dev` e `seed` usam `--env-file-if-exists=.env` (Node 24).

Em outro (SPA com proxy `/api` → `http://localhost:3000`):

```bash
npm start --prefix frontend
```

- Front dev: `ng serve --proxy-config proxy.conf.json` (ver `frontend/proxy.conf.json`).
- `npm run setup` é o único script da raiz (além do smoke `test:compose`) — o resto vive em `backend/` ou `frontend/`.

## Rede e auth dos bancos

MySQL e Mongo publicam **só em `127.0.0.1`** (`127.0.0.1:3306` / `127.0.0.1:27017`).
O Mongo **exige auth**: usuário app `todo` criado por `docker/db/mongo-init.js`
(`readWrite` em `todo_activity` + `todo_activity_test`, `authSource=admin`).
Os defaults de dev (`todo`/`todo`, root `root`) são sobrescritíveis por env
(`MYSQL_*`, `MONGO_*` — ver `.env.example` da raiz).

**Atenção a volume legado:** `MONGO_INITDB_*` e os scripts de `docker-entrypoint-initdb.d`
**não reaplicam** em volume já existente (só rodam com datadir vazio). Se o volume
`mongo_data` é anterior ao auth, rode `docker compose down -v` e suba de novo
(apaga dados dev; rode o seed depois). Verificação manual:

```bash
# anônimo → esperado falhar:
docker exec essentia-todo-list-mongo mongosh --quiet todo_activity --eval 'db.tasks.findOne()'
# MongoServerError: command requires authentication
# com credenciais → funciona:
docker exec essentia-todo-list-mongo mongosh --quiet \
  'mongodb://todo:todo@localhost:27017/todo_activity?authSource=admin' \
  --eval 'db.getCollectionNames().length'
```

## Sem Docker nenhum (bancos instalados na máquina)

Instale MySQL 8 e MongoDB 7 localmente, crie os bancos `todo_dev`/`todo_test` com
permissão para o usuário `todo` (o `docker/db/init.sql` é a referência dos grants)
e aponte o `backend/.env` para `localhost`. O resto do fluxo é idêntico ao fallback acima.
