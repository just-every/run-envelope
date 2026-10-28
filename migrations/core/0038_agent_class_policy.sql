CREATE TABLE env_agent_class_policy (
 company_id TEXT PRIMARY KEY REFERENCES env_companies(id),
 version INTEGER NOT NULL, answers TEXT CHECK(answers IS NULL OR json_valid(answers)),
 paused INTEGER NOT NULL CHECK(paused IN (0,1)), change_id TEXT NOT NULL,
 updated_by TEXT NOT NULL REFERENCES oa_operators(id), updated_at INTEGER NOT NULL
);
CREATE TABLE env_agent_call_audit (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES env_companies(id),
 credential_id TEXT NOT NULL REFERENCES env_agent_grants(id), sponsor_id TEXT NOT NULL REFERENCES oa_operators(id),
 tool TEXT NOT NULL, transport TEXT NOT NULL, classes TEXT NOT NULL CHECK(json_valid(classes)),
 decision TEXT NOT NULL, policy_version INTEGER NOT NULL, occurred_at INTEGER NOT NULL
);
CREATE INDEX env_agent_call_audit_period ON env_agent_call_audit(company_id,occurred_at);
