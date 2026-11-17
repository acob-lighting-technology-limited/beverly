-- Rollback for 20261116140000_call_centre_directory_binding.sql
drop function if exists call_centre.apply_phone_binding(uuid, text);
drop view if exists call_centre_read.directory_phones;
drop table if exists call_centre.phone_bindings;
drop view if exists call_centre_read.directory;
notify pgrst, 'reload schema';
