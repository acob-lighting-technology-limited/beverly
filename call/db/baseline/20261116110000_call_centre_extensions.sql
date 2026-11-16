-- Beverly Call extensions: supervisor role, tickets, notes, routing support, notifications, QA, SMS log.
-- Builds on 20261115130000_call_centre_agent_role, 20261115140000_call_centre_schema, 20261116100000_call_centre_presence.
-- Same least-privilege model: only the `beverly_call_api` login role touches these tables.

-- ── Supervisor role (mirrors the agent role; read-only CRM permissions) ────────
insert into public.roles (role_key, role_name, label, description)
values ('custom-call-centre-supervisor', 'Call Centre Supervisor', 'Call Centre Supervisor',
        'Beverly Call supervisor: live wall, escalations, recordings and reports. Read-only on customers and vending.')
on conflict (role_key) do update
set role_name = excluded.role_name, label = excluded.label, description = excluded.description, updated_at = now();

insert into public.permissions (role_key, route_hash)
values
  ('custom-call-centre-supervisor', 'wallet.customers.view'),
  ('custom-call-centre-supervisor', 'wallet.vending.monitor'),
  ('custom-call-centre-supervisor', 'wallet.support.manage')
on conflict (role_key, route_hash) do nothing;

-- ── Presence: allow break and away ─────────────────────────────────────────────
alter table call_centre.agent_presence drop constraint if exists agent_presence_status_check;
alter table call_centre.agent_presence add constraint agent_presence_status_check
  check (status in ('available', 'busy', 'acw', 'break', 'away'));

-- ── Calls: cost, customer rating, transfer trail ───────────────────────────────
alter table call_centre.calls add column if not exists cost_ngn numeric(12, 2);
alter table call_centre.calls add column if not exists rating smallint check (rating between 1 and 5);
alter table call_centre.calls add column if not exists customer_name text;
alter table call_centre.calls add column if not exists transferred_from text;

-- ── Tickets: reference sequence, phone for SMS, amount ─────────────────────────
create sequence if not exists call_centre.ticket_ref_seq start 2042;
alter table call_centre.tickets add column if not exists amount_ngn numeric(14, 2) not null default 0;
alter table call_centre.tickets add column if not exists customer_phone text;
alter table call_centre.tickets add column if not exists sms_on_resolve boolean not null default true;
alter table call_centre.tickets add column if not exists sms_rating boolean not null default true;

create table if not exists call_centre.ticket_comments (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references call_centre.tickets (id) on delete cascade,
  author_crm_id  text not null,
  author_name    text not null,
  body           text not null check (char_length(body) between 1 and 1000),
  created_at     timestamptz not null default now()
);
create index if not exists idx_cc_ticket_comments_ticket on call_centre.ticket_comments (ticket_id, created_at);

-- ── Recordings: carrier-hosted source until the ingest worker copies the file into storage ──
alter table call_centre.recordings add column if not exists source_url text;
alter table call_centre.recordings add column if not exists ingested_at timestamptz;
create index if not exists idx_cc_recordings_pending_ingest on call_centre.recordings (created_at) where ingested_at is null and deleted_at is null;

-- ── Callbacks: outcome of last attempt and note ────────────────────────────────
alter table call_centre.callbacks add column if not exists last_outcome text;
alter table call_centre.callbacks add column if not exists note text;

-- ── Call notes and customer notes ──────────────────────────────────────────────
create table if not exists call_centre.call_notes (
  id             uuid primary key default gen_random_uuid(),
  call_id        uuid not null references call_centre.calls (id) on delete cascade,
  author_crm_id  text not null,
  author_name    text not null,
  body           text not null check (char_length(body) between 1 and 1000),
  created_at     timestamptz not null default now()
);
create index if not exists idx_cc_call_notes_call on call_centre.call_notes (call_id, created_at);

create table if not exists call_centre.customer_notes (
  id             uuid primary key default gen_random_uuid(),
  customer_ref   text not null,
  author_crm_id  text not null,
  author_name    text not null,
  body           text not null check (char_length(body) between 1 and 1000),
  created_at     timestamptz not null default now()
);
create index if not exists idx_cc_customer_notes_customer on call_centre.customer_notes (customer_ref, created_at desc);

-- ── Supervision: coaching prompts and monitor sessions ─────────────────────────
create table if not exists call_centre.coaching_log (
  id                 uuid primary key default gen_random_uuid(),
  agent_crm_id       text not null,
  supervisor_crm_id  text not null,
  supervisor_name    text not null,
  kind               text not null check (kind in ('prompt', 'listen', 'whisper', 'barge')),
  body               text,
  delivered_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists idx_cc_coaching_agent on call_centre.coaching_log (agent_crm_id, created_at desc);

-- ── Quality assurance scores ───────────────────────────────────────────────────
create table if not exists call_centre.qa_scores (
  id                uuid primary key default gen_random_uuid(),
  call_id           uuid not null unique references call_centre.calls (id) on delete cascade,
  reviewer_crm_id   text not null,
  reviewer_name     text not null,
  score             integer not null check (score between 0 and 100),
  notes             text,
  created_at        timestamptz not null default now()
);

-- ── Shift handover ─────────────────────────────────────────────────────────────
create table if not exists call_centre.shift_handovers (
  id             uuid primary key default gen_random_uuid(),
  author_crm_id  text not null,
  author_name    text not null,
  body           text not null check (char_length(body) between 1 and 2000),
  created_at     timestamptz not null default now()
);

-- ── Notifications, read state, push subscriptions ──────────────────────────────
create table if not exists call_centre.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_crm_id   text,                         -- null = everyone with the call portal
  category      text not null check (category in ('esc', 'cb', 'sys')),
  tone          text not null default 'vi' check (tone in ('bad', 'ye', 'ok', 'vi')),
  title         text not null,
  body          text not null default '',
  link          text,
  dedupe_key    text unique,                  -- sweep jobs insert once per event
  created_at    timestamptz not null default now()
);
create index if not exists idx_cc_notifications_user on call_centre.notifications (user_crm_id, created_at desc);

create table if not exists call_centre.notification_reads (
  user_crm_id  text not null,
  key          text not null,
  read_at      timestamptz not null default now(),
  primary key (user_crm_id, key)
);

create table if not exists call_centre.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_crm_id   text not null,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now()
);

-- ── SMS log (every outbound SMS is recorded) ───────────────────────────────────
create table if not exists call_centre.sms_log (
  id             uuid primary key default gen_random_uuid(),
  to_number      text not null,
  body           text not null,
  kind           text not null check (kind in ('case_resolved', 'rating_request', 'agent', 'callback')),
  status         text not null default 'queued',
  provider_ref   text,
  created_by     text,
  created_at     timestamptz not null default now()
);

-- ── Settings (admin-edited) and retention run log ──────────────────────────────
create table if not exists call_centre.settings (
  key         text primary key check (key in ('alert_limits', 'call_flow', 'saved_replies', 'outages')),
  value       jsonb not null,
  updated_by  text not null,
  updated_at  timestamptz not null default now()
);

create table if not exists call_centre.retention_runs (
  id             uuid primary key default gen_random_uuid(),
  ran_at         timestamptz not null default now(),
  deleted_count  integer not null default 0,
  held_count     integer not null default 0,
  failed_count   integer not null default 0
);

-- ── Last carrier webhook, for the connections panel ────────────────────────────
create table if not exists call_centre.webhook_heartbeat (
  provider     text primary key,
  last_seen    timestamptz not null default now()
);

-- ── RLS and least-privilege grants, same pattern as the base schema ────────────
do $$
declare t text;
begin
  foreach t in array array['ticket_comments','call_notes','customer_notes','coaching_log','qa_scores','shift_handovers',
    'notifications','notification_reads','push_subscriptions','sms_log','settings','retention_runs','webhook_heartbeat']
  loop
    execute format('alter table call_centre.%I enable row level security', t);
    execute format('drop policy if exists cc_%1$s_api on call_centre.%1$I', t);
    execute format('create policy cc_%1$s_api on call_centre.%1$I for all to beverly_call_api using (true) with check (true)', t);
    execute format('revoke all on call_centre.%I from anon, authenticated, public', t);
    execute format('grant select, insert, update, delete on call_centre.%I to beverly_call_api', t);
  end loop;
end $$;
grant usage, select on sequence call_centre.ticket_ref_seq to beverly_call_api;
-- Append-only evidence tables: no update or delete for the API role.
revoke update, delete on call_centre.retention_runs, call_centre.sms_log from beverly_call_api;
grant update on call_centre.sms_log to beverly_call_api;  -- delivery status is updated once

notify pgrst, 'reload schema';
