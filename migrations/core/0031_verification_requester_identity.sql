-- Existing consents need a fresh worker decision before disclosing to a changed identity.
ALTER TABLE env_verification_consents ADD COLUMN requester_version INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER env_verification_requester_immutable BEFORE UPDATE OF requester_version ON env_verification_consents BEGIN SELECT RAISE(ABORT,'immutable_verification_consent'); END;
