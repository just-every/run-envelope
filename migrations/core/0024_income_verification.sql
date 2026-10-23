-- Worker consent is a native-session decision, separate from payroll approval.
CREATE TABLE env_verification_consents (
 company_id TEXT NOT NULL REFERENCES env_companies(id), id TEXT NOT NULL,
 person_id TEXT NOT NULL, worker_id TEXT NOT NULL REFERENCES oa_operators(id),
 requester_id TEXT NOT NULL REFERENCES oa_operators(id), binding_id TEXT NOT NULL,
 binding_version INTEGER NOT NULL, cipher TEXT NOT NULL,
 created_session TEXT NOT NULL, created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL, revoked_at INTEGER, revocation_id TEXT, change_id TEXT NOT NULL UNIQUE,
 PRIMARY KEY(company_id,id), FOREIGN KEY(company_id,person_id) REFERENCES env_people(company_id,id)
);
CREATE TABLE env_verification_releases (
 company_id TEXT NOT NULL, id TEXT NOT NULL, consent_id TEXT NOT NULL,
 disclosure_id TEXT NOT NULL, disclosure_version INTEGER NOT NULL,
 token_hash TEXT NOT NULL UNIQUE, requester_id TEXT NOT NULL REFERENCES oa_operators(id),
 issued_by TEXT NOT NULL REFERENCES oa_operators(id), issued_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL, opened_at INTEGER, acknowledged_at INTEGER,
 PRIMARY KEY(company_id,id), UNIQUE(company_id,disclosure_id,disclosure_version),
 FOREIGN KEY(company_id,consent_id) REFERENCES env_verification_consents(company_id,id)
);
CREATE TABLE env_verification_corrections (
 company_id TEXT NOT NULL, id TEXT NOT NULL, consent_id TEXT NOT NULL,
 worker_id TEXT NOT NULL REFERENCES oa_operators(id), cipher TEXT NOT NULL,
 created_at INTEGER NOT NULL, PRIMARY KEY(company_id,id),
 FOREIGN KEY(company_id,consent_id) REFERENCES env_verification_consents(company_id,id)
);
CREATE TRIGGER env_verification_consent_immutable BEFORE UPDATE OF company_id,id,person_id,worker_id,requester_id,binding_id,binding_version,cipher,created_session,created_at,expires_at,change_id ON env_verification_consents BEGIN SELECT RAISE(ABORT,'immutable_verification_consent'); END;
CREATE TRIGGER env_verification_no_consent_delete BEFORE DELETE ON env_verification_consents BEGIN SELECT RAISE(ABORT,'immutable_verification_consent'); END;
