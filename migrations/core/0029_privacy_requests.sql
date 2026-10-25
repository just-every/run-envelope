-- Requests survive worker deletion without retaining a worker identifier.
CREATE TABLE env_privacy_requests (
 company_id TEXT NOT NULL REFERENCES env_companies(id), id TEXT NOT NULL,
 person_id TEXT, status TEXT NOT NULL CHECK(status IN ('held','completed')),
 created_at INTEGER NOT NULL, completed_at INTEGER, records_deleted INTEGER,
 PRIMARY KEY(company_id,id), UNIQUE(company_id,person_id)
);

DROP TRIGGER env_agent_log_no_update;
CREATE TRIGGER env_agent_log_no_update BEFORE UPDATE ON env_agent_access
WHEN NOT (NEW.id=OLD.id AND NEW.company_id=OLD.company_id AND NEW.credential_id=OLD.credential_id AND NEW.sponsor_id=OLD.sponsor_id AND NEW.action=OLD.action AND NEW.occurred_at=OLD.occurred_at AND EXISTS(SELECT 1 FROM env_privacy_redactions r WHERE r.company_id=OLD.company_id AND r.target_id=OLD.target_id AND r.replacement=NEW.target_id))
BEGIN SELECT RAISE(ABORT,'immutable_agent_log'); END;
DROP TRIGGER env_draft_no_delete;
CREATE TRIGGER env_draft_no_delete BEFORE DELETE ON env_run_drafts WHEN NOT EXISTS(SELECT 1 FROM env_privacy_guard WHERE company_id=OLD.company_id AND table_name='env_run_drafts') BEGIN SELECT RAISE(ABORT,'immutable_draft'); END;
DROP TRIGGER env_firm_history_delete;
CREATE TRIGGER env_firm_history_delete BEFORE DELETE ON env_firm_work_history WHEN NOT EXISTS(SELECT 1 FROM env_privacy_guard WHERE company_id=OLD.company_id AND table_name='env_firm_work_history') BEGIN SELECT RAISE(ABORT,'immutable_work_history'); END;
DROP TRIGGER env_firm_work_delete;
CREATE TRIGGER env_firm_work_delete BEFORE DELETE ON env_firm_work WHEN NOT EXISTS(SELECT 1 FROM env_privacy_guard WHERE company_id=OLD.company_id AND table_name='env_firm_work') BEGIN SELECT RAISE(ABORT,'retained_firm_work'); END;

-- Worker attribution is removed without changing an identity shared elsewhere.
DROP TRIGGER env_no_audit_update;
DROP TRIGGER env_no_audit_delete;
ALTER TABLE env_audit RENAME TO env_audit_before_privacy;
CREATE TABLE env_audit (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES env_companies(id),
 actor_id TEXT REFERENCES oa_operators(id), action TEXT NOT NULL, target_id TEXT NOT NULL,
 version INTEGER NOT NULL, occurred_at INTEGER NOT NULL
);
INSERT INTO env_audit SELECT * FROM env_audit_before_privacy;
DROP TABLE env_audit_before_privacy;
CREATE INDEX env_audit_company ON env_audit(company_id,occurred_at);
CREATE TRIGGER env_no_audit_delete BEFORE DELETE ON env_audit BEGIN SELECT RAISE(ABORT,'immutable_audit'); END;
CREATE TRIGGER env_no_audit_update BEFORE UPDATE ON env_audit
WHEN NOT (NEW.id=OLD.id AND NEW.company_id=OLD.company_id AND NEW.action=OLD.action AND NEW.version=OLD.version AND NEW.occurred_at=OLD.occurred_at
 AND (NEW.actor_id IS OLD.actor_id OR (NEW.actor_id IS NULL AND EXISTS(SELECT 1 FROM env_privacy_redactions r WHERE r.company_id=OLD.company_id AND r.target_id=OLD.actor_id)))
 AND (NEW.target_id=OLD.target_id OR EXISTS(SELECT 1 FROM env_privacy_redactions r WHERE r.company_id=OLD.company_id AND r.target_id=OLD.target_id AND r.replacement=NEW.target_id)))
BEGIN SELECT RAISE(ABORT,'immutable_audit'); END;
