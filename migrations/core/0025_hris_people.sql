-- A reviewed source worker maps to one payroll-required person, across replay.
CREATE TABLE env_hris_people (
 company_id TEXT NOT NULL REFERENCES env_companies(id), source_key TEXT NOT NULL,
 source_id TEXT NOT NULL, person_id TEXT NOT NULL, change_id TEXT NOT NULL UNIQUE,
 PRIMARY KEY(company_id,source_key), UNIQUE(company_id,person_id)
);
