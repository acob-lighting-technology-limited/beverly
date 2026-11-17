-- Rollback for 20261116160000_call_centre_read_support_tickets.sql
drop view if exists call_centre_read.support_tickets;
notify pgrst, 'reload schema';
