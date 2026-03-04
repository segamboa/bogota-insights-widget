-- 011: Cross-source deduplication - mark OSM POIs as non-canonical when IDECA record exists nearby
-- This is reversible: set is_canonical = TRUE to undo.
-- IDECA (government data) is kept as canonical; OSM duplicates are marked non-canonical.
-- Up

-- High confidence: same category + within 50m + name similarity (Jaccard > 0.3 approximated via shared words)
-- We use a word-overlap approach: at least one shared word between names (case-insensitive)
UPDATE pois osm_poi
SET is_canonical = FALSE
FROM pois ideca_poi
WHERE osm_poi.source = 'osm'
  AND ideca_poi.source = 'ideca'
  AND osm_poi.category = ideca_poi.category
  AND osm_poi.is_canonical = TRUE
  AND ideca_poi.is_canonical = TRUE
  AND ST_DWithin(osm_poi.location, ideca_poi.location, 50)
  AND osm_poi.name IS NOT NULL
  AND ideca_poi.name IS NOT NULL
  AND (
    -- At least one shared word (case-insensitive, 3+ chars to avoid articles)
    EXISTS (
      SELECT 1
      FROM unnest(string_to_array(lower(osm_poi.name), ' ')) AS osm_word
      JOIN unnest(string_to_array(lower(ideca_poi.name), ' ')) AS ideca_word
        ON osm_word = ideca_word
      WHERE length(osm_word) >= 3
    )
  );

-- Log high-confidence merges
INSERT INTO poi_merge_log (canonical_id, duplicate_id, merge_reason, confidence, merged_by)
SELECT
  ideca_poi.id AS canonical_id,
  osm_poi.id AS duplicate_id,
  'coord_50m_name_match' AS merge_reason,
  90 AS confidence,
  'migration_011' AS merged_by
FROM pois osm_poi
JOIN pois ideca_poi
  ON osm_poi.category = ideca_poi.category
  AND ST_DWithin(osm_poi.location, ideca_poi.location, 50)
WHERE osm_poi.source = 'osm'
  AND ideca_poi.source = 'ideca'
  AND osm_poi.is_canonical = FALSE
  AND ideca_poi.is_canonical = TRUE
  AND osm_poi.name IS NOT NULL
  AND ideca_poi.name IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM unnest(string_to_array(lower(osm_poi.name), ' ')) AS osm_word
    JOIN unnest(string_to_array(lower(ideca_poi.name), ' ')) AS ideca_word
      ON osm_word = ideca_word
    WHERE length(osm_word) >= 3
  )
ON CONFLICT (duplicate_id) DO NOTHING;

-- Medium confidence: same category + within 50m (any name or no name)
-- Only for POIs not already marked in the high-confidence pass
UPDATE pois osm_poi
SET is_canonical = FALSE
FROM pois ideca_poi
WHERE osm_poi.source = 'osm'
  AND ideca_poi.source = 'ideca'
  AND osm_poi.category = ideca_poi.category
  AND osm_poi.is_canonical = TRUE
  AND ideca_poi.is_canonical = TRUE
  AND ST_DWithin(osm_poi.location, ideca_poi.location, 50);

-- Log medium-confidence merges
INSERT INTO poi_merge_log (canonical_id, duplicate_id, merge_reason, confidence, merged_by)
SELECT DISTINCT ON (osm_poi.id)
  ideca_poi.id AS canonical_id,
  osm_poi.id AS duplicate_id,
  'coord_50m_only' AS merge_reason,
  70 AS confidence,
  'migration_011' AS merged_by
FROM pois osm_poi
JOIN pois ideca_poi
  ON osm_poi.category = ideca_poi.category
  AND ST_DWithin(osm_poi.location, ideca_poi.location, 50)
WHERE osm_poi.source = 'osm'
  AND ideca_poi.source = 'ideca'
  AND osm_poi.is_canonical = FALSE
  AND ideca_poi.is_canonical = TRUE
ORDER BY osm_poi.id, ST_Distance(osm_poi.location, ideca_poi.location) ASC
ON CONFLICT (duplicate_id) DO NOTHING;

-- Invalidate all cached insights (scores are now stale)
DELETE FROM insights_cache;

-- Down
-- UPDATE pois SET is_canonical = TRUE WHERE source = 'osm' AND is_canonical = FALSE AND id IN (SELECT duplicate_id FROM poi_merge_log WHERE merged_by = 'migration_011');
-- DELETE FROM poi_merge_log WHERE merged_by = 'migration_011';
