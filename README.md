# Task Manager TechX
[![CI](https://github.com/SEU_USUARIO/desafio-essentia-tecnologies/actions/workflows/ci.yml/badge.svg)](https://github.com/SEU_USUARIO/desafio-essentia-tecnologies/actions/workflows/ci.yml)

App web de gerenciamento de tarefas (to-do list) para os funcionários da TechX organizarem o dia a dia.

> Desafio técnico Essentia Technologies (Menatech): CRUD de tarefas com **Angular** no front,
> API RESTful **Node.js + TypeScript (Fastify)** no back e **MySQL** como fonte da verdade —
> com extras opcionais (auth **JWT**, histórico em **MongoDB**).

## Visão

- **Funcionários**: ver, adicionar, editar, remover e concluir tarefas numa UI simples e rápida.
- **API**: REST completa (`/api/tasks`, `/api/auth/*`, `/api/tasks/:id/history`) com validação e erros padronizados `{code, message, details?}`.
- **Entrega**: monorepo `backend/` + `frontend/` + `docker-compose.yml`; setup local em < 5 min.

## Status

Fase 0 — fundação do monorepo (T1). README completo na T24.
