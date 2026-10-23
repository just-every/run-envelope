CREATE TABLE env_firm_settings (
 company_id TEXT PRIMARY KEY REFERENCES env_companies(id), blotter_origin TEXT NOT NULL,
 version INTEGER NOT NULL, change_id TEXT NOT NULL, actor_id TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE env_firm_work (
 company_id TEXT NOT NULL REFERENCES env_companies(id), id TEXT NOT NULL, work_kind TEXT NOT NULL,
 source_kind TEXT NOT NULL CHECK(source_kind IN ('earnings-run','notice','registration')),
 source_id TEXT NOT NULL, source_version INTEGER NOT NULL, location_id TEXT,
 action TEXT NOT NULL, fields TEXT NOT NULL CHECK(json_valid(fields)),
 assignee_id TEXT NOT NULL, backup_id TEXT, handoff_recipient TEXT,
 handoff_state TEXT NOT NULL DEFAULT 'open' CHECK(handoff_state IN ('open','pending-handoff','acknowledged','recipient-changed')),
 cipher TEXT NOT NULL, version INTEGER NOT NULL, created_by TEXT NOT NULL,
 actor_id TEXT, authority_subject TEXT, event TEXT NOT NULL, change_id TEXT NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE TABLE env_firm_work_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL, work_id TEXT NOT NULL,
 version INTEGER NOT NULL, cipher TEXT NOT NULL, assignee_id TEXT NOT NULL, backup_id TEXT,
 handoff_recipient TEXT, handoff_state TEXT NOT NULL, actor_id TEXT, authority_subject TEXT,
 event TEXT NOT NULL, occurred_at INTEGER NOT NULL, assignee_name TEXT NOT NULL, backup_name TEXT, actor_name TEXT, authority_subject_name TEXT,
 FOREIGN KEY(company_id,work_id) REFERENCES env_firm_work(company_id,id)
);
CREATE VIEW env_firm_work_eligible AS
 SELECT w.company_id,w.id AS work_id,g.operator_id,g.role FROM env_firm_work w
 JOIN env_grants g ON g.company_id=w.company_id JOIN oa_operators o ON o.id=g.operator_id
 WHERE g.revoked_at IS NULL AND o.status='active' AND (g.role='owner' OR (
 EXISTS(SELECT 1 FROM json_each(g.actions) WHERE value='records:write') AND
 EXISTS(SELECT 1 FROM json_each(g.actions) WHERE value=w.action) AND
 EXISTS(SELECT 1 FROM json_each(g.locations) WHERE value='*' OR value=w.location_id) AND
 NOT EXISTS(SELECT 1 FROM json_each(w.fields) f WHERE NOT EXISTS(SELECT 1 FROM json_each(g.fields) WHERE value=f.value))));
CREATE TRIGGER env_firm_work_insert BEFORE INSERT ON env_firm_work BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM env_grants g JOIN oa_operators o ON o.id=g.operator_id WHERE g.company_id=NEW.company_id AND g.role='owner' AND g.revoked_at IS NULL AND o.status='active') THEN RAISE(ABORT,'firm_work_owner_required') END;
END;
CREATE TRIGGER env_firm_work_valid_insert AFTER INSERT ON env_firm_work BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM env_firm_work_eligible WHERE company_id=NEW.company_id AND work_id=NEW.id AND operator_id=NEW.assignee_id) OR (NEW.backup_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM env_firm_work_eligible WHERE company_id=NEW.company_id AND work_id=NEW.id AND operator_id=NEW.backup_id)) THEN RAISE(ABORT,'firm_work_recipient_required') END;
 INSERT INTO env_firm_work_history(company_id,work_id,version,cipher,assignee_id,backup_id,handoff_recipient,handoff_state,actor_id,authority_subject,event,occurred_at,assignee_name,backup_name,actor_name,authority_subject_name)
 VALUES(NEW.company_id,NEW.id,NEW.version,NEW.cipher,NEW.assignee_id,NEW.backup_id,NEW.handoff_recipient,NEW.handoff_state,NEW.actor_id,NEW.authority_subject,NEW.event,NEW.updated_at,(SELECT display_name FROM oa_operators WHERE id=NEW.assignee_id),(SELECT display_name FROM oa_operators WHERE id=NEW.backup_id),(SELECT display_name FROM oa_operators WHERE id=NEW.actor_id),(SELECT display_name FROM oa_operators WHERE id=NEW.authority_subject));
END;
CREATE TRIGGER env_firm_work_update BEFORE UPDATE ON env_firm_work BEGIN
 SELECT CASE WHEN NEW.company_id!=OLD.company_id OR NEW.id!=OLD.id OR NEW.work_kind!=OLD.work_kind OR NEW.source_kind!=OLD.source_kind OR NEW.source_id!=OLD.source_id OR NEW.source_version!=OLD.source_version OR NEW.location_id IS NOT OLD.location_id OR NEW.action!=OLD.action OR NEW.fields!=OLD.fields OR NEW.created_by!=OLD.created_by OR NEW.version!=OLD.version+1 THEN RAISE(ABORT,'immutable_work_source') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM env_firm_work_eligible WHERE company_id=NEW.company_id AND work_id=NEW.id AND role='owner') THEN RAISE(ABORT,'firm_work_owner_required') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM env_firm_work_eligible WHERE company_id=NEW.company_id AND work_id=NEW.id AND operator_id=NEW.assignee_id) OR (NEW.backup_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM env_firm_work_eligible WHERE company_id=NEW.company_id AND work_id=NEW.id AND operator_id=NEW.backup_id)) THEN RAISE(ABORT,'firm_work_recipient_required') END;
END;
CREATE TRIGGER env_firm_work_history_record AFTER UPDATE ON env_firm_work BEGIN
 INSERT INTO env_firm_work_history(company_id,work_id,version,cipher,assignee_id,backup_id,handoff_recipient,handoff_state,actor_id,authority_subject,event,occurred_at,assignee_name,backup_name,actor_name,authority_subject_name)
 VALUES(NEW.company_id,NEW.id,NEW.version,NEW.cipher,NEW.assignee_id,NEW.backup_id,NEW.handoff_recipient,NEW.handoff_state,NEW.actor_id,NEW.authority_subject,NEW.event,NEW.updated_at,(SELECT display_name FROM oa_operators WHERE id=NEW.assignee_id),(SELECT display_name FROM oa_operators WHERE id=NEW.backup_id),(SELECT display_name FROM oa_operators WHERE id=NEW.actor_id),(SELECT display_name FROM oa_operators WHERE id=NEW.authority_subject));
END;
CREATE TRIGGER env_firm_history_update BEFORE UPDATE ON env_firm_work_history BEGIN SELECT RAISE(ABORT,'immutable_work_history'); END;
CREATE TRIGGER env_firm_history_delete BEFORE DELETE ON env_firm_work_history BEGIN SELECT RAISE(ABORT,'immutable_work_history'); END;
CREATE TRIGGER env_firm_work_delete BEFORE DELETE ON env_firm_work BEGIN SELECT RAISE(ABORT,'retained_firm_work'); END;
CREATE TRIGGER env_firm_grant_change AFTER UPDATE ON env_grants WHEN 1 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM env_firm_work WHERE company_id=NEW.company_id AND (SELECT e.operator_id FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.role='owner' ORDER BY e.operator_id LIMIT 1) IS NULL) THEN RAISE(ABORT,'firm_work_owner_required') END;
 UPDATE env_firm_work SET
 assignee_id=CASE WHEN assignee_id=NEW.operator_id OR NOT EXISTS(SELECT 1 FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id=env_firm_work.assignee_id) THEN COALESCE((SELECT e.operator_id FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id=env_firm_work.backup_id AND e.operator_id!=NEW.operator_id),(SELECT e.operator_id FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.role='owner' ORDER BY e.operator_id LIMIT 1)) ELSE assignee_id END,
 backup_id=CASE WHEN backup_id=NEW.operator_id OR NOT EXISTS(SELECT 1 FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id=env_firm_work.backup_id) THEN NULL ELSE backup_id END,
 handoff_state=CASE WHEN handoff_recipient=NEW.operator_id OR (handoff_recipient IS NOT NULL AND NOT EXISTS(SELECT 1 FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id=env_firm_work.handoff_recipient)) THEN 'recipient-changed' ELSE handoff_state END,
 version=version+1,actor_id=NULL,authority_subject=NEW.operator_id,event='authority.reassigned',change_id=lower(hex(randomblob(16))),updated_at=CAST(unixepoch('subsec')*1000 AS INTEGER)
 WHERE company_id=NEW.company_id AND (assignee_id=NEW.operator_id OR backup_id=NEW.operator_id OR handoff_recipient=NEW.operator_id);
END;
CREATE TRIGGER env_firm_grant_delete AFTER DELETE ON env_grants WHEN 1 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM env_firm_work WHERE company_id=OLD.company_id AND (SELECT e.operator_id FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.role='owner' ORDER BY e.operator_id LIMIT 1) IS NULL) THEN RAISE(ABORT,'firm_work_owner_required') END;
 UPDATE env_firm_work SET
 assignee_id=CASE WHEN assignee_id=OLD.operator_id OR NOT EXISTS(SELECT 1 FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id=env_firm_work.assignee_id) THEN COALESCE((SELECT e.operator_id FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id=env_firm_work.backup_id AND e.operator_id!=OLD.operator_id),(SELECT e.operator_id FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.role='owner' ORDER BY e.operator_id LIMIT 1)) ELSE assignee_id END,
 backup_id=CASE WHEN backup_id=OLD.operator_id OR NOT EXISTS(SELECT 1 FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id=env_firm_work.backup_id) THEN NULL ELSE backup_id END,
 handoff_state=CASE WHEN handoff_recipient=OLD.operator_id OR (handoff_recipient IS NOT NULL AND NOT EXISTS(SELECT 1 FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id=env_firm_work.handoff_recipient)) THEN 'recipient-changed' ELSE handoff_state END,
 version=version+1,actor_id=NULL,authority_subject=OLD.operator_id,event='authority.reassigned',change_id=lower(hex(randomblob(16))),updated_at=CAST(unixepoch('subsec')*1000 AS INTEGER)
 WHERE company_id=OLD.company_id AND (assignee_id=OLD.operator_id OR backup_id=OLD.operator_id OR handoff_recipient=OLD.operator_id);
END;
CREATE TRIGGER env_firm_operator_inactive AFTER UPDATE OF status ON oa_operators WHEN NEW.status!='active' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM env_firm_work WHERE 1 AND (SELECT e.operator_id FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.role='owner' ORDER BY e.operator_id LIMIT 1) IS NULL) THEN RAISE(ABORT,'firm_work_owner_required') END;
 UPDATE env_firm_work SET
 assignee_id=CASE WHEN assignee_id=NEW.id OR NOT EXISTS(SELECT 1 FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id=env_firm_work.assignee_id) THEN COALESCE((SELECT e.operator_id FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id=env_firm_work.backup_id AND e.operator_id!=NEW.id),(SELECT e.operator_id FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.role='owner' ORDER BY e.operator_id LIMIT 1)) ELSE assignee_id END,
 backup_id=CASE WHEN backup_id=NEW.id OR NOT EXISTS(SELECT 1 FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id=env_firm_work.backup_id) THEN NULL ELSE backup_id END,
 handoff_state=CASE WHEN handoff_recipient=NEW.id OR (handoff_recipient IS NOT NULL AND NOT EXISTS(SELECT 1 FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id=env_firm_work.handoff_recipient)) THEN 'recipient-changed' ELSE handoff_state END,
 version=version+1,actor_id=NULL,authority_subject=NEW.id,event='authority.reassigned',change_id=lower(hex(randomblob(16))),updated_at=CAST(unixepoch('subsec')*1000 AS INTEGER)
 WHERE 1 AND (assignee_id=NEW.id OR backup_id=NEW.id OR handoff_recipient=NEW.id);
END;
CREATE TRIGGER env_firm_operator_delete BEFORE DELETE ON oa_operators WHEN 1 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM env_firm_work WHERE 1 AND (SELECT e.operator_id FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id!=OLD.id AND e.role='owner' ORDER BY e.operator_id LIMIT 1) IS NULL) THEN RAISE(ABORT,'firm_work_owner_required') END;
 UPDATE env_firm_work SET
 assignee_id=CASE WHEN assignee_id=OLD.id OR NOT EXISTS(SELECT 1 FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id!=OLD.id AND e.operator_id=env_firm_work.assignee_id) THEN COALESCE((SELECT e.operator_id FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id!=OLD.id AND e.operator_id=env_firm_work.backup_id AND e.operator_id!=OLD.id),(SELECT e.operator_id FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id!=OLD.id AND e.role='owner' ORDER BY e.operator_id LIMIT 1)) ELSE assignee_id END,
 backup_id=CASE WHEN backup_id=OLD.id OR NOT EXISTS(SELECT 1 FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id!=OLD.id AND e.operator_id=env_firm_work.backup_id) THEN NULL ELSE backup_id END,
 handoff_state=CASE WHEN handoff_recipient=OLD.id OR (handoff_recipient IS NOT NULL AND NOT EXISTS(SELECT 1 FROM env_firm_work_eligible e WHERE e.company_id=env_firm_work.company_id AND e.work_id=env_firm_work.id AND e.operator_id!=OLD.id AND e.operator_id=env_firm_work.handoff_recipient)) THEN 'recipient-changed' ELSE handoff_state END,
 version=version+1,actor_id=NULL,authority_subject=OLD.id,event='authority.reassigned',change_id=lower(hex(randomblob(16))),updated_at=CAST(unixepoch('subsec')*1000 AS INTEGER)
 WHERE 1 AND (assignee_id=OLD.id OR backup_id=OLD.id OR handoff_recipient=OLD.id);
END;
