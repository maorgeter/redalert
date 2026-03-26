-- Dynamic Alert Map — Initial Schema
-- Requires PostgreSQL with PostGIS extension

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Alert Events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_events (
    id            TEXT PRIMARY KEY,
    source        TEXT NOT NULL,
    timestamp     TIMESTAMPTZ NOT NULL,
    area_name     TEXT NOT NULL,
    area_type     TEXT NOT NULL,
    city_names    TEXT[] NOT NULL DEFAULT '{}',
    geofence_id   TEXT,
    raw_payload   JSONB,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity      TEXT NOT NULL,
    confidence    FLOAT NOT NULL DEFAULT 1.0,
    status        TEXT NOT NULL DEFAULT 'ACTIVE',
    category      TEXT NOT NULL DEFAULT 'rockets',
    ttl_seconds   INTEGER NOT NULL DEFAULT 300
);

CREATE INDEX IF NOT EXISTS idx_alert_events_status ON alert_events(status);
CREATE INDEX IF NOT EXISTS idx_alert_events_timestamp ON alert_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_source ON alert_events(source);
CREATE INDEX IF NOT EXISTS idx_alert_events_area_name ON alert_events(area_name);

-- ─── Estimated Zones ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estimated_zones (
    id                  TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    geometry            GEOMETRY(GEOMETRY, 4326),
    uncertainty_geometry GEOMETRY(GEOMETRY, 4326),
    source_geofence_ids TEXT[] NOT NULL DEFAULT '{}',
    affected_areas      TEXT[] NOT NULL DEFAULT '{}',
    confidence          FLOAT NOT NULL,
    last_event_at       TIMESTAMPTZ NOT NULL,
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    explanation         JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_zones_computed_at ON estimated_zones(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_zones_geom ON estimated_zones USING GIST(geometry);

-- ─── Replay Sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS replay_sessions (
    id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    name        TEXT NOT NULL,
    description TEXT,
    start_time  TIMESTAMPTZ NOT NULL,
    end_time    TIMESTAMPTZ NOT NULL,
    event_ids   TEXT[] NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Schema Migrations Tracking ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS migrations (
    version     TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO migrations(version) VALUES ('001_initial')
ON CONFLICT DO NOTHING;
