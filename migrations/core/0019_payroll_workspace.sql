-- Encrypted, append-only payroll inputs. A review is bound to one immutable
-- revision, one native session and the current company grant.
CREATE TABLE env_workspace_versions (
 company_id TEXT NOT NULL REFERENCES env_companies(id),
 kind TEXT NOT NULL, object_id TEXT NOT NULL, version INTEGER NOT NULL,
 person_id TEXT, person_version INTEGER,
 cipher TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES oa_operators(id),
 created_at INTEGER NOT NULL, change_id TEXT NOT NULL UNIQUE,
 PRIMARY KEY(company_id,kind,object_id,version),
 FOREIGN KEY(company_id,person_id) REFERENCES env_people(company_id,id)
);
CREATE TABLE env_workspace_decisions (
 company_id TEXT NOT NULL, kind TEXT NOT NULL, object_id TEXT NOT NULL,
 version INTEGER NOT NULL, decision TEXT NOT NULL CHECK(decision IN ('approved','withdrawn')),
 actor_id TEXT NOT NULL REFERENCES oa_operators(id), occurred_at INTEGER NOT NULL,
 change_id TEXT NOT NULL UNIQUE,
 PRIMARY KEY(company_id,kind,object_id,version,decision),
 FOREIGN KEY(company_id,kind,object_id,version) REFERENCES env_workspace_versions(company_id,kind,object_id,version)
);
CREATE TABLE env_workspace_reviews (
 token_hash TEXT PRIMARY KEY, company_id TEXT NOT NULL, kind TEXT NOT NULL,
 object_id TEXT NOT NULL, version INTEGER NOT NULL, session_id TEXT NOT NULL,
 operator_id TEXT NOT NULL, grant_version INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 FOREIGN KEY(company_id,kind,object_id,version) REFERENCES env_workspace_versions(company_id,kind,object_id,version)
);
CREATE TRIGGER env_workspace_immutable_update BEFORE UPDATE ON env_workspace_versions BEGIN SELECT RAISE(ABORT,'immutable_payroll_input'); END;
CREATE TRIGGER env_workspace_immutable_delete BEFORE DELETE ON env_workspace_versions BEGIN SELECT RAISE(ABORT,'immutable_payroll_input'); END;
CREATE TRIGGER env_workspace_decision_update BEFORE UPDATE ON env_workspace_decisions BEGIN SELECT RAISE(ABORT,'immutable_payroll_decision'); END;
CREATE TRIGGER env_workspace_decision_delete BEFORE DELETE ON env_workspace_decisions BEGIN SELECT RAISE(ABORT,'immutable_payroll_decision'); END;
