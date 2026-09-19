#!/usr/bin/env bash
# Executado pelo entrypoint do mysql na fase de init (datadir vazio).
# Concede ao app user (MYSQL_USER) acesso ao banco de teste (todo_test):
# a imagem só concede ALL PRIVILEGES no MYSQL_DATABASE (todo_dev).
# Host '%': conexões do container e do dev local chegam pelo gateway do
# bridge; a exposição de rede é controlada pelo bind 127.0.0.1.
set -euo pipefail

# A pasta initdb.d é montada também no container mongo: sem o binário mysql
# é o init do mongo — no-op (return, não exit: o entrypoint faz source).
command -v mysql >/dev/null 2>&1 || return 0

: "${MYSQL_USER:?MYSQL_USER ausente}" "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD ausente}"

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<-SQL
	GRANT ALL PRIVILEGES ON \`todo_test\`.* TO '${MYSQL_USER}'@'%';
	FLUSH PRIVILEGES;
SQL
