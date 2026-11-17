-- Beverly's support tickets, read-only, so a customer's profile can list them. Changes and replies still go through Beverly's admin API
-- (permission, customer notices and Beverly's own logging apply); this view never writes. Messages are fetched through that API too.
create or replace view call_centre_read.support_tickets as
select t.id, t.reference,
       coalesce(t.customer_id, case when t.requester_actor_type::text = 'customer' then t.requester_actor_id end) as customer_id,
       t.requester_name, t.requester_actor_type::text as requester_type, t.category, t.subject,
       t.priority::text as priority, t.status::text as status, t.assigned_to_user_id,
       t.last_message_at, t.created_at, t.resolved_at, t.meter_context
from public.support_tickets t;

revoke all on call_centre_read.support_tickets from public, anon, authenticated;
grant select on call_centre_read.support_tickets to beverly_call_api;
notify pgrst, 'reload schema';
