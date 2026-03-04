-- 009: Seed a development API key and customer
-- Up
INSERT INTO customers (id, name, email, company, tier)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Development',
    'dev@bogotainsights.local',
    'Bogota Insights Dev',
    'enterprise'
) ON CONFLICT (email) DO NOTHING;

-- API key: pk_dev_bogota2026
-- SHA-256 hash of 'pk_dev_bogota2026':
INSERT INTO api_keys (customer_id, key_prefix, key_hash, label, rate_limit_per_minute, rate_limit_per_day)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'pk_dev_bog',
    '00acc2fde4649de4a5017c74cb893bf03581e9160dae24ac90a6b8e9dbee29af',
    'Development Key',
    300,
    100000
) ON CONFLICT (key_hash) DO NOTHING;

-- Down
-- DELETE FROM api_keys WHERE label = 'Development Key';
-- DELETE FROM customers WHERE email = 'dev@bogotainsights.local';
