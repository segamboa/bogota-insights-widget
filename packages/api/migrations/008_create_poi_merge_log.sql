-- 008: Create POI merge log table
-- Up
CREATE TABLE poi_merge_log (
    id              BIGSERIAL PRIMARY KEY,
    canonical_id    BIGINT NOT NULL REFERENCES pois(id),
    duplicate_id    BIGINT NOT NULL REFERENCES pois(id),
    merge_reason    VARCHAR(100) NOT NULL,
    confidence      SMALLINT NOT NULL,
    merged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    merged_by       VARCHAR(100) NOT NULL DEFAULT 'auto',
    UNIQUE(duplicate_id)
);

CREATE INDEX idx_merge_log_canonical ON poi_merge_log(canonical_id);

-- Down
-- DROP TABLE IF EXISTS poi_merge_log;
