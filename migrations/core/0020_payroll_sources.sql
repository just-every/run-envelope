-- Pins are checked inside revision creation and exact human decisions.
CREATE TABLE env_workspace_people (
 company_id TEXT NOT NULL, kind TEXT NOT NULL, object_id TEXT NOT NULL, version INTEGER NOT NULL,
 person_id TEXT NOT NULL, person_version INTEGER NOT NULL,
 PRIMARY KEY(company_id,kind,object_id,version,person_id),
 FOREIGN KEY(company_id,kind,object_id,version) REFERENCES env_workspace_versions(company_id,kind,object_id,version),
 FOREIGN KEY(company_id,person_id) REFERENCES env_people(company_id,id)
);
CREATE TABLE env_workspace_dependencies (
 company_id TEXT NOT NULL, kind TEXT NOT NULL, object_id TEXT NOT NULL, version INTEGER NOT NULL,
 source_kind TEXT NOT NULL, source_id TEXT NOT NULL, source_version INTEGER NOT NULL,
 needs_approval INTEGER NOT NULL CHECK(needs_approval IN (0,1)),
 PRIMARY KEY(company_id,kind,object_id,version,source_kind,source_id),
 FOREIGN KEY(company_id,kind,object_id,version) REFERENCES env_workspace_versions(company_id,kind,object_id,version),
 FOREIGN KEY(company_id,source_kind,source_id,source_version) REFERENCES env_workspace_versions(company_id,kind,object_id,version)
);
CREATE TRIGGER env_workspace_people_update BEFORE UPDATE ON env_workspace_people BEGIN SELECT RAISE(ABORT,'immutable_source_pin'); END;
CREATE TRIGGER env_workspace_people_delete BEFORE DELETE ON env_workspace_people BEGIN SELECT RAISE(ABORT,'immutable_source_pin'); END;
CREATE TRIGGER env_workspace_dependencies_update BEFORE UPDATE ON env_workspace_dependencies BEGIN SELECT RAISE(ABORT,'immutable_source_pin'); END;
CREATE TRIGGER env_workspace_dependencies_delete BEFORE DELETE ON env_workspace_dependencies BEGIN SELECT RAISE(ABORT,'immutable_source_pin'); END;
