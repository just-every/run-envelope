-- Setup is effective history, never proof of agency/rail authorization.
ALTER TABLE env_locations ADD COLUMN state_code TEXT;
CREATE TABLE env_company_setup (
 company_id TEXT NOT NULL REFERENCES env_companies(id), version INTEGER NOT NULL,
 effective_date TEXT NOT NULL, cipher TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES oa_operators(id),
 created_at INTEGER NOT NULL, change_id TEXT NOT NULL UNIQUE,
 PRIMARY KEY(company_id,version)
);
CREATE TABLE env_jurisdictions (
 company_id TEXT NOT NULL REFERENCES env_companies(id), code TEXT NOT NULL, version INTEGER NOT NULL,
 effective_date TEXT NOT NULL, cipher TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES oa_operators(id),
 created_at INTEGER NOT NULL, change_id TEXT NOT NULL UNIQUE,
 PRIMARY KEY(company_id,code,version)
);
CREATE TRIGGER env_setup_no_update BEFORE UPDATE ON env_company_setup BEGIN SELECT RAISE(ABORT,'immutable_setup'); END;
CREATE TRIGGER env_setup_no_delete BEFORE DELETE ON env_company_setup BEGIN SELECT RAISE(ABORT,'immutable_setup'); END;
CREATE TRIGGER env_jurisdiction_no_update BEFORE UPDATE ON env_jurisdictions BEGIN SELECT RAISE(ABORT,'immutable_jurisdiction'); END;
CREATE TRIGGER env_jurisdiction_no_delete BEFORE DELETE ON env_jurisdictions BEGIN SELECT RAISE(ABORT,'immutable_jurisdiction'); END;
