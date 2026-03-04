-- 002: Create enum types
-- Up
CREATE TYPE poi_source AS ENUM (
    'osm',
    'ideca',
    'transmilenio',
    'manual'
);

CREATE TYPE poi_category AS ENUM (
    'transport',
    'commerce',
    'education',
    'health',
    'recreation'
);

CREATE TYPE sync_status AS ENUM (
    'running',
    'completed',
    'failed',
    'partial'
);

-- Down
-- DROP TYPE IF EXISTS sync_status;
-- DROP TYPE IF EXISTS poi_category;
-- DROP TYPE IF EXISTS poi_source;
