-- Attribution is immutable. A pending call may record one terminal decision;
-- an interrupted process leaves a truthful pending row rather than no history.
CREATE TRIGGER env_agent_call_audit_immutable_update BEFORE UPDATE ON env_agent_call_audit
WHEN OLD.decision!='pending' OR NEW.decision='pending'
 OR NEW.id IS NOT OLD.id OR NEW.company_id IS NOT OLD.company_id
 OR NEW.credential_id IS NOT OLD.credential_id OR NEW.sponsor_id IS NOT OLD.sponsor_id
 OR NEW.tool IS NOT OLD.tool OR NEW.transport IS NOT OLD.transport
 OR NEW.classes IS NOT OLD.classes OR NEW.occurred_at IS NOT OLD.occurred_at
BEGIN SELECT RAISE(ABORT,'immutable_agent_call_audit'); END;
CREATE TRIGGER env_agent_call_audit_immutable_delete BEFORE DELETE ON env_agent_call_audit BEGIN SELECT RAISE(ABORT,'immutable_agent_call_audit'); END;
