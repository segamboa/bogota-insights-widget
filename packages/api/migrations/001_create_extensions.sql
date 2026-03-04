-- 001: Create required PostgreSQL extensions
-- Up
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Down
-- Extensions are shared; dropping may affect other databases.
-- DROP EXTENSION IF EXISTS pg_trgm;
-- DROP EXTENSION IF EXISTS postgis;
