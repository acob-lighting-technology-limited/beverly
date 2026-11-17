-- Shift templates, rotations, assignments and day overrides, and the staff photo URL in the read view.
--
-- Photos are NOT stored here: a staff member's photo is Beverly's own (public.users.profile_picture_url, bucket wallet-profile-pictures), so the
-- same picture shows in the wallet, the CRM and Beverly Call. Beverly Call reads the URL through call_centre_read.staff and uploads through
-- Beverly's own profile-picture flow with the staff member's token.
--
-- A rotation is an ordered list of weeks. Each week names a shift template (or none) and which weekdays it applies to. An agent is assigned
-- one rotation plus an offset in weeks, so a team can be staggered (week 1 morning for some, week 1 evening for others). Overrides cover swaps
-- and leave for single days. Times are Nigerian time (WAT). A template whose end is not after its start runs overnight.

create table if not exists call_centre.shift_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(btrim(name)) between 1 and 40),
  start_time  time not null,
  end_time    time not null check (end_time <> start_time),
  color       text not null default '#E3B93C' check (color ~ '^#[0-9a-fA-F]{6}$'),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists call_centre.rotations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique check (length(btrim(name)) between 1 and 40),
  anchor_date  date not null check (extract(isodow from anchor_date) = 1),   -- a Monday: week 1 of the cycle starts here
  steps        jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 12),
  created_at   timestamptz not null default now(),
  updated_by   text
);

create table if not exists call_centre.agent_rotation (
  agent_crm_id  text primary key,
  rotation_id   uuid not null references call_centre.rotations (id) on delete cascade,
  offset_weeks  integer not null default 0 check (offset_weeks between 0 and 11),
  assigned_by   text not null,
  assigned_at   timestamptz not null default now()
);

create table if not exists call_centre.shift_overrides (
  agent_crm_id  text not null,
  day           date not null,
  shift_id      uuid references call_centre.shift_templates (id) on delete cascade,   -- null with off = a day off
  off           boolean not null default false check (off or shift_id is not null),
  reason        text,
  set_by        text not null,
  created_at    timestamptz not null default now(),
  primary key (agent_crm_id, day)
);
create index if not exists shift_overrides_day_ix on call_centre.shift_overrides (day);

do $$
declare t text;
begin
  foreach t in array array['shift_templates','rotations','agent_rotation','shift_overrides'] loop
    execute format('alter table call_centre.%I enable row level security', t);
    execute format('drop policy if exists cc_%1$s_api on call_centre.%1$I', t);
    execute format('create policy cc_%1$s_api on call_centre.%1$I for all to beverly_call_api using (true) with check (true)', t);
    execute format('revoke all on call_centre.%I from anon, authenticated, public', t);
    execute format('grant select, insert, update, delete on call_centre.%I to beverly_call_api', t);
  end loop;
end $$;

-- The admin's shift policy (enforce shifts in routing, grace minutes) is a setting.
alter table call_centre.settings drop constraint if exists settings_key_check;
alter table call_centre.settings add constraint settings_key_check check (key in ('alert_limits', 'call_flow', 'saved_replies', 'outages', 'shift_policy'));

-- Staff view gains the photo URL (appended so the view is replaced in place).
create or replace view call_centre_read.staff as
select u.id, u.auth_user_id, u.user_name, u.email, u.role_key, u.station_id, u.station_ids,
       u.portal_access, u.created_at, u.updated_at, u.profile_picture_url, u.user_id
from public.users u;
grant select on call_centre_read.staff to beverly_call_api;

notify pgrst, 'reload schema';
