-- Rollback for 20261116120000_call_centre_read_access.sql
drop function if exists call_centre_read.reveal_purchase_token(uuid);
drop view if exists call_centre_read.purchases;
drop view if exists call_centre_read.wallets;
drop view if exists call_centre_read.role_permissions;
drop view if exists call_centre_read.roles;
drop view if exists call_centre_read.staff;
drop view if exists call_centre_read.customer_meters;
drop view if exists call_centre_read.customers;
drop schema if exists call_centre_read;
notify pgrst, 'reload schema';
