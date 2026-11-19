-- Reuniones conectadas a Google Calendar + Meet.
-- meet_link  = enlace de Google Meet (reuniones no presenciales)
-- event_link = enlace al evento en Google Calendar
-- event_id   = id del evento (por si luego hay que editarlo/borrarlo)
alter table public.meetings add column if not exists meet_link text;
alter table public.meetings add column if not exists event_link text;
alter table public.meetings add column if not exists event_id text;
