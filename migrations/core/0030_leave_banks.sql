-- A legacy combined bank cannot coexist with independent banks for one person.
CREATE TRIGGER env_leave_bank_exclusion BEFORE INSERT ON env_workspace_versions
WHEN NEW.kind='leave-account' AND EXISTS(
  SELECT 1 FROM env_workspace_versions v WHERE v.company_id=NEW.company_id
  AND v.person_id=NEW.person_id AND v.kind=NEW.kind AND v.object_id!=NEW.object_id
  AND (v.object_id='leave-'||NEW.person_id OR NEW.object_id='leave-'||NEW.person_id)
)
BEGIN
  SELECT RAISE(IGNORE);
END;
