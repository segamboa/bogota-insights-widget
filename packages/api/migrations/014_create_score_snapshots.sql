-- Monthly score snapshots for trend analysis
-- Tracks how insight scores evolve over time per location.

CREATE TABLE IF NOT EXISTS score_snapshots (
  id SERIAL PRIMARY KEY,
  lat DECIMAL(10, 6) NOT NULL,
  lng DECIMAL(10, 6) NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 1000,
  scores JSONB NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_version TEXT
);

-- Fast lookup by location + radius
CREATE INDEX idx_snapshots_coords ON score_snapshots(lat, lng, radius_m);

-- Fast lookup by date for trend queries
CREATE INDEX idx_snapshots_date ON score_snapshots(recorded_at);

-- Composite index for "latest snapshot per location" queries
CREATE INDEX idx_snapshots_coords_date ON score_snapshots(lat, lng, radius_m, recorded_at DESC);
