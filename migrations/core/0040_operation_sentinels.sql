-- Isolated non-business diagnostic data. No worker, job or delivery authority.
-- Successful diagnostics remove their own random sentinel in one transaction.
CREATE TABLE env_operation_sentinels (
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES env_companies(id),
 probe_value TEXT NOT NULL,
 cipher TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
