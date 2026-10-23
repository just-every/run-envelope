CREATE TABLE env_privacy_requests (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES env_companies(id), person_id TEXT,
 fingerprint TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('held','complete')),
 retained TEXT NOT NULL, requested_by TEXT NOT NULL REFERENCES oa_operators(id), requested_at INTEGER NOT NULL,
 completed_at INTEGER, UNIQUE(company_id,fingerprint)
);
CREATE TABLE env_privacy_holds (
 company_id TEXT NOT NULL, person_id TEXT NOT NULL, basis TEXT NOT NULL, custodian TEXT NOT NULL,
 release_date TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL,
 released_by TEXT, released_at INTEGER, release_evidence TEXT,
 PRIMARY KEY(company_id,person_id), FOREIGN KEY(company_id,person_id) REFERENCES env_people(company_id,id)
);
CREATE TABLE env_erasure_fences (
 company_id TEXT NOT NULL, person_id TEXT NOT NULL, fingerprint TEXT NOT NULL, erased_at INTEGER NOT NULL,
 PRIMARY KEY(company_id,person_id)
);
CREATE TRIGGER env_no_resurrect_person BEFORE INSERT ON env_people
 WHEN EXISTS(SELECT 1 FROM env_erasure_fences WHERE company_id=NEW.company_id AND person_id=NEW.id)
 BEGIN SELECT RAISE(ABORT,'erased_subject'); END;
CREATE TABLE env_privacy_guard (company_id TEXT NOT NULL, person_id TEXT NOT NULL, request_id TEXT NOT NULL, valid INTEGER NOT NULL CHECK(valid=1));
DROP TRIGGER env_no_audit_update;
CREATE TRIGGER env_no_audit_update BEFORE UPDATE ON env_audit
 WHEN NOT EXISTS(SELECT 1 FROM env_privacy_guard g WHERE g.company_id=OLD.company_id AND g.person_id=OLD.target_id
 AND NEW.target_id=(SELECT fingerprint FROM env_privacy_requests WHERE id=g.request_id)
 AND NEW.id=OLD.id AND NEW.company_id=OLD.company_id AND NEW.actor_id=OLD.actor_id AND NEW.action=OLD.action AND NEW.version=OLD.version AND NEW.occurred_at=OLD.occurred_at)
 BEGIN SELECT RAISE(ABORT,'immutable_audit'); END;
DROP TRIGGER env_agent_log_no_update;
CREATE TRIGGER env_agent_log_no_update BEFORE UPDATE ON env_agent_access
 WHEN NOT EXISTS(SELECT 1 FROM env_privacy_guard g WHERE g.company_id=OLD.company_id AND g.person_id=OLD.target_id
 AND NEW.target_id=(SELECT fingerprint FROM env_privacy_requests WHERE id=g.request_id)
 AND NEW.id=OLD.id AND NEW.company_id=OLD.company_id AND NEW.credential_id=OLD.credential_id AND NEW.sponsor_id=OLD.sponsor_id AND NEW.action=OLD.action AND NEW.occurred_at=OLD.occurred_at)
 BEGIN SELECT RAISE(ABORT,'immutable_agent_log'); END;
