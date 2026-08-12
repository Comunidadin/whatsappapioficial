create table if not exists config (
  id boolean primary key default true check (id),
  phone_number_id text default '',
  waba_id text default '',
  meta_token text default '',
  meta_app_secret text default '',
  verify_token text default '',
  bot_enabled boolean not null default false,
  bot_role text not null default 'ventas',
  system_prompt text not null default '',
  welcome_message text not null default '',
  business_hours jsonb not null default '{"enabled":false,"tz":"America/Guayaquil","days":{}}'::jsonb,
  out_of_hours_message text not null default '',
  escalation_keywords text[] not null default '{}',
  openai_model text not null default 'gpt-4o-mini',
  updated_at timestamptz not null default now()
);

insert into config (id) values (true) on conflict (id) do nothing;

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique,
  profile_name text,
  status text not null default 'nuevo'
    check (status in ('nuevo','en_conversacion','calificado','atendido_humano')),
  bot_paused boolean not null default false,
  needs_attention boolean not null default false,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  wa_message_id text unique,
  direction text not null check (direction in ('inbound','outbound')),
  sender text not null check (sender in ('contacto','bot','humano')),
  type text not null default 'text' check (type in ('text','image','audio','other')),
  body text not null default '',
  status text not null default 'pending'
    check (status in ('pending','sent','delivered','read','failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists messages_contact_created_idx on messages (contact_id, created_at desc);
create index if not exists contacts_last_message_idx on contacts (last_message_at desc);

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  ok boolean not null,
  detail text not null default ''
);

create index if not exists webhook_events_received_idx on webhook_events (received_at desc);

alter table config enable row level security;
alter table contacts enable row level security;
alter table messages enable row level security;
alter table webhook_events enable row level security;

-- El panel lee contactos y mensajes desde el navegador (inbox en vivo); escribir pasa por el servidor.
-- OJO: el panel no tiene login, así que el permiso es para `anon`. Mientras el panel esté solo en
-- localhost no hay exposición; antes de publicarlo en internet hay que volver a exigir sesión aquí.
drop policy if exists "auth lee contactos" on contacts;
drop policy if exists "auth lee mensajes" on messages;
drop policy if exists "panel lee contactos" on contacts;
drop policy if exists "panel lee mensajes" on messages;
create policy "panel lee contactos" on contacts for select to anon, authenticated using (true);
create policy "panel lee mensajes"  on messages for select to anon, authenticated using (true);

-- config y webhook_events: sin políticas. Solo la secret key (que salta RLS).

-- Realtime para el inbox en vivo.
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table contacts;
