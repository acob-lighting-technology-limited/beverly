-- Rollback for 20261116100000_call_centre_presence.sql
-- Presence is ephemeral (rebuilt from heartbeats within ~30 s), so dropping it loses no records.

drop table if exists call_centre.agent_presence;

notify pgrst, 'reload schema';
