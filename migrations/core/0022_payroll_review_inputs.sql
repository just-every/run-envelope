-- Comparisons bind the input collections they read, including newly added IDs.
-- A later input change invalidates pending review, not an adopted rate's history.
CREATE TABLE env_workspace_review_inputs (
 company_id TEXT NOT NULL, kind TEXT NOT NULL, object_id TEXT NOT NULL,
 version INTEGER NOT NULL, source_kind TEXT NOT NULL, source_person_id TEXT NOT NULL,
 except_id TEXT NOT NULL, versions INTEGER NOT NULL, decisions INTEGER NOT NULL,
 PRIMARY KEY(company_id,kind,object_id,version,source_kind,source_person_id,except_id),
 FOREIGN KEY(company_id,kind,object_id,version) REFERENCES env_workspace_versions(company_id,kind,object_id,version)
);
CREATE TRIGGER env_workspace_review_inputs_update BEFORE UPDATE ON env_workspace_review_inputs BEGIN SELECT RAISE(ABORT,'immutable_review_inputs'); END;
CREATE TRIGGER env_workspace_review_inputs_delete BEFORE DELETE ON env_workspace_review_inputs BEGIN SELECT RAISE(ABORT,'immutable_review_inputs'); END;
