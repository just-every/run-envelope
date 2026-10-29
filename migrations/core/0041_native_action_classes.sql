-- Derived facts remain separate from the immutable original audit rows.
CREATE TABLE env_access_changes (
 company_id TEXT NOT NULL REFERENCES env_companies(id), target_id TEXT NOT NULL,
 target_kind TEXT NOT NULL, source_change TEXT NOT NULL, operator_id TEXT NOT NULL REFERENCES oa_operators(id),
 version INTEGER NOT NULL, direction TEXT NOT NULL,
 people_count INTEGER NOT NULL CHECK(people_count>=0),
 PRIMARY KEY(source_change,target_id,target_kind)
);
CREATE TABLE env_agent_call_facts (
 call_id TEXT PRIMARY KEY REFERENCES env_agent_call_audit(id),
 facts TEXT NOT NULL CHECK(json_valid(facts))
);
CREATE TRIGGER env_agent_call_facts_no_update BEFORE UPDATE ON env_agent_call_facts
BEGIN SELECT RAISE(ABORT,'immutable_agent_call_facts'); END;
CREATE TRIGGER env_agent_call_facts_no_delete BEFORE DELETE ON env_agent_call_facts
BEGIN SELECT RAISE(ABORT,'immutable_agent_call_facts'); END;
CREATE TRIGGER env_access_changes_no_update BEFORE UPDATE ON env_access_changes
BEGIN SELECT RAISE(ABORT,'immutable_access_facts'); END;
CREATE TRIGGER env_access_changes_no_delete BEFORE DELETE ON env_access_changes
BEGIN SELECT RAISE(ABORT,'immutable_access_facts'); END;
CREATE TRIGGER env_grants_class_insert AFTER INSERT ON env_grants WHEN NEW.change_id IS NOT NULL
BEGIN
 INSERT INTO env_access_changes VALUES(NEW.company_id,NEW.operator_id,'human',NEW.change_id,NEW.operator_id,NEW.version,'grant',1);
END;
CREATE TRIGGER env_grants_class_update AFTER UPDATE ON env_grants
WHEN NEW.version!=OLD.version
BEGIN
 INSERT INTO env_access_changes VALUES(NEW.company_id,NEW.operator_id,'human',NEW.change_id,NEW.operator_id,NEW.version,
 CASE WHEN NEW.revoked_at IS NOT NULL THEN 'revoke'
      WHEN OLD.revoked_at IS NOT NULL THEN 'grant'
      WHEN (EXISTS(SELECT 1 FROM json_each(NEW.actions) n WHERE NOT EXISTS(SELECT 1 FROM json_each(OLD.actions) o WHERE o.value=n.value)) OR EXISTS(SELECT 1 FROM json_each(NEW.fields) n WHERE NOT EXISTS(SELECT 1 FROM json_each(OLD.fields) o WHERE o.value=n.value)) OR (NOT EXISTS(SELECT 1 FROM json_each(OLD.locations) WHERE value='*') AND EXISTS(SELECT 1 FROM json_each(NEW.locations) n WHERE NOT EXISTS(SELECT 1 FROM json_each(OLD.locations) o WHERE o.value=n.value))) OR OLD.role!=NEW.role) AND (EXISTS(SELECT 1 FROM json_each(OLD.actions) n WHERE NOT EXISTS(SELECT 1 FROM json_each(NEW.actions) o WHERE o.value=n.value)) OR EXISTS(SELECT 1 FROM json_each(OLD.fields) n WHERE NOT EXISTS(SELECT 1 FROM json_each(NEW.fields) o WHERE o.value=n.value)) OR (NOT EXISTS(SELECT 1 FROM json_each(NEW.locations) WHERE value='*') AND EXISTS(SELECT 1 FROM json_each(OLD.locations) n WHERE NOT EXISTS(SELECT 1 FROM json_each(NEW.locations) o WHERE o.value=n.value))) OR NEW.role!=OLD.role) THEN 'widen-and-narrow'
      WHEN (EXISTS(SELECT 1 FROM json_each(NEW.actions) n WHERE NOT EXISTS(SELECT 1 FROM json_each(OLD.actions) o WHERE o.value=n.value)) OR EXISTS(SELECT 1 FROM json_each(NEW.fields) n WHERE NOT EXISTS(SELECT 1 FROM json_each(OLD.fields) o WHERE o.value=n.value)) OR (NOT EXISTS(SELECT 1 FROM json_each(OLD.locations) WHERE value='*') AND EXISTS(SELECT 1 FROM json_each(NEW.locations) n WHERE NOT EXISTS(SELECT 1 FROM json_each(OLD.locations) o WHERE o.value=n.value))) OR OLD.role!=NEW.role) THEN 'widen' WHEN (EXISTS(SELECT 1 FROM json_each(OLD.actions) n WHERE NOT EXISTS(SELECT 1 FROM json_each(NEW.actions) o WHERE o.value=n.value)) OR EXISTS(SELECT 1 FROM json_each(OLD.fields) n WHERE NOT EXISTS(SELECT 1 FROM json_each(NEW.fields) o WHERE o.value=n.value)) OR (NOT EXISTS(SELECT 1 FROM json_each(NEW.locations) WHERE value='*') AND EXISTS(SELECT 1 FROM json_each(OLD.locations) n WHERE NOT EXISTS(SELECT 1 FROM json_each(NEW.locations) o WHERE o.value=n.value))) OR NEW.role!=OLD.role) THEN 'narrow' ELSE 'unchanged' END,1);
END;
CREATE TRIGGER env_agent_grants_class_insert AFTER INSERT ON env_agent_grants WHEN NEW.expires_at>0
BEGIN
 INSERT INTO env_access_changes VALUES(NEW.company_id,NEW.id,'agent',NEW.id,NEW.sponsor_id,NEW.version,'grant',1);
END;
CREATE TRIGGER env_agent_grants_class_update AFTER UPDATE ON env_agent_grants
WHEN NEW.version!=OLD.version AND NEW.revocation_id IS NOT NULL AND NEW.revocation_id IS NOT OLD.revocation_id
BEGIN
 INSERT INTO env_access_changes VALUES(NEW.company_id,NEW.id,'agent',NEW.revocation_id,NEW.sponsor_id,NEW.version,'revoke',1);
END;
-- Views project server-derived metadata without rewriting historical evidence.
CREATE VIEW env_classified_actions AS
SELECT a.*,
 CASE WHEN a.action='agent.issued' THEN '["access","security"]'
      WHEN a.action IN ('provider.declared','identity.passkey-registered','agents.classes.configured','agents.paused','agents.resumed') THEN '["security"]'
      ELSE '["access"]' END AS classes,
 CASE WHEN d.direction IS NOT NULL THEN json_object('direction',d.direction,'peopleCount',d.people_count)
      WHEN a.action='agent.policy' THEN json_object('direction',CASE WHEN EXISTS(SELECT 1 FROM env_access_changes p WHERE p.source_change=a.id) THEN 'narrow' ELSE 'unchanged' END,
        'peopleCount',(SELECT COUNT(DISTINCT operator_id) FROM env_access_changes p WHERE p.source_change=a.id))
      ELSE '{}' END AS facts
FROM env_audit a LEFT JOIN env_access_changes d ON d.company_id=a.company_id AND d.target_id=a.target_id
 AND d.source_change=a.id AND d.version=a.version AND d.target_kind=CASE WHEN a.action LIKE 'grant.%' THEN 'human' ELSE 'agent' END
WHERE a.action IN ('grant.changed','grant.revoked','agent.issued','agent.revoked','agent.policy',
 'agents.classes.configured','agents.paused','agents.resumed','provider.declared','identity.passkey-registered');
CREATE VIEW env_installation_classified_actions AS
SELECT id,actor_id,created_at,
 CASE WHEN action='envelope.identity' THEN json_extract(value,'$.event') ELSE action END AS action,
 CASE WHEN action='envelope.identity' THEN json_extract(value,'$.classes') ELSE '["security"]' END AS classes,
 CASE WHEN action='envelope.identity' THEN CASE WHEN json_type(value,'$.direction') IS NOT NULL
 THEN json_object('direction',json_extract(value,'$.direction'),'peopleCount',json_extract(value,'$.peopleCount')) ELSE '{}' END ELSE '{}' END AS facts
FROM oa_auth_audit WHERE action IN ('envelope.identity','idpSignIn','provider:unlink');
