ALTER TABLE env_external_providers ADD COLUMN reconcile_consent INTEGER NOT NULL DEFAULT 0 CHECK(reconcile_consent IN (0,1));
CREATE TABLE env_restore_receipts (
 company_id TEXT NOT NULL, dispatch_id TEXT NOT NULL, provider_change_id TEXT NOT NULL,
 provider_version INTEGER NOT NULL, original_receipt TEXT NOT NULL, payload_digest TEXT NOT NULL,
 observed_event TEXT NOT NULL, response_digest TEXT NOT NULL, checked_by TEXT NOT NULL, checked_at INTEGER NOT NULL,
 PRIMARY KEY(company_id,dispatch_id,provider_change_id), FOREIGN KEY(dispatch_id) REFERENCES env_notice_dispatches(id)
);
CREATE TRIGGER env_restore_receipt_update BEFORE UPDATE ON env_restore_receipts BEGIN SELECT RAISE(ABORT,'immutable_restore_receipt'); END;
CREATE TRIGGER env_restore_receipt_delete BEFORE DELETE ON env_restore_receipts BEGIN SELECT RAISE(ABORT,'immutable_restore_receipt'); END;
