CREATE TABLE env_agent_grants (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES env_companies(id),
 sponsor_id TEXT NOT NULL REFERENCES oa_operators(id), sponsor_grant_version INTEGER NOT NULL, sponsor_operator_version INTEGER NOT NULL,
 name TEXT NOT NULL,
 actions TEXT NOT NULL CHECK(json_valid(actions)), fields TEXT NOT NULL CHECK(json_valid(fields)),
 locations TEXT NOT NULL CHECK(json_valid(locations)), providers TEXT NOT NULL CHECK(json_valid(providers)),
 models TEXT NOT NULL CHECK(json_valid(models)), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 revoked_at INTEGER, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE env_agent_credentials (
 id TEXT PRIMARY KEY REFERENCES env_agent_grants(id), token_hash TEXT NOT NULL UNIQUE
);
CREATE TABLE env_agent_access (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL, credential_id TEXT NOT NULL REFERENCES env_agent_grants(id),
 sponsor_id TEXT NOT NULL REFERENCES oa_operators(id), action TEXT NOT NULL, target_id TEXT NOT NULL,
 occurred_at INTEGER NOT NULL
);
CREATE TABLE env_run_drafts (
 company_id TEXT NOT NULL REFERENCES env_companies(id), id TEXT NOT NULL,
 credential_id TEXT NOT NULL REFERENCES env_agent_grants(id),
 person_id TEXT NOT NULL, person_version INTEGER NOT NULL, rate_id TEXT NOT NULL,
 period_start TEXT NOT NULL, period_end TEXT NOT NULL, pay_date TEXT NOT NULL,
 minutes INTEGER NOT NULL CHECK(minutes>0), source_ref TEXT NOT NULL, created_at INTEGER NOT NULL,
 request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, UNIQUE(company_id,credential_id,request_key),
 PRIMARY KEY(company_id,id), FOREIGN KEY(company_id,person_id) REFERENCES env_people(company_id,id),
 FOREIGN KEY(company_id,rate_id) REFERENCES env_rate_proposals(company_id,id)
);
CREATE TRIGGER env_draft_no_update BEFORE UPDATE ON env_run_drafts BEGIN SELECT RAISE(ABORT,'immutable_draft'); END;
CREATE TRIGGER env_draft_no_delete BEFORE DELETE ON env_run_drafts BEGIN SELECT RAISE(ABORT,'immutable_draft'); END;
CREATE TRIGGER env_agent_log_no_update BEFORE UPDATE ON env_agent_access BEGIN SELECT RAISE(ABORT,'immutable_agent_log'); END;
CREATE TRIGGER env_agent_log_no_delete BEFORE DELETE ON env_agent_access BEGIN SELECT RAISE(ABORT,'immutable_agent_log'); END;
