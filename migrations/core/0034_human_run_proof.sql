-- Installation-local authenticators and one-use exact-action challenges never restore authority.
CREATE TABLE env_passkeys (
 credential_id TEXT PRIMARY KEY, operator_id TEXT NOT NULL, operator_version INTEGER NOT NULL,
 public_key TEXT NOT NULL, counter INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE env_human_challenges (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL, operator_id TEXT NOT NULL,
 operator_version INTEGER NOT NULL, company_id TEXT NOT NULL, grant_version INTEGER NOT NULL,
 origin TEXT NOT NULL, purpose TEXT NOT NULL, challenge TEXT NOT NULL, review_hash TEXT NOT NULL,
 run_id TEXT, run_version INTEGER, run_kind TEXT NOT NULL DEFAULT 'earnings-run', content_digest TEXT NOT NULL,
 presenting_client TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 consumed_at INTEGER,
 FOREIGN KEY(company_id,run_kind,run_id,run_version) REFERENCES env_workspace_versions(company_id,kind,object_id,version)
);
ALTER TABLE env_run_approvals ADD COLUMN presenting_client TEXT NOT NULL DEFAULT 'native-envelope';
ALTER TABLE env_run_approvals ADD COLUMN proof_method TEXT NOT NULL DEFAULT 'legacy-review';
ALTER TABLE env_run_approvals ADD COLUMN authority_active INTEGER NOT NULL DEFAULT 0 CHECK(authority_active IN (0,1));
CREATE TABLE env_review_presentations (
 token_hash TEXT PRIMARY KEY, company_id TEXT NOT NULL, run_id TEXT NOT NULL,
 run_version INTEGER NOT NULL, credential_id TEXT NOT NULL, grant_version INTEGER NOT NULL,
 credential_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, run_kind TEXT NOT NULL DEFAULT 'earnings-run',
 FOREIGN KEY(company_id,run_kind,run_id,run_version) REFERENCES env_workspace_versions(company_id,kind,object_id,version)
);
ALTER TABLE env_human_challenges ADD COLUMN presentation_hash TEXT NOT NULL DEFAULT '';
