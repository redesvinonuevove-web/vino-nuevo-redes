-- Menciones (@) en comentarios: notificación dirigida a un usuario.
alter table public.notifications add column if not exists for_user uuid;
-- for_user = id del usuario mencionado; null = notificación global (todos la ven).
