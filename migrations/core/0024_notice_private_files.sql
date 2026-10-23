CREATE TABLE env_private_files (
 company_id TEXT NOT NULL, notice_id TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL,
 name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('application/pdf','text/html','text/plain')),
 bytes INTEGER NOT NULL CHECK(bytes>0 AND bytes<=32768), digest TEXT NOT NULL, cipher TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at INTEGER NOT NULL, change_id TEXT NOT NULL UNIQUE,
 PRIMARY KEY(company_id,id,version), FOREIGN KEY(company_id,notice_id) REFERENCES env_notices(company_id,id)
);
CREATE TRIGGER env_private_file_no_update BEFORE UPDATE ON env_private_files BEGIN SELECT RAISE(ABORT,'immutable_private_file'); END;
