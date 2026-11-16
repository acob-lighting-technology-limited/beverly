-- Beverly Call live agent presence, stored in the database instead of API process memory.
--
-- Why: routing and the night-shift staffing guard read "who is signed in right now". Kept in a Node
-- process's memory, that roster is lost on every restart and is wrong whenever more than one API
-- instance (or a serverless platform such as Vercel) answers requests. One row per agent, refreshed
-- by the agent's browser heartbeat (about every 30 s); a row whose last_seen is older than the API's
-- TTL (90 s) is treated as offline and ignored. Presence is ephemeral operational data, not a record:
-- rows may be deleted freely and the roster rebuilds within one heartbeat interval.
--
-- The agent is referenced by Beverly staff id (`agent_crm_id`) with no foreign key, like the other
-- call_centre tables. Same least-privilege model: only the `beverly_call_api` login role may use it.

create table if not exists call_centre.agent_presence (
  agent_crm_id  text primary key,
  name          text not null,
  client_name   text not null,                       -- Africa's Talking WebRTC client name
  status        text not null check (status in ('available', 'busy', 'acw')),
  languages     text[] not null check (cardinality(languages) between 1 and 5),
  skills        text[] not null default array['vending']::text[],
  idle_since    timestamptz not null default now(),  -- restarts whenever the agent becomes available
  last_seen     timestamptz not null default now()
);
create index if not exists idx_cc_presence_last_seen on call_centre.agent_presence (last_seen);

alter table call_centre.agent_presence enable row level security;
drop policy if exists cc_presence_api on call_centre.agent_presence;
create policy cc_presence_api on call_centre.agent_presence
  for all to beverly_call_api using (true) with check (true);

revoke all on call_centre.agent_presence from anon, authenticated, public;
grant select, insert, update, delete on call_centre.agent_presence to beverly_call_api;

notify pgrst, 'reload schema';
