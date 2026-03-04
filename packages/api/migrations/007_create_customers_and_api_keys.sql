-- 007: Create customers and API keys tables
-- Up
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    email           VARCHAR(300) NOT NULL UNIQUE,
    company         VARCHAR(300),
    tier            VARCHAR(20) NOT NULL DEFAULT 'free',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    key_prefix      VARCHAR(12) NOT NULL,
    key_hash        VARCHAR(64) NOT NULL UNIQUE,
    label           VARCHAR(200),

    -- Rate limits (override tier defaults if set)
    rate_limit_per_minute  INT,
    rate_limit_per_day     INT,

    -- Restrictions
    allowed_origins TEXT[],
    allowed_ips     INET[],

    -- Status
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_customer ON api_keys(customer_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- Down
-- DROP TABLE IF EXISTS api_keys;
-- DROP TABLE IF EXISTS customers;
