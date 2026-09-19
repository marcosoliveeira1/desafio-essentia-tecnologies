#!/usr/bin/env bash
#
# up.sh — sobe a stack full e popula o usuário demo (idempotente).
#
# Uso:
#   bash scripts/up.sh [--seed] [--no-seed] [--detached|-d] [--help]
#   npm run up          # stack prod-like, sem seed (foreground: segue os logs)
#   npm run up:d        # stack prod-like, sem seed (detached)
#   npm run up:dev      # stack + seed demo (foreground)
#   npm run up:dev:d    # stack + seed demo (detached)
#
# Ctrl+C no modo foreground só sai dos logs — a stack continua no ar
# (`docker compose down` derruba).
#
# Fluxo: setup-env → `docker compose up --build --wait` → seed no host
# (modo dev, contra o MySQL em 127.0.0.1:3306) → `docker compose logs -f`
# (só no modo foreground).
#
set -Eeuo pipefail

cd "$(dirname "$0")/.."

DETACHED=false
SEED=false

for arg in "$@"; do
  case "$arg" in
    --detached | -d) DETACHED=true ;;
    --seed) SEED=true ;;
    --no-seed) SEED=false ;;
    --help | -h)
      sed -n '2,/^set /p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "[up] flag desconhecida: $arg (ver --help)" >&2
      exit 1
      ;;
  esac
done

bash scripts/setup-env.sh

echo "[up] subindo a stack (docker compose up --build --wait)"
docker compose up --build --wait

if [[ "$SEED" == true ]]; then
  # O seed roda no host (tsx) — garante as deps do backend sozinho.
  if [[ ! -d backend/node_modules ]]; then
    echo "[up] backend/node_modules ausente — instalando deps do backend (só p/ o seed)"
    npm --prefix backend install
  fi
  # O seed (backend/src/seed.ts) exige JWT_SECRET com 32+ chars no
  # ambiente — reaproveita o do .env da raiz quando não exportado.
  if [[ -z "${JWT_SECRET:-}" && -f .env ]]; then
    JWT_SECRET="$(grep -E '^JWT_SECRET=' .env | cut -d= -f2-)"
    export JWT_SECRET
  fi
  _secret="${JWT_SECRET:-}"
  echo "[up] populando usuário demo (demo@essentia.com, idempotente; JWT_SECRET com ${#_secret} chars)"
  unset _secret
  if ! NODE_ENV=development npm run seed --prefix backend; then
    echo "[up] aviso: seed falhou — a stack segue no ar (rode 'npm run seed --prefix backend' manualmente)" >&2
  fi
fi

docker compose ps --format 'table {{.Name}}\t{{.Status}}'

if [[ "$DETACHED" == true ]]; then
  echo "[up] no ar (detached) — abra http://localhost · derruba com: docker compose down"
else
  echo "[up] no ar — abra http://localhost (Ctrl+C sai dos logs; a stack continua: 'docker compose down' derruba)"
  # shellcheck disable=SC2064
  trap "echo; echo '[up] logs encerrados — a stack continua no ar (docker compose down para derrubar)'" INT
  docker compose logs -f
fi
