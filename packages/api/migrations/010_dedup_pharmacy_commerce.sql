-- 010: Mark pharmacy POIs under commerce as non-canonical (they belong to health only)
-- This is reversible: set is_canonical = TRUE to undo.
-- Up

-- Mark commerce pharmacies as non-canonical (duplicates of health pharmacies)
UPDATE pois
SET is_canonical = FALSE
WHERE category = 'commerce'
  AND subcategory = 'farmacia'
  AND source = 'osm';

-- Log the deduplication in poi_merge_log for audit trail
INSERT INTO poi_merge_log (canonical_id, duplicate_id, merge_reason, confidence, merged_by)
SELECT
  h.id AS canonical_id,
  c.id AS duplicate_id,
  'pharmacy_category_dedup' AS merge_reason,
  90 AS confidence,
  'migration_010' AS merged_by
FROM pois c
JOIN pois h
  ON h.source = c.source
  AND h.source_id = c.source_id
  AND h.category = 'health'
  AND h.subcategory = 'farmacia'
WHERE c.category = 'commerce'
  AND c.subcategory = 'farmacia'
  AND c.source = 'osm'
  AND c.is_canonical = FALSE
ON CONFLICT (duplicate_id) DO NOTHING;

-- Invalidate all cached insights (scores are now stale)
DELETE FROM insights_cache;

-- Down
-- UPDATE pois SET is_canonical = TRUE WHERE category = 'commerce' AND subcategory = 'farmacia' AND source = 'osm';
-- DELETE FROM poi_merge_log WHERE merge_reason = 'pharmacy_category_dedup';
