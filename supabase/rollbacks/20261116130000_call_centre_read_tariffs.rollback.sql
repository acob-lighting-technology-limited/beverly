-- Rollback for 20261116130000_call_centre_read_tariffs.sql
drop view if exists call_centre_read.tariffs;
notify pgrst, 'reload schema';
