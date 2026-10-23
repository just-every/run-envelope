-- Existing unclassified holds use the conservative statutory date gate.
ALTER TABLE env_privacy_holds ADD COLUMN kind TEXT NOT NULL DEFAULT 'statutory' CHECK(kind IN ('statutory','legal'));
ALTER TABLE env_privacy_hold_events ADD COLUMN kind TEXT NOT NULL DEFAULT 'statutory' CHECK(kind IN ('statutory','legal'));
