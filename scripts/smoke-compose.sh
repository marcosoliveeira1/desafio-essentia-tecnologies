#!/usr/bin/env bash
#
# smoke-compose.sh — E2E smoke da stack full via Compose (QE-01..QE-03).
#
# Sobe `docker compose up --build --wait`, espera o health na edge :80
# (Caddy), exercita o fluxo auth + CRUD de tarefas via HTTP e desmonta
# a stack com `down -v` mesmo em falha (trap EXIT).
#
# Uso: npm run test:compose   (ou: bash scripts/smoke-compose.sh)
#
# Knobs (opcionais, para depuração):
#   SMOKE_BASE_URL         (default http://localhost)
#   SMOKE_HEALTH_TIMEOUT   (default 180 segundos)
#   SMOKE_HEALTH_INTERVAL  (default 5 segundos)
#
set -Eeuo pipefail

cd "$(dirname "$0")/.."

readonly BASE_URL="${SMOKE_BASE_URL:-http://localhost}"
readonly HEALTH_TIMEOUT="${SMOKE_HEALTH_TIMEOUT:-180}"
readonly HEALTH_INTERVAL="${SMOKE_HEALTH_INTERVAL:-5}"

readonly SMOKE_EMAIL="smoke.$(date +%s)@example.com"
readonly SMOKE_NAME="Smoke Bot"
readonly SMOKE_PASSWORD="smokepass123"

BODY_FILE="$(mktemp)"
LAST_STEP="inicialização"

msg() { printf '\n[smoke] %s\n' "$*"; }

fail() {
	printf '\n[smoke] FALHA em "%s": %s\n' "$LAST_STEP" "$*" >&2
	exit 1
}

cleanup() {
	local exit_code=$?
	if (( exit_code != 0 )); then
		printf '\n[smoke] Falha no passo "%s" — últimos logs da stack:\n' "$LAST_STEP" >&2
		docker compose logs --tail 50 >&2 || true
	fi
	docker compose down -v || true
	rm -f "$BODY_FILE"
	exit "$exit_code"
}
trap cleanup EXIT

assert_status() {
	local expected=$1 actual=$2
	(( actual == expected )) || fail "esperado HTTP ${expected}, recebido ${actual}"
}

http() {
	local method=$1 url=$2
	shift 2
	local status
	status="$(curl -sS --max-time 15 -o "$BODY_FILE" -w '%{http_code}' \
		-X "$method" "$BASE_URL$url" "$@")" || fail "curl não conseguiu falar com ${method} ${url}"
	printf '%s' "$status"
}

# QE-01 edge case: porta 80 ocupada deve falhar rápido e com mensagem clara.
msg "Pré-checagem: a porta 80 precisa estar livre"
if (exec 3<>/dev/tcp/127.0.0.1/80) 2>/dev/null; then
	exec 3>&- 3<&- || true
	fail "porta 80 já está ocupada — pare o serviço que a usa (ex.: docker compose -p <projeto> down) e rode novamente"
fi
msg "Porta 80 livre."

msg "Subindo a stack full (docker compose up --build --wait)"
LAST_STEP="docker compose up --build --wait"
docker compose up --build --wait

msg "Polling GET ${BASE_URL}/health (timeout ${HEALTH_TIMEOUT}s, intervalo ${HEALTH_INTERVAL}s)"
LAST_STEP="health poll"
local_deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
until curl -fsS --max-time 5 "${BASE_URL}/health" >/dev/null 2>&1; do
	if (( $(date +%s) >= local_deadline )); then
		fail "health não respondeu 200 em ${HEALTH_TIMEOUT}s"
	fi
	sleep "$HEALTH_INTERVAL"
done
msg "Health OK."

msg "POST /api/auth/register → 201"
LAST_STEP="register"
status="$(http POST /api/auth/register \
	-H 'Content-Type: application/json' \
	-d "$(jq -n --arg email "$SMOKE_EMAIL" --arg name "$SMOKE_NAME" --arg password "$SMOKE_PASSWORD" \
		'{name: $name, email: $email, password: $password}')")"
assert_status 201 "$status"
jq -e --arg email "$SMOKE_EMAIL" '.id > 0 and .email == $email' "$BODY_FILE" >/dev/null \
	|| fail "corpo do register não contém {id, email} esperado"

msg "POST /api/auth/login → 200 {token}"
LAST_STEP="login"
status="$(http POST /api/auth/login \
	-H 'Content-Type: application/json' \
	-d "$(jq -n --arg email "$SMOKE_EMAIL" --arg password "$SMOKE_PASSWORD" \
		'{email: $email, password: $password}')")"
assert_status 200 "$status"
TOKEN="$(jq -er '.token | select(type == "string" and length > 0)' "$BODY_FILE")" \
	|| fail "login não retornou token"
AUTH_HEADER="Authorization: Bearer ${TOKEN}"

msg "POST /api/auth/register duplicado → 409 EMAIL_CONFLICT"
LAST_STEP="register duplicado"
status="$(http POST /api/auth/register \
	-H 'Content-Type: application/json' \
	-d "$(jq -n --arg email "$SMOKE_EMAIL" --arg name "$SMOKE_NAME" --arg password "$SMOKE_PASSWORD" \
		'{name: $name, email: $email, password: $password}')")"
assert_status 409 "$status"
jq -e '.code == "EMAIL_CONFLICT"' "$BODY_FILE" >/dev/null \
	|| fail "409 sem code EMAIL_CONFLICT"

msg "POST /api/tasks → 201"
LAST_STEP="create task"
status="$(http POST /api/tasks -H "$AUTH_HEADER" \
	-H 'Content-Type: application/json' \
	-d '{"title":"[smoke] tarefa efêmera","description":"criada pelo smoke-compose"}')"
assert_status 201 "$status"
TASK_ID="$(jq -er '.id | select(type == "number" and . > 0)' "$BODY_FILE")" \
	|| fail "create não retornou id numérico"

msg "GET /api/tasks → 200 contendo a tarefa criada"
LAST_STEP="list tasks"
status="$(http GET /api/tasks -H "$AUTH_HEADER")"
assert_status 200 "$status"
jq -e --argjson id "$TASK_ID" 'type == "array" and any(.[]; .id == $id)' "$BODY_FILE" >/dev/null \
	|| fail "tarefa ${TASK_ID} não aparece na listagem"

msg "PATCH /api/tasks/${TASK_ID} → 200 com completed=true"
LAST_STEP="patch task"
status="$(http PATCH "/api/tasks/${TASK_ID}" -H "$AUTH_HEADER" \
	-H 'Content-Type: application/json' -d '{"completed":true}')"
assert_status 200 "$status"
jq -e --argjson id "$TASK_ID" '.id == $id and .completed == true' "$BODY_FILE" >/dev/null \
	|| fail "patch não persistiu completed=true"

msg "DELETE /api/tasks/${TASK_ID} → 204"
LAST_STEP="delete task"
status="$(http DELETE "/api/tasks/${TASK_ID}" -H "$AUTH_HEADER")"
assert_status 204 "$status"

msg "SMOKE VERDE — fluxo auth + CRUD validado via Caddy :80 (email ${SMOKE_EMAIL})"
