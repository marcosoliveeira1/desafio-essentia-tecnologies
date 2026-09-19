#!/usr/bin/env bash
#
# setup-env.sh — garante um .env válido na raiz antes do compose.
#
# Uso: bash scripts/setup-env.sh [--force]
#   - sem .env: copia o .env.example e gera JWT_SECRET com `openssl rand -base64 32`
#   - com .env placeholder (change-me): só troca o JWT_SECRET, preserva o resto
#   - com .env real: não toca em nada (a menos que --force)
#
set -Eeuo pipefail

cd "$(dirname "$0")/.."

FORCE=false
if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
fi

PLACEHOLDER="change-me"

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
  else
    node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
  fi
}

if [[ -f .env && "$FORCE" == false ]]; then
  if grep -q "$PLACEHOLDER" .env; then
    SECRET="$(gen_secret)"
    # troca só a linha do JWT_SECRET, preserva comentários e outras vars
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env  # GNU
    else
      sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env  # macOS/BSD
    fi
    echo "[setup-env] .env já existia com placeholder — JWT_SECRET gerado."
  else
    echo "[setup-env] .env já existe e parece válido — nada a fazer."
  fi
  exit 0
fi

cp .env.example .env
SECRET="$(gen_secret)"
if sed --version >/dev/null 2>&1; then
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env  # GNU
else
  sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env  # macOS/BSD
fi
echo "[setup-env] .env criado com JWT_SECRET gerado."
