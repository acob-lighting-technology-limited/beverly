-- Rollback for 20261116110000_call_centre_extensions.sql
drop table if exists call_centre.webhook_heartbeat;
alter table call_centre.recordings drop column if exists source_url, drop column if exists ingested_at;
drop table if exists call_centre.retention_runs;
drop table if exists call_centre.settings;
drop table if exists call_centre.sms_log;
drop table if exists call_centre.push_subscriptions;
drop table if exists call_centre.notification_reads;
drop table if exists call_centre.notifications;
drop table if exists call_centre.shift_handovers;
drop table if exists call_centre.qa_scores;
drop table if exists call_centre.coaching_log;
drop table if exists call_centre.customer_notes;
drop table if exists call_centre.call_notes;
drop table if exists call_centre.ticket_comments;
alter table call_centre.callbacks drop column if exists last_outcome, drop column if exists note;
alter table call_centre.tickets drop column if exists amount_ngn, drop column if exists customer_phone,
  drop column if exists sms_on_resolve, drop column if exists sms_rating;
drop sequence if exists call_centre.ticket_ref_seq;
alter table call_centre.calls drop column if exists cost_ngn, drop column if exists rating,
  drop column if exists customer_name, drop column if exists transferred_from;
alter table call_centre.agent_presence drop constraint if exists agent_presence_status_check;
alter table call_centre.agent_presence add constraint agent_presence_status_check check (status in ('available', 'busy', 'acw'));
delete from public.permissions where role_key = 'custom-call-centre-supervisor';
delete from public.roles where role_key = 'custom-call-centre-supervisor';
notify pgrst, 'reload schema';
