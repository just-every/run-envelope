CREATE TABLE env_notice_case_versions (
 company_id TEXT NOT NULL, notice_id TEXT NOT NULL, version INTEGER NOT NULL,
 cipher TEXT NOT NULL, digest TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL, change_id TEXT NOT NULL UNIQUE,
 PRIMARY KEY(company_id,notice_id,version), FOREIGN KEY(company_id,notice_id) REFERENCES env_notices(company_id,id)
);
CREATE TRIGGER env_notice_case_immutable_update BEFORE UPDATE ON env_notice_case_versions BEGIN SELECT RAISE(ABORT,'immutable_notice_case'); END;
CREATE TRIGGER env_notice_case_immutable_delete BEFORE DELETE ON env_notice_case_versions BEGIN SELECT RAISE(ABORT,'immutable_notice_case'); END;
