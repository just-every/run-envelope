CREATE TABLE env_automation_tasks (
 company_id TEXT NOT NULL,
 policy_id TEXT NOT NULL,
 occurrence TEXT NOT NULL,
 stage TEXT NOT NULL CHECK(stage IN ('hours','approval','backup','service')),
 recipient TEXT NOT NULL,
 due_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 change_id TEXT NOT NULL,
 delivery TEXT NOT NULL DEFAULT 'unavailable',
 disposition_cipher TEXT,
 disposed_by TEXT,
 disposed_at INTEGER,
 PRIMARY KEY(company_id,policy_id,occurrence,stage)
);
