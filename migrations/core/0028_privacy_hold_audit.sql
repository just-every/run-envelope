CREATE TABLE env_privacy_hold_events (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES env_companies(id), fingerprint TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('recorded','released')), basis TEXT NOT NULL, custodian TEXT NOT NULL,
 release_date TEXT NOT NULL, evidence TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES oa_operators(id), occurred_at INTEGER NOT NULL
);
CREATE TRIGGER env_privacy_hold_event_update BEFORE UPDATE ON env_privacy_hold_events BEGIN SELECT RAISE(ABORT,'immutable_hold_event'); END;
CREATE TRIGGER env_privacy_hold_event_delete BEFORE DELETE ON env_privacy_hold_events BEGIN SELECT RAISE(ABORT,'immutable_hold_event'); END;
