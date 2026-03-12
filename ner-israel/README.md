# Ner Israel — Programa de Conquistas

App de pontos e recompensas para a Sinagoga Ner Israel, Perdizes – SP.

## Como rodar localmente

```bash
npm install
npm start
```

## Deploy (Vercel)

1. Faça push deste repositório para o GitHub
2. Importe o projeto em [vercel.com](https://vercel.com)
3. Framework: **Create React App** — deploy automático

## Configurar admin

Edite as linhas no topo de `src/App.jsx`:

```js
const ADMIN_EMAIL    = "admin@nerIsrael.com";
const ADMIN_PASSWORD = "admin123";
```

## Stack

- React 18 (Create React App)
- Deploy: Vercel (gratuito)
- Backend futuro: Supabase + Resend (emails reais)
