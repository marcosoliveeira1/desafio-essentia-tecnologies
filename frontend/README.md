# Essentia Tasks — Frontend

Aplicação Angular (shell base da T9). O shell real das telas chega na T12.

## Pré-requisitos

- Node.js (ver `.nvmrc` na raiz) e npm
- Backend rodando em `http://localhost:3000` (ver `backend/.env.example`: `APP_PORT=3000`)

## Instalação

```bash
npm install
```

## Desenvolvimento (com proxy para o backend)

```bash
npm start
```

Isso executa `ng serve --proxy-config proxy.conf.json`. O proxy redireciona
`/api` → `http://localhost:3000`. Acesse `http://localhost:4200/`.

## Build

```bash
npm run build
```

Os artefatos ficam em `dist/`.

## Testes

```bash
npm test -- --watch=false
```
