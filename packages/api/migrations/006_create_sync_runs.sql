-- 006: Create sync tracking table
-- Up
CREATE TABLE sync_runs (
    id              BIGSERIAL PRIMARY KEY,
    source          poi_source NOT NULL,
    sync_type       VARCHAR(20) NOT NULL,
    status          sync_status NOT NULL DEFAULT 'running',

    -- Metrics
    records_fetched INT DEFAULT 0,
    records_created INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    records_deleted INT DEFAULT 0,
    duplicates_found INT DEFAULT 0,

    -- Timing
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    duration_ms     INT,

    -- Error tracking
    error_message   TEXT,
    error_details   JSONB,

    -- For incremental syncs
    checkpoint      JSONB
);

CREATE INDEX idx_sync_runs_source ON sync_runs(source, started_at DESC);

-- Down
-- DROP TABLE IF EXISTS sync_runs;
