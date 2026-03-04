-- 004: Create indexes for pois table
-- Up

-- Primary spatial index (only canonical records)
CREATE INDEX idx_pois_location
    ON pois USING GIST(location)
    WHERE is_canonical = TRUE;

-- Category filtering
CREATE INDEX idx_pois_category
    ON pois(category)
    WHERE is_canonical = TRUE;

CREATE INDEX idx_pois_subcategory
    ON pois(subcategory)
    WHERE is_canonical = TRUE;

-- Source-specific lookups (for sync upsert)
CREATE INDEX idx_pois_source_id
    ON pois(source, source_id);

-- Confidence-based filtering
CREATE INDEX idx_pois_confidence
    ON pois(confidence DESC)
    WHERE is_canonical = TRUE;

-- Canonical ID lookups
CREATE INDEX idx_pois_canonical
    ON pois(canonical_id)
    WHERE canonical_id IS NOT NULL;

-- Composite for most common query pattern
CREATE INDEX idx_pois_cat_canonical
    ON pois(category, is_canonical)
    WHERE is_canonical = TRUE;

-- Down
-- DROP INDEX IF EXISTS idx_pois_cat_canonical;
-- DROP INDEX IF EXISTS idx_pois_canonical;
-- DROP INDEX IF EXISTS idx_pois_confidence;
-- DROP INDEX IF EXISTS idx_pois_source_id;
-- DROP INDEX IF EXISTS idx_pois_subcategory;
-- DROP INDEX IF EXISTS idx_pois_category;
-- DROP INDEX IF EXISTS idx_pois_location;
