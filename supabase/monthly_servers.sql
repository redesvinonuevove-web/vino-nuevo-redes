-- Servidores del mes (quién cubre redes cada mes). Ejecutado en el editor SQL de Supabase.
create table if not exists public.monthly_servers (
  month text primary key,          -- 'YYYY-MM'
  roles jsonb not null default '{}'::jsonb,  -- { "Fotografía": "<user_id>", ... }
  updated_at timestamptz not null default now()
);
alter table public.monthly_servers enable row level security;
drop policy if exists ms_read on public.monthly_servers;
create policy ms_read on public.monthly_servers for select to authenticated using (true);
drop policy if exists ms_write on public.monthly_servers;
create policy ms_write on public.monthly_servers for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.monthly_servers to anon, authenticated;
