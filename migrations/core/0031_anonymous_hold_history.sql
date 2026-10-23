DROP TRIGGER env_privacy_hold_event_update;
-- Free-form hold text can itself identify the subject. Only an eligible erasure
-- transaction may clear it; controlled category/actor/date attribution remains.
CREATE TRIGGER env_privacy_hold_event_update BEFORE UPDATE ON env_privacy_hold_events
 WHEN NOT EXISTS(SELECT 1 FROM env_privacy_guard g JOIN env_privacy_requests q ON q.id=g.request_id
 WHERE g.company_id=OLD.company_id AND q.fingerprint=OLD.fingerprint AND q.state='complete'
 AND NEW.id=OLD.id AND NEW.company_id=OLD.company_id AND NEW.fingerprint=OLD.fingerprint
 AND NEW.action=OLD.action AND NEW.kind=OLD.kind AND NEW.release_date=OLD.release_date
 AND NEW.actor_id=OLD.actor_id AND NEW.occurred_at=OLD.occurred_at
 AND NEW.basis='' AND NEW.custodian='' AND NEW.evidence='')
 BEGIN SELECT RAISE(ABORT,'immutable_hold_event'); END;
