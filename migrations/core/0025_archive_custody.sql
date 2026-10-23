-- Source attribution is evidence, distinct from portable credential authority.
ALTER TABLE env_companies ADD COLUMN restored INTEGER NOT NULL DEFAULT 0 CHECK(restored IN (0,1));
CREATE TABLE env_agent_history (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES env_companies(id),
 sponsor_id TEXT NOT NULL REFERENCES oa_operators(id), name TEXT NOT NULL, created_at INTEGER NOT NULL
);
INSERT INTO env_agent_history(id,company_id,sponsor_id,name,created_at) SELECT id,company_id,sponsor_id,name,created_at FROM env_agent_grants;
CREATE TRIGGER env_agent_history_insert AFTER INSERT ON env_agent_grants BEGIN
 INSERT INTO env_agent_history(id,company_id,sponsor_id,name,created_at) VALUES(NEW.id,NEW.company_id,NEW.sponsor_id,NEW.name,NEW.created_at);
END;
CREATE TRIGGER env_agent_history_immutable_update BEFORE UPDATE ON env_agent_history BEGIN SELECT RAISE(ABORT,'immutable_agent_attribution'); END;
CREATE TRIGGER env_agent_history_immutable_delete BEFORE DELETE ON env_agent_history BEGIN SELECT RAISE(ABORT,'immutable_agent_attribution'); END;
DROP TRIGGER env_draft_no_update;
DROP TRIGGER env_draft_no_delete;
CREATE TABLE env_run_drafts_archive (
 company_id TEXT NOT NULL REFERENCES env_companies(id), id TEXT NOT NULL,
 credential_id TEXT NOT NULL REFERENCES env_agent_history(id),
 person_id TEXT NOT NULL, person_version INTEGER NOT NULL, rate_id TEXT NOT NULL,
 period_start TEXT NOT NULL, period_end TEXT NOT NULL, pay_date TEXT NOT NULL,
 minutes INTEGER NOT NULL CHECK(minutes>0), source_ref TEXT NOT NULL, created_at INTEGER NOT NULL,
 request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, UNIQUE(company_id,credential_id,request_key),
 PRIMARY KEY(company_id,id), FOREIGN KEY(company_id,person_id) REFERENCES env_people(company_id,id),
 FOREIGN KEY(company_id,rate_id) REFERENCES env_rate_proposals(company_id,id)
);
INSERT INTO env_run_drafts_archive SELECT * FROM env_run_drafts;
DROP TABLE env_run_drafts;
ALTER TABLE env_run_drafts_archive RENAME TO env_run_drafts;
CREATE TRIGGER env_draft_no_update BEFORE UPDATE ON env_run_drafts BEGIN SELECT RAISE(ABORT,'immutable_draft'); END;
CREATE TRIGGER env_draft_no_delete BEFORE DELETE ON env_run_drafts BEGIN SELECT RAISE(ABORT,'immutable_draft'); END;
DROP TRIGGER env_agent_log_no_update;
DROP TRIGGER env_agent_log_no_delete;
CREATE TABLE env_agent_access_archive (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL, credential_id TEXT NOT NULL REFERENCES env_agent_history(id),
 sponsor_id TEXT NOT NULL REFERENCES oa_operators(id), action TEXT NOT NULL, target_id TEXT NOT NULL,
 occurred_at INTEGER NOT NULL
);
INSERT INTO env_agent_access_archive SELECT * FROM env_agent_access;
DROP TABLE env_agent_access;
ALTER TABLE env_agent_access_archive RENAME TO env_agent_access;
CREATE TRIGGER env_agent_log_no_update BEFORE UPDATE ON env_agent_access BEGIN SELECT RAISE(ABORT,'immutable_agent_log'); END;
CREATE TRIGGER env_agent_log_no_delete BEFORE DELETE ON env_agent_access BEGIN SELECT RAISE(ABORT,'immutable_agent_log'); END;
