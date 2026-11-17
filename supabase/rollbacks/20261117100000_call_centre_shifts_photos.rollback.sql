-- Rollback for 20261117100000_call_centre_shifts_photos.sql
drop table if exists call_centre.shift_overrides, call_centre.agent_rotation, call_centre.rotations, call_centre.shift_templates;
delete from call_centre.settings where key = 'shift_policy';
alter table call_centre.settings drop constraint if exists settings_key_check;
alter table call_centre.settings add constraint settings_key_check check (key in ('alert_limits', 'call_flow', 'saved_replies', 'outages'));
create or replace view call_centre_read.staff as
select u.id, u.auth_user_id, u.user_name, u.email, u.role_key, u.station_id, u.station_ids, u.portal_access, u.created_at, u.updated_at from public.users u;
notify pgrst, 'reload schema';
