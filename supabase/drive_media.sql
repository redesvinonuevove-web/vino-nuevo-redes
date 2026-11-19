-- Ajustes extra para Drive (ejecutados en el editor SQL de Supabase)
-- 1) La función necesita escribir/leer la config con service_role:
grant all on public.drive_config to service_role, postgres;
-- 2) Cada tarea guarda sus archivos de Drive en la columna media (jsonb):
alter table public.tasks add column if not exists media jsonb not null default '[]'::jsonb;
-- Cada elemento de media: { driveId, name, mime, folder, by }
