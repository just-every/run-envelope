-- Retain exact approval authority as history without reviving archived sessions.
-- Existing decisions have no inferred authority; fresh preparation needs review.
CREATE TABLE env_workspace_decision_authority (
 company_id TEXT NOT NULL, kind TEXT NOT NULL, object_id TEXT NOT NULL,
 version INTEGER NOT NULL, decision TEXT NOT NULL,
 session_id TEXT NOT NULL, grant_version INTEGER NOT NULL,
 PRIMARY KEY(company_id,kind,object_id,version,decision),
 FOREIGN KEY(company_id,kind,object_id,version,decision)
   REFERENCES env_workspace_decisions(company_id,kind,object_id,version,decision)
);

CREATE TRIGGER env_workspace_decision_authority_update BEFORE UPDATE ON env_workspace_decision_authority
BEGIN SELECT RAISE(ABORT,'immutable_approval_authority'); END;
CREATE TRIGGER env_workspace_decision_authority_delete BEFORE DELETE ON env_workspace_decision_authority
WHEN NOT EXISTS(SELECT 1 FROM env_privacy_guard WHERE company_id=OLD.company_id AND table_name='env_workspace_decision_authority')
BEGIN SELECT RAISE(ABORT,'immutable_approval_authority'); END;
CREATE TRIGGER env_workspace_decision_authority_privacy_insert AFTER INSERT ON env_workspace_decision_authority
BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(NEW.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
CREATE TRIGGER env_workspace_decision_authority_privacy_delete AFTER DELETE ON env_workspace_decision_authority
BEGIN INSERT INTO env_privacy_epochs(company_id,version) VALUES(OLD.company_id,1) ON CONFLICT(company_id) DO UPDATE SET version=version+1; END;
