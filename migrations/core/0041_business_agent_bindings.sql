-- A native sponsor explicitly issues each scoped grant through the existing
-- step-up protected lifecycle. Business subjects never select a grant by email.
CREATE TABLE env_business_agent_bindings (
 agent_id TEXT NOT NULL, grant_id TEXT NOT NULL REFERENCES env_agent_grants(id),
 sponsor_id TEXT NOT NULL REFERENCES oa_operators(id),
 PRIMARY KEY(agent_id,grant_id)
);
-- Original native audit identities survive secret rotation and expiry.
ALTER TABLE env_agent_access ADD COLUMN door_agent_id TEXT;
ALTER TABLE env_agent_access ADD COLUMN door_agent_name TEXT;
ALTER TABLE env_agent_access ADD COLUMN door_operation_id TEXT;
ALTER TABLE env_agent_access ADD COLUMN door_consent TEXT;
ALTER TABLE env_agent_access ADD COLUMN door_approvers TEXT;
