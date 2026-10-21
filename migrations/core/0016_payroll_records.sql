-- Payroll authority is distinct from Base authentication. No provider effects.
CREATE TABLE env_companies (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, ein_cipher TEXT NOT NULL, ein_suffix TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES oa_operators(id), created_at INTEGER NOT NULL
);
CREATE TABLE env_locations (
 company_id TEXT NOT NULL REFERENCES env_companies(id), id TEXT NOT NULL, name TEXT NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE TABLE env_grants (
 company_id TEXT NOT NULL REFERENCES env_companies(id), operator_id TEXT NOT NULL REFERENCES oa_operators(id),
 role TEXT NOT NULL CHECK(role IN ('owner','payroll-admin','preparer','approver','accountant','viewer','employee','contractor')),
 locations TEXT NOT NULL CHECK(json_valid(locations)), fields TEXT NOT NULL CHECK(json_valid(fields)),
 actions TEXT NOT NULL CHECK(json_valid(actions)), version INTEGER NOT NULL DEFAULT 1, revoked_at INTEGER, change_id TEXT,
 PRIMARY KEY(company_id,operator_id)
);
CREATE TABLE env_people (
 company_id TEXT NOT NULL, id TEXT NOT NULL, location_id TEXT NOT NULL, name TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, change_id TEXT NOT NULL,
 PRIMARY KEY(company_id,id), FOREIGN KEY(company_id,location_id) REFERENCES env_locations(company_id,id)
);
CREATE TABLE env_private_records (
 company_id TEXT NOT NULL, person_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('ssn','bank','tax')),
 cipher TEXT NOT NULL, version INTEGER NOT NULL, change_id TEXT NOT NULL,
 PRIMARY KEY(company_id,person_id,kind), FOREIGN KEY(company_id,person_id) REFERENCES env_people(company_id,id)
);
CREATE TABLE env_rate_proposals (
 company_id TEXT NOT NULL, id TEXT NOT NULL, person_id TEXT NOT NULL, person_version INTEGER NOT NULL,
 hourly_cents INTEGER NOT NULL CHECK(hourly_cents>0), effective_date TEXT NOT NULL,
 proposed_by TEXT NOT NULL REFERENCES oa_operators(id), created_at INTEGER NOT NULL,
 approved_by TEXT REFERENCES oa_operators(id), approved_at INTEGER, change_id TEXT,
 PRIMARY KEY(company_id,id), FOREIGN KEY(company_id,person_id) REFERENCES env_people(company_id,id)
);
CREATE TABLE env_audit (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES env_companies(id),
 actor_id TEXT NOT NULL REFERENCES oa_operators(id), action TEXT NOT NULL, target_id TEXT NOT NULL,
 version INTEGER NOT NULL, occurred_at INTEGER NOT NULL
);
CREATE INDEX env_audit_company ON env_audit(company_id,occurred_at);
-- Records and rates are append-only evidence. Grant revocation invalidates old
-- sessions even after later re-granting. A fresh sign-in is still required.
CREATE TRIGGER env_revoke_sessions AFTER UPDATE ON env_grants
 BEGIN
 UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,unixepoch('subsec')*1000) WHERE operator_id=NEW.operator_id;
 END;
CREATE TRIGGER env_no_audit_update BEFORE UPDATE ON env_audit BEGIN SELECT RAISE(ABORT,'immutable_audit'); END;
CREATE TRIGGER env_no_audit_delete BEFORE DELETE ON env_audit BEGIN SELECT RAISE(ABORT,'immutable_audit'); END;
CREATE TRIGGER env_no_proposal_change BEFORE UPDATE OF person_id,person_version,hourly_cents,effective_date,proposed_by ON env_rate_proposals
 BEGIN SELECT RAISE(ABORT,'immutable_proposal'); END;
CREATE TABLE env_rate_reviews (
 token_hash TEXT PRIMARY KEY, company_id TEXT NOT NULL, proposal_id TEXT NOT NULL,
 session_id TEXT NOT NULL, operator_id TEXT NOT NULL, grant_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL, FOREIGN KEY(company_id,proposal_id) REFERENCES env_rate_proposals(company_id,id)
);
