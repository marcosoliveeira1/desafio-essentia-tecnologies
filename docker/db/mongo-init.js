// Executado pelo entrypoint da imagem mongo:7 SOMENTE na 1ª inicialização
// (datadir vazio). MONGO_INITDB_* NÃO reaplica em volume legado — README/smoke
// orientam `docker compose down -v` (spec hardening-03, Assumptions).
const appUser = process.env.MONGO_APP_USERNAME || 'todo'
const appPassword = process.env.MONGO_APP_PASSWORD || 'todo'
const admin = db.getSiblingDB('admin')

if (admin.getUser(appUser)) {
	print(`[mongo-init] app user "${appUser}" já existe — nada a fazer`)
} else {
	admin.createUser({
		user: appUser,
		pwd: appPassword,
		roles: [
			{ role: 'readWrite', db: 'todo_activity' },
			{ role: 'readWrite', db: 'todo_activity_test' },
		],
	})
	print(
		`[mongo-init] app user "${appUser}" criado (readWrite em todo_activity + todo_activity_test)`,
	)
}
