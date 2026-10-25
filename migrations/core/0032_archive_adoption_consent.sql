-- Historical consent is evidence only; imported grants remain excluded.
CREATE TABLE env_archive_adoptions (
 event_id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES env_companies(id),
 company_name TEXT NOT NULL,
 actor_id TEXT NOT NULL REFERENCES oa_operators(id),
 readable_history TEXT NOT NULL CHECK(json_valid(readable_history)),
 actions TEXT NOT NULL CHECK(json_valid(actions)),
 occurred_at INTEGER NOT NULL
);
CREATE TRIGGER env_archive_adoption_immutable_update BEFORE UPDATE ON env_archive_adoptions
 BEGIN SELECT RAISE(ABORT,'immutable_archive_consent'); END;
CREATE TRIGGER env_archive_adoption_immutable_delete BEFORE DELETE ON env_archive_adoptions
 BEGIN SELECT RAISE(ABORT,'immutable_archive_consent'); END;
