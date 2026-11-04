-- Classification belongs to the audited native selection and carries no payload.
CREATE TABLE env_native_action_facts (
 audit_id TEXT PRIMARY KEY REFERENCES env_audit(id),
 classification TEXT NOT NULL CHECK(json_valid(classification))
);
CREATE TRIGGER env_native_action_facts_no_update BEFORE UPDATE ON env_native_action_facts
BEGIN SELECT RAISE(ABORT,'immutable_native_action_facts'); END;
CREATE TRIGGER env_native_action_facts_no_delete BEFORE DELETE ON env_native_action_facts
BEGIN SELECT RAISE(ABORT,'immutable_native_action_facts'); END;
