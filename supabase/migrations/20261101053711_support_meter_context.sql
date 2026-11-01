-- NULL denotes cases opened before meter selection was introduced.
-- An empty array means the requester selected a non-meter issue.
alter table public.support_tickets add column if not exists meter_context jsonb;
alter table public.support_chat_sessions add column if not exists meter_context jsonb;

alter table public.support_tickets add constraint support_tickets_meter_context_array
    check (meter_context is null or jsonb_typeof(meter_context) = 'array');
alter table public.support_chat_sessions add constraint support_chat_meter_context_array
    check (meter_context is null or jsonb_typeof(meter_context) = 'array');
