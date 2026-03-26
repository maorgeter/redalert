-- Migration 002: Add alert_type, title, description columns to alert_events
-- Supports full alert history with Event Ended (cat 4) and all other categories.

ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS alert_type   TEXT;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS title        TEXT NOT NULL DEFAULT '';
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS description  TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_alert_events_alert_type ON alert_events(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_events_category    ON alert_events(category);

INSERT INTO migrations(version) VALUES ('002_alert_history')
ON CONFLICT DO NOTHING;
