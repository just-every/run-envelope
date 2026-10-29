-- Native operators can reconcile a shared decision with its original company
-- activity without scanning every client's retained week.
CREATE INDEX env_agent_call_operation ON env_agent_call_audit(company_id,door_operation_id,occurred_at);
