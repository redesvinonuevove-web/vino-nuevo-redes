-- Config privada de Drive: guarda el refresh_token (permiso de la cuenta Vino Nuevo)
-- y el id de la carpeta compartida. Solo lo leen las Edge Functions (service_role).
create table if not exists public.drive_config (
  id int primary key default 1,
  refresh_token text,
  folder_id text,
  updated_at timestamptz not null default now()
);
alter table public.drive_config enable row level security;
-- Sin políticas: anon/authenticated NO pueden leer ni escribir (RLS bloquea).
-- Las Edge Functions usan service_role, que ignora RLS.
revoke all on public.drive_config from anon, authenticated;
