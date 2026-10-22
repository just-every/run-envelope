-- One row per distinct human approver of one immutable earnings-run version.
-- The row binds the exact content digest, the approver's grant version, role and
-- native session. Release rechecks every binding; nothing here moves money.
CREATE TABLE env_run_approvals (
 company_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind='earnings-run'),
 run_id TEXT NOT NULL, version INTEGER NOT NULL,
 approver_id TEXT NOT NULL REFERENCES oa_operators(id), role TEXT NOT NULL,
 grant_version INTEGER NOT NULL, session_id TEXT NOT NULL,
 content_digest TEXT NOT NULL, debit_cents INTEGER NOT NULL,
 occurred_at INTEGER NOT NULL, change_id TEXT NOT NULL UNIQUE,
 PRIMARY KEY(company_id,run_id,version,approver_id),
 FOREIGN KEY(company_id,kind,run_id,version) REFERENCES env_workspace_versions(company_id,kind,object_id,version)
);
CREATE TRIGGER env_run_approvals_update BEFORE UPDATE ON env_run_approvals BEGIN SELECT RAISE(ABORT,'immutable_run_approval'); END;
CREATE TRIGGER env_run_approvals_delete BEFORE DELETE ON env_run_approvals BEGIN SELECT RAISE(ABORT,'immutable_run_approval'); END;
