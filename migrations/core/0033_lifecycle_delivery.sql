-- Only real native proposal events exist. No payment or filing event is synthesized.
CREATE TABLE env_webhooks (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES env_companies(id),
 owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL, grant_version INTEGER NOT NULL,
 destination TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE TABLE env_webhook_keys (
 id TEXT PRIMARY KEY REFERENCES env_webhooks(id), secret_cipher TEXT NOT NULL
);
CREATE TABLE env_lifecycle_events (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES env_companies(id),
 proposal_id TEXT NOT NULL, occurred_at INTEGER NOT NULL,
 UNIQUE(company_id,proposal_id),
 FOREIGN KEY(company_id,proposal_id) REFERENCES env_run_drafts(company_id,id)
);
CREATE TABLE env_webhook_jobs (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL, webhook_id TEXT NOT NULL REFERENCES env_webhooks(id),
 event_id TEXT NOT NULL REFERENCES env_lifecycle_events(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','failed','unknown','delivered')),
 attempt INTEGER NOT NULL DEFAULT 0, started_at INTEGER, finished_at INTEGER,
 claim_id TEXT, UNIQUE(webhook_id,event_id)
);
CREATE TABLE env_webhook_attempts (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES env_companies(id), job_id TEXT NOT NULL REFERENCES env_webhook_jobs(id),
 attempt INTEGER NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER,
 outcome TEXT NOT NULL, http_status INTEGER, UNIQUE(job_id,attempt)
);
CREATE TRIGGER env_proposal_lifecycle AFTER INSERT ON env_run_drafts BEGIN
 INSERT INTO env_lifecycle_events(id,company_id,proposal_id,occurred_at)
 VALUES(NEW.id,NEW.company_id,NEW.id,NEW.created_at);
 INSERT INTO env_webhook_jobs(id,company_id,webhook_id,event_id)
 SELECT lower(hex(randomblob(16))),NEW.company_id,w.id,NEW.id FROM env_webhooks w
 WHERE w.company_id=NEW.company_id AND w.active=1;
END;
CREATE INDEX env_webhook_company_jobs ON env_webhook_jobs(company_id,id);
CREATE TRIGGER env_lifecycle_immutable_update BEFORE UPDATE ON env_lifecycle_events BEGIN SELECT RAISE(ABORT,'immutable_lifecycle_event'); END;
CREATE TRIGGER env_lifecycle_immutable_delete BEFORE DELETE ON env_lifecycle_events WHEN NOT EXISTS(SELECT 1 FROM env_privacy_guard WHERE company_id=OLD.company_id AND table_name='env_lifecycle_events') BEGIN SELECT RAISE(ABORT,'immutable_lifecycle_event'); END;
CREATE TRIGGER env_webhooks_privacy_insert AFTER INSERT ON env_webhooks BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(NEW.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER env_webhooks_privacy_update AFTER UPDATE ON env_webhooks BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(NEW.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER env_webhooks_privacy_delete AFTER DELETE ON env_webhooks BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(OLD.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER env_lifecycle_events_privacy_insert AFTER INSERT ON env_lifecycle_events BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(NEW.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER env_lifecycle_events_privacy_update AFTER UPDATE ON env_lifecycle_events BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(NEW.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER env_lifecycle_events_privacy_delete AFTER DELETE ON env_lifecycle_events BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(OLD.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER env_webhook_jobs_privacy_insert AFTER INSERT ON env_webhook_jobs BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(NEW.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER env_webhook_jobs_privacy_update AFTER UPDATE ON env_webhook_jobs BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(NEW.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER env_webhook_jobs_privacy_delete AFTER DELETE ON env_webhook_jobs BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(OLD.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER env_webhook_attempts_privacy_insert AFTER INSERT ON env_webhook_attempts BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(NEW.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER env_webhook_attempts_privacy_update AFTER UPDATE ON env_webhook_attempts BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(NEW.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER env_webhook_attempts_privacy_delete AFTER DELETE ON env_webhook_attempts BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(OLD.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
