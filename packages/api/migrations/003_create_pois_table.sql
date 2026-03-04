-- 003: Create unified POI table
-- Up
CREATE TABLE pois (
    id              BIGSERIAL PRIMARY KEY,

    -- Source identification
    source          poi_source NOT NULL,
    source_id       VARCHAR(100) NOT NULL,
    source_dataset  VARCHAR(200),

    -- Classification
    category        poi_category NOT NULL,
    subcategory     VARCHAR(100) NOT NULL,
    source_tags     JSONB NOT NULL DEFAULT '{}',

    -- Core attributes
    name            VARCHAR(500),
    name_es         VARCHAR(500),
    name_en         VARCHAR(500),

    -- Geospatial
    location        GEOGRAPHY(POINT, 4326) NOT NULL,
    address         VARCHAR(500),

    -- Quality metadata
    confidence      SMALLINT NOT NULL DEFAULT 50,
    has_name        BOOLEAN GENERATED ALWAYS AS (name IS NOT NULL) STORED,
    has_address     BOOLEAN GENERATED ALWAYS AS (address IS NOT NULL) STORED,

    -- Merge tracking
    canonical_id    BIGINT REFERENCES pois(id),
    is_canonical    BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timestamps
    source_updated_at TIMESTAMPTZ,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(source, source_id)
);

-- Down
-- DROP TABLE IF EXISTS pois;
