-- 005: Create insights cache table
-- Up
CREATE TABLE insights_cache (
    id              BIGSERIAL PRIMARY KEY,
    geohash         VARCHAR(12) NOT NULL,
    radius_m        INT NOT NULL,
    lang            VARCHAR(5) NOT NULL DEFAULT 'es',

    -- Cached results
    scores          JSONB NOT NULL,
    pois_summary    JSONB NOT NULL,
    location_meta   JSONB NOT NULL,
    source_coverage JSONB NOT NULL DEFAULT '{}',

    -- Validity
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    data_version    INT NOT NULL DEFAULT 1,

    UNIQUE(geohash, radius_m, lang)
);

CREATE INDEX idx_insights_geohash ON insights_cache(geohash);
CREATE INDEX idx_insights_expires ON insights_cache(expires_at);

-- Down
-- DROP TABLE IF EXISTS insights_cache;
