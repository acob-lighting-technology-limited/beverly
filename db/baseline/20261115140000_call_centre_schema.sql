-- Beverly Call data lives in the shared Beverly Supabase project, in its own `call_centre` schema.
--
-- Why a separate schema (not `public`): `public` is exposed through PostgREST and holds the CRM's
-- ~180 tables. `call_centre` is not exposed, has RLS on every table with policies only for the
-- dedicated login role `beverly_call_api`, and is invisible to anon/authenticated/CRM code paths.
-- Beverly Call connects as `beverly_call_api` (NOT the service role), so a bug or leaked
-- credential in Beverly Call can touch call-centre data only, never CRM wallets or vending.
--
-- Beverly Call keeps NO copy of CRM data: customers and agents are referenced by their Beverly
-- UUID/text id (`customer_ref`, `agent_crm_id`) with no foreign key, so Beverly's own deletes and
-- migrations are never blocked by call-centre rows (anti-corruption boundary).
--
-- The login role has no password here (secrets never go in git). Set it once, out of band:
--   alter role beverly_call_api with password '<generated>';
-- then build Beverly Call's DATABASE_URL from the Supabase pooler host with that password.

create schema if not exists call_centre;
revoke all on schema call_centre from public;

-- ── Login role used only by the Beverly Call API ───────────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'beverly_call_api') then
    create role beverly_call_api login noinherit nobypassrls nosuperuser nocreatedb nocreaterole;
  end if;
end $$;
alter role beverly_call_api set statement_timeout = '15s';
alter role beverly_call_api set idle_in_transaction_session_timeout = '30s';

-- ── Calls ──────────────────────────────────────────────────────────────────────
create table if not exists call_centre.calls (
  id              uuid primary key default gen_random_uuid(),
  at_session_id   text not null unique,
  direction       text not null check (direction in ('inbound', 'outbound')),
  caller_number   text not null,
  customer_ref    text,                    -- public.customers.id (soft reference)
  meter_number    text,
  queue           text not null,
  agent_crm_id    text,                    -- Beverly staff id (public.users.auth_user_id / id)
  language        text not null default 'en' check (language in ('en', 'ha', 'yo', 'ig', 'pcm')),
  started_at      timestamptz not null default now(),
  answered_at     timestamptz,
  ended_at        timestamptz,
  disposition     text,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_cc_calls_caller on call_centre.calls (caller_number);
create index if not exists idx_cc_calls_meter on call_centre.calls (meter_number);
create index if not exists idx_cc_calls_started on call_centre.calls (started_at);

-- ── Recordings (NDPA 90-day retention; legal_hold exempts from purge) ──────────
create table if not exists call_centre.recordings (
  id              uuid primary key default gen_random_uuid(),
  call_id         uuid not null references call_centre.calls (id) on delete cascade,
  storage_key     text not null,
  storage_bucket  text not null,
  duration_seconds integer not null default 0,
  file_size_bytes bigint not null default 0,
  expires_at      timestamptz not null,
  legal_hold      boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_cc_recordings_retention
  on call_centre.recordings (expires_at, legal_hold) where deleted_at is null;

-- ── Tier 2 escalation tickets ──────────────────────────────────────────────────
create table if not exists call_centre.tickets (
  id               uuid primary key default gen_random_uuid(),
  ticket_ref       text not null unique,
  call_id          uuid references call_centre.calls (id),
  call_session_id  text,
  customer_ref     text not null,
  meter_number     text,
  category         text not null check (category in (
    'token_not_received', 'wallet_debited_no_token', 'meter_rejected_token', 'wrong_meter_credited',
    'hardware_fault', 'meter_tamper', 'billing_dispute', 'other')),
  priority         text not null default 'MEDIUM' check (priority in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  status           text not null default 'OPEN' check (status in ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED')),
  agent_crm_id     text,
  notes            text,
  sla_minutes      integer,
  sla_due_at       timestamptz not null,
  deep_link        text,
  sms_notification text,
  resolution_note  text,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_cc_tickets_sla on call_centre.tickets (status, sla_due_at);
create index if not exists idx_cc_tickets_customer on call_centre.tickets (customer_ref, status);

-- ── Continuity callbacks ───────────────────────────────────────────────────────
create table if not exists call_centre.callbacks (
  id                 uuid primary key default gen_random_uuid(),
  callback_ref       text not null unique,
  call_id            uuid references call_centre.calls (id),
  phone_number       text not null,
  customer_ref       text,
  language           text not null default 'en',
  reason             text,
  attempts           integer not null default 0,
  status             text not null default 'pending' check (status in ('pending', 'assigned', 'completed', 'abandoned')),
  assigned_to_crm_id text,
  scheduled_for      timestamptz not null default now(),
  completed_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists idx_cc_callbacks_pending on call_centre.callbacks (status, scheduled_for);

-- ── Tamper-evident, append-only audit log (STS token unmasking etc.) ───────────
-- entry_hash = SHA-256(prev_hash + row content); see apps/api/src/audit/audit-log.ts in Beverly Call.
create table if not exists call_centre.audit_log (
  id          uuid primary key default gen_random_uuid(),
  seq         bigint generated always as identity unique,
  actor_id    uuid not null,
  actor_role  text not null,
  action      text not null,
  entity      text not null,
  entity_id   text not null,
  metadata    jsonb not null default '{}'::jsonb,
  ip_address  text,
  created_at  timestamptz not null default now(),
  prev_hash   char(64) not null,
  entry_hash  char(64) not null unique
);
create index if not exists idx_cc_audit_actor on call_centre.audit_log (actor_id);
create index if not exists idx_cc_audit_entity on call_centre.audit_log (entity, entity_id);

create or replace function call_centre.audit_log_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'call_centre.audit_log is append-only (% blocked)', tg_op;
end;
$$;

drop trigger if exists trg_audit_log_append_only on call_centre.audit_log;
create trigger trg_audit_log_append_only
  before update or delete on call_centre.audit_log
  for each row execute function call_centre.audit_log_append_only();

drop trigger if exists trg_audit_log_no_truncate on call_centre.audit_log;
create trigger trg_audit_log_no_truncate
  before truncate on call_centre.audit_log
  for each statement execute function call_centre.audit_log_append_only();

-- ── Row-level security: only beverly_call_api, nobody else ─────────────────────
alter table call_centre.calls      enable row level security;
alter table call_centre.recordings enable row level security;
alter table call_centre.tickets    enable row level security;
alter table call_centre.callbacks  enable row level security;
alter table call_centre.audit_log  enable row level security;

drop policy if exists cc_calls_api on call_centre.calls;
create policy cc_calls_api on call_centre.calls for all to beverly_call_api using (true) with check (true);
drop policy if exists cc_recordings_api on call_centre.recordings;
create policy cc_recordings_api on call_centre.recordings for all to beverly_call_api using (true) with check (true);
drop policy if exists cc_tickets_api on call_centre.tickets;
create policy cc_tickets_api on call_centre.tickets for all to beverly_call_api using (true) with check (true);
drop policy if exists cc_callbacks_api on call_centre.callbacks;
create policy cc_callbacks_api on call_centre.callbacks for all to beverly_call_api using (true) with check (true);
drop policy if exists cc_audit_select on call_centre.audit_log;
create policy cc_audit_select on call_centre.audit_log for select to beverly_call_api using (true);
drop policy if exists cc_audit_insert on call_centre.audit_log;
create policy cc_audit_insert on call_centre.audit_log for insert to beverly_call_api with check (true);

-- ── Privileges (least privilege) ───────────────────────────────────────────────
revoke all on all tables in schema call_centre from anon, authenticated, public;
grant usage on schema call_centre to beverly_call_api;
grant select, insert, update, delete on call_centre.calls, call_centre.recordings,
  call_centre.tickets, call_centre.callbacks to beverly_call_api;
-- Audit log: insert + read only. No update/delete grant, plus the append-only trigger above.
grant select, insert on call_centre.audit_log to beverly_call_api;

notify pgrst, 'reload schema';
