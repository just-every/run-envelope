-- Ephemeral approval capability. Archive history cannot activate a transfer.
CREATE TABLE env_new_hire_authority (
 company_id TEXT NOT NULL, person_id TEXT NOT NULL, report_id TEXT NOT NULL,
 version INTEGER NOT NULL, session_id TEXT NOT NULL,
 PRIMARY KEY(company_id,report_id,version),
 FOREIGN KEY(company_id,person_id) REFERENCES env_people(company_id,id)
);
