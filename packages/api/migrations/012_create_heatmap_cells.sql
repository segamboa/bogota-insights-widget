-- Create heatmap cells table for calibration analysis
-- Grid-based scoring storage for visualizing score distribution across Bogota

CREATE TABLE IF NOT EXISTS heatmap_cells (
  id SERIAL PRIMARY KEY,
  geohash_6 VARCHAR(6) UNIQUE NOT NULL,
  lat_center DECIMAL(10, 8) NOT NULL,
  lng_center DECIMAL(11, 8) NOT NULL,
  
  -- Scores by category (0-100)
  score_overall INTEGER CHECK (score_overall BETWEEN 0 AND 100),
  score_transport INTEGER CHECK (score_transport BETWEEN 0 AND 100),
  score_commerce INTEGER CHECK (score_commerce BETWEEN 0 AND 100),
  score_education INTEGER CHECK (score_education BETWEEN 0 AND 100),
  score_health INTEGER CHECK (score_health BETWEEN 0 AND 100),
  score_recreation INTEGER CHECK (score_recreation BETWEEN 0 AND 100),
  
  -- Metadata for analysis
  poi_count INTEGER DEFAULT 0,
  radius_m INTEGER DEFAULT 1000,
  
  -- Data versioning
  data_version VARCHAR(20) DEFAULT '1.0.0',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Spatial data
  geom GEOMETRY(Point, 4326)
);

-- Spatial index for geographic queries
CREATE INDEX IF NOT EXISTS idx_heatmap_geom ON heatmap_cells USING GIST(geom);

-- Index for geohash lookups
CREATE INDEX IF NOT EXISTS idx_heatmap_geohash ON heatmap_cells(geohash_6);

-- Index for score range queries (useful for filtering)
CREATE INDEX IF NOT EXISTS idx_heatmap_overall ON heatmap_cells(score_overall);

-- Index for computation tracking
CREATE INDEX IF NOT EXISTS idx_heatmap_computed ON heatmap_cells(computed_at);

-- Comment for documentation
COMMENT ON TABLE heatmap_cells IS 'Grid-based score storage for heatmap visualization and calibration analysis';
COMMENT ON COLUMN heatmap_cells.geohash_6 IS 'Geohash precision 6 (~1.2km x 0.6km)';
COMMENT ON COLUMN heatmap_cells.score_overall IS 'Weighted overall score (0-100)';

-- Down
-- DROP INDEX IF EXISTS idx_heatmap_computed;
-- DROP INDEX IF EXISTS idx_heatmap_overall;
-- DROP INDEX IF EXISTS idx_heatmap_geohash;
-- DROP INDEX IF EXISTS idx_heatmap_geom;
-- DROP TABLE IF EXISTS heatmap_cells;
