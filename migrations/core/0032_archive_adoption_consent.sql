-- Historical consent is evidence only; imported grants remain excluded.
CREATE TABLE env_archive_adoptions (
 event_id TEXT PRIMARY KEY REFERENCES env_audit(id),
 company_id TEXT NOT NULL REFERENCES env_companies(id),
 company_name TEXT NOT NULL,
 readable_history TEXT NOT NULL CHECK(json_valid(readable_history)),
 actions TEXT NOT NULL CHECK(json_valid(actions))
);
CREATE TRIGGER env_archive_adoption_immutable_update BEFORE UPDATE ON env_archive_adoptions
 BEGIN SELECT RAISE(ABORT,'immutable_archive_consent'); END;
CREATE TRIGGER env_archive_adoption_immutable_delete BEFORE DELETE ON env_archive_adoptions
 BEGIN SELECT RAISE(ABORT,'immutable_archive_consent'); END;
