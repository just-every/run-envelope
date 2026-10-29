-- Keep the real signed principal alongside the native grant's durable identity.
ALTER TABLE env_agent_call_audit ADD COLUMN door_agent_id TEXT;
ALTER TABLE env_agent_call_audit ADD COLUMN door_agent_name TEXT;
ALTER TABLE env_agent_call_audit ADD COLUMN door_operation_id TEXT;
ALTER TABLE env_agent_call_audit ADD COLUMN door_consent TEXT;
ALTER TABLE env_agent_call_audit ADD COLUMN door_approvers TEXT;
CREATE TRIGGER env_agent_call_door_attribution_immutable_update BEFORE UPDATE ON env_agent_call_audit
WHEN NEW.door_agent_id IS NOT OLD.door_agent_id OR NEW.door_agent_name IS NOT OLD.door_agent_name
 OR NEW.door_operation_id IS NOT OLD.door_operation_id OR NEW.door_consent IS NOT OLD.door_consent
 OR NEW.door_approvers IS NOT OLD.door_approvers
BEGIN SELECT RAISE(ABORT,'immutable_agent_call_attribution'); END;
