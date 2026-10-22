-- Review-dated grants and short-lived rotating secrets are separate authority.
ALTER TABLE env_agent_grants ADD COLUMN revocation_id TEXT;
ALTER TABLE env_agent_credentials ADD COLUMN secret_expires_at INTEGER NOT NULL DEFAULT 0;
UPDATE env_agent_credentials SET secret_expires_at=(SELECT expires_at FROM env_agent_grants g WHERE g.id=env_agent_credentials.id);
CREATE TABLE env_agent_policy(company_id TEXT PRIMARY KEY REFERENCES env_companies(id),owner_only INTEGER NOT NULL CHECK(owner_only IN (0,1)),version INTEGER NOT NULL,change_id TEXT NOT NULL);
CREATE TABLE env_external_providers(
 company_id TEXT NOT NULL REFERENCES env_companies(id),id TEXT NOT NULL CHECK(id IN ('openai','resend')),
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),secret_cipher TEXT NOT NULL,sender TEXT NOT NULL,
 version INTEGER NOT NULL,change_id TEXT NOT NULL,PRIMARY KEY(company_id,id)
);
CREATE TABLE env_notices(
 company_id TEXT NOT NULL,id TEXT NOT NULL,location_id TEXT NOT NULL,reference TEXT NOT NULL,cipher TEXT NOT NULL,digest TEXT NOT NULL,
 created_by TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(company_id,id),
 FOREIGN KEY(company_id,location_id) REFERENCES env_locations(company_id,id)
);
CREATE TABLE env_notice_analysis(
 company_id TEXT NOT NULL,notice_id TEXT NOT NULL,id TEXT NOT NULL,credential_id TEXT NOT NULL,
 provider_version INTEGER NOT NULL,cipher TEXT NOT NULL,created_at INTEGER NOT NULL,
 PRIMARY KEY(company_id,id),FOREIGN KEY(company_id,notice_id) REFERENCES env_notices(company_id,id)
);
CREATE TABLE env_notice_replies(
 company_id TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,notice_id TEXT NOT NULL,
 provider_version INTEGER NOT NULL,cipher TEXT NOT NULL,digest TEXT NOT NULL,created_by TEXT NOT NULL,created_at INTEGER NOT NULL,change_id TEXT NOT NULL,
 PRIMARY KEY(company_id,id,version),FOREIGN KEY(company_id,notice_id) REFERENCES env_notices(company_id,id)
);
CREATE TABLE env_notice_reviews(
 token_hash TEXT PRIMARY KEY,company_id TEXT NOT NULL,reply_id TEXT NOT NULL,version INTEGER NOT NULL,
 session_id TEXT NOT NULL,operator_id TEXT NOT NULL,grant_version INTEGER NOT NULL,expires_at INTEGER NOT NULL
);
CREATE TABLE env_notice_approvals(
 company_id TEXT NOT NULL,reply_id TEXT NOT NULL,version INTEGER NOT NULL,digest TEXT NOT NULL,
 actor_id TEXT NOT NULL,operator_version INTEGER NOT NULL,grant_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,revoked_at INTEGER,created_at INTEGER NOT NULL,change_id TEXT NOT NULL,
 PRIMARY KEY(company_id,reply_id,version)
);
CREATE TABLE env_notice_dispatches(
 company_id TEXT NOT NULL,reply_id TEXT NOT NULL,version INTEGER NOT NULL,digest TEXT NOT NULL,
 id TEXT NOT NULL UNIQUE,credential_id TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','accepted','rejected','unknown')),
 provider_receipt TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
 PRIMARY KEY(company_id,reply_id,version),FOREIGN KEY(company_id,reply_id,version) REFERENCES env_notice_replies(company_id,id,version)
);
CREATE TRIGGER env_notice_immutable BEFORE UPDATE ON env_notices BEGIN SELECT RAISE(ABORT,'immutable_notice'); END;
CREATE TRIGGER env_reply_immutable BEFORE UPDATE ON env_notice_replies BEGIN SELECT RAISE(ABORT,'immutable_reply'); END;
CREATE TRIGGER env_analysis_immutable BEFORE UPDATE ON env_notice_analysis BEGIN SELECT RAISE(ABORT,'immutable_analysis'); END;
