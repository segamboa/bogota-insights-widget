-- 013: Create properties table for real estate data
-- Up
CREATE TYPE property_type AS ENUM ('apartamento', 'casa', 'oficina', 'local', 'bodega', 'lote', 'finca', 'otro');
CREATE TYPE property_status AS ENUM ('activo', 'vendido', 'arrendado', 'inactivo', 'desconocido');

CREATE TABLE properties (
    id              BIGSERIAL PRIMARY KEY,

    -- Source identification
    source          VARCHAR(50) NOT NULL DEFAULT 'metrocuadrado',
    source_id       VARCHAR(200) NOT NULL,
    source_url      TEXT,

    -- Property classification
    property_type   property_type NOT NULL,
    business_type   VARCHAR(20) NOT NULL, -- 'venta', 'arriendo', 'venta-arriendo'
    status          property_status NOT NULL DEFAULT 'activo',

    -- Location
    location        GEOGRAPHY(POINT, 4326) NOT NULL,
    address         VARCHAR(500),
    neighborhood    VARCHAR(200),
    locality        VARCHAR(200), -- Localidad de Bogotá
    city            VARCHAR(100) NOT NULL DEFAULT 'Bogotá',
    stratum         SMALLINT, -- Estrato 1-6

    -- Physical characteristics
    built_area_m2   DECIMAL(10, 2),
    land_area_m2    DECIMAL(10, 2),
    rooms           SMALLINT,
    bathrooms       SMALLINT,
    garages         SMALLINT,
    floor           SMALLINT,
    antiquity_years SMALLINT,

    -- Pricing
    price_cop       BIGINT NOT NULL, -- Precio en pesos colombianos
    price_per_m2    DECIMAL(12, 2), -- Calculado
    admin_fee_cop   BIGINT, -- Cuota de administración

    -- Features (array de amenities)
    features        TEXT[],

    -- Description
    title           VARCHAR(500),
    description     TEXT,

    -- Contact info
    agency_name     VARCHAR(200),
    contact_phone   VARCHAR(50),

    -- Source metadata
    source_raw_data JSONB,
    published_at    TIMESTAMPTZ,
    scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Quality flags
    has_coordinates BOOLEAN NOT NULL DEFAULT TRUE,
    has_price       BOOLEAN NOT NULL DEFAULT TRUE,
    is_duplicate    BOOLEAN NOT NULL DEFAULT FALSE,

    UNIQUE(source, source_id)
);

-- Indexes for common queries
CREATE INDEX idx_properties_location ON properties USING GIST(location);
CREATE INDEX idx_properties_neighborhood ON properties(neighborhood);
CREATE INDEX idx_properties_locality ON properties(locality);
CREATE INDEX idx_properties_price ON properties(price_cop);
CREATE INDEX idx_properties_type ON properties(property_type);
CREATE INDEX idx_properties_business ON properties(business_type);
CREATE INDEX idx_properties_stratum ON properties(stratum);
CREATE INDEX idx_properties_scraped_at ON properties(scraped_at);
CREATE INDEX idx_properties_published_at ON properties(published_at);

-- Composite index for ML queries
CREATE INDEX idx_properties_ml ON properties(property_type, locality, stratum, price_cop, built_area_m2) 
    WHERE has_coordinates = TRUE AND is_duplicate = FALSE;

-- Down
-- DROP TABLE IF EXISTS properties;
-- DROP TYPE IF EXISTS property_status;
-- DROP TYPE IF EXISTS property_type;
