-- Init script montado em /docker-entrypoint-initdb.d (ver docker-compose.yml).
-- Roda SOMENTE na primeira inicialização (datadir vazio).
-- MYSQL_DATABASE cria apenas UM banco (todo_dev); este script garante
-- que o banco de teste (todo_test) também exista — sem ele T7/T8 falham.

CREATE DATABASE IF NOT EXISTS `todo_dev`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `todo_test`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
