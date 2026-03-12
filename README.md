# Ner Israel — Programa de Conquistas v2 (com backend real)

## Passo a passo de setup

### 1. Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto (nunca suba no GitHub):

```
REACT_APP_SUPABASE_URL=https://oifekqqpvnmextkrajoc.supabase.co
REACT_APP_SUPABASE_KEY=sb_publishable_7VBdfmm1_gQUNdzrM3xLXg_ZcnnQGUh
```

### 2. Atualizar RLS no Supabase

No Supabase → SQL Editor, rode o conteúdo de `sql/update-rls.sql`.

### 3. Deploy das Edge Functions

Instale o Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref oifekqqpvnmextkrajoc
```

Configure os secrets das Edge Functions:
```bash
supabase secrets set RESEND_API_KEY=re_bWsNMhHd_91c2Cf2GJzyZEyBaPFZPQ7Ui
supabase secrets set ADMIN_EMAIL=lennywajcberg18@gmail.com
supabase secrets set APP_URL=https://ner-conquistas.vercel.app
```

Deploy das funções:
```bash
supabase functions deploy admin-action
supabase functions deploy notify-admin
```

### 4. Rodar localmente

```bash
npm install
npm start
```

### 5. Deploy no Vercel

No painel do Vercel, adicione as variáveis de ambiente:
- `REACT_APP_SUPABASE_URL` = https://oifekqqpvnmextkrajoc.supabase.co
- `REACT_APP_SUPABASE_KEY` = sb_publishable_7VBdfmm1_gQUNdzrM3xLXg_ZcnnQGUh

---

## Como funciona o fluxo completo

1. **Novo membro** → clica "Solicitar Convite" → preenche nome/email → admin recebe email
2. **Admin aprova convite** → usuário é criado automaticamente no Supabase + email com senha enviado para o novo membro
3. **Membro loga** → solicita pontos → admin recebe email de notificação → aprova no painel
4. **Membro resgata prêmio** → admin aprova → pontos debitados + email de confirmação

## Stack
- React 18 + Supabase (auth + banco) + Resend (emails)
- Edge Functions (Deno) para operações de admin
- Deploy: Vercel (frontend) + Supabase (backend)
