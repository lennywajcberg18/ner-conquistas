-- Execute este script no SQL Editor do Supabase para atualizar as policies

-- 1. Remover policies antigas
drop policy if exists "Usuários veem seu perfil" on profiles;
drop policy if exists "Admin vê todos" on profiles;
drop policy if exists "Membros veem requests" on requests;
drop policy if exists "Membros criam requests" on requests;
drop policy if exists "Admin gerencia requests" on requests;
drop policy if exists "Qualquer um cria convite" on invite_requests;
drop policy if exists "Admin vê convites" on invite_requests;

-- 2. Profiles: qualquer autenticado pode ler (necessário para ranking)
create policy "read_profiles"
  on profiles for select
  using (auth.uid() is not null);

-- 3. Profiles: usuário atualiza só o próprio
create policy "update_own_profile"
  on profiles for update
  using (auth.uid() = id);

-- 4. Requests: membro lê apenas as próprias
create policy "read_own_requests"
  on requests for select
  using (auth.uid() = member_id);

-- 5. Requests: membro cria apenas as próprias
create policy "insert_own_request"
  on requests for insert
  with check (auth.uid() = member_id);

-- 6. Invite requests: qualquer um pode criar (público)
create policy "insert_invites"
  on invite_requests for insert
  with check (true);

-- Nota: operações de admin (ler tudo, aprovar, rejeitar)
-- são feitas via Edge Functions com service role key,
-- que ignora RLS automaticamente.
