
# Deployment Guide - Bogota Insights Widget MVP

**Version:** 1.0.0
**Last Updated:** 2026-02-18
**Status:** Production Ready

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Data Ingestion](#data-ingestion)
5. [Backend API Deployment](#backend-api-deployment)
6. [Frontend Widget Deployment](#frontend-widget-deployment)
7. [Security Checklist](#security-checklist)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Minimum Requirements
- **OS:** Linux (Ubuntu 20.04+), macOS 12+, Windows 10+ (WSL2)
- **Node.js:** v20.0.0 or higher
- **pnpm:** v8.15.0 or higher
- **PostgreSQL:** v14+ with PostGIS extension v3.3+
- **Redis:** v7.0+
- **RAM:** 4GB minimum, 8GB recommended
- **Storage:** 10GB available disk space

### Production Requirements
- **VPS/Cloud:** 2 vCPU, 4GB RAM minimum
- **Database:** PostgreSQL with PostGIS (managed service recommended)
- **Cache:** Redis (managed service like Upstash recommended)
- **CDN:** Cloudflare, AWS CloudFront, or similar
- **SSL/TLS:** Valid certificate for API domain

---

## Environment Setup

### 1. Clone Repository
```bash
cd /path/to/project
# Repository already exists at: bogota-insights-widget/
```

### 2. Install Dependencies
```bash
cd bogota-insights-widget
pnpm install
```

### 3. Environment Variables

Create `.env` files for each package:

#### Backend: `packages/api/.env`
```env
# Database (PostgreSQL + PostGIS)
DATABASE_URL=postgresql://bogota:bogota_dev_2026@localhost:5432/bogota_insights

# Redis Cache
REDIS_URL=redis://localhost:6379

# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Logging
LOG_LEVEL=info

# CORS (set to your widget domains in production)
CORS_ORIGIN=*
```

**⚠️ SECURITY WARNING:** Update the following for production:
- Use strong database password (not `bogota_dev_2026`)
- Set `CORS_ORIGIN` to specific allowed domains
- Generate production API keys (not `pk_dev_bogota2026`)
- Use environment secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)

#### Frontend: `packages/widget/.env` (optional)
```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

---

## Database Setup

### 1. Start PostgreSQL with PostGIS

**Option A: Docker Compose (Development)**
```bash
docker-compose up -d
```

**Option B: Managed Service (Production - Recommended)**
Use Railway, Supabase, AWS RDS, or Google Cloud SQL with PostGIS extension.

### 2. Verify PostGIS Installation
```bash
psql postgresql://bogota:PASSWORD@localhost:5432/bogota_insights -c "SELECT PostGIS_version();"
```

Expected output: PostGIS version 3.3+ information

### 3. Run Migrations
```bash
cd packages/api
pnpm migrate
```

This creates:
- PostGIS and pg_trgm extensions
- Database schema (pois, api_keys, customers, insights_cache, sync_runs, poi_merge_log)
- Spatial indexes (GiST indexes on geometry columns)
- Partial indexes for performance
- Development API key seed

**Verify migrations:**
```bash
psql $DATABASE_URL -c "\dt"
```

Expected tables: `pois`, `insights_cache`, `api_keys`, `customers`, `sync_runs`, `poi_merge_log`, `pgmigrations`

---

## Data Ingestion

### 1. Download Data Files (If Not Present)

Data files should be in `packages/api/data/`:
- `colegios.geojson` (2.2MB) - Schools from IDECA
- `ips.geojson` (2.4MB) - Health facilities from IDECA
- `biblored.geojson` (3.3KB) - Libraries from IDECA
- `parques.geojson` (3.6MB) - Parks from IDECA (CRS-transformed)
- `tm-estaciones.geojson` (131KB) - TransMilenio stations

**Sources:**
- IDECA: https://datosabiertos.bogota.gov.co
- TransMilenio: Esri REST service

⚠️ **Data File Verification:**
All files are legitimate GeoJSON from official Colombian government sources (IDECA, TransMilenio). Files have been validated for:
- Proper GeoJSON structure
- Colombian government metadata (DANE codes, NIT numbers)
- Coordinate validity (Bogota bounds: lat 4.4-5.0, lng -74.3 to -73.9)

### 2. Run Full Ingestion
```bash
cd packages/api
pnpm ingest --all
```

**Expected output:**
```
Running migrations...
✓ Migrations complete
Ingesting IDECA datasets...
✓ Colegios: 2,221 POIs created
✓ IPS: 2,900 POIs created
✓ Bibliotecas: 23 POIs created
✓ Parques: 5,293 POIs created
Ingesting TransMilenio...
✓ TransMilenio: 150 POIs created
Total: 8,714 POIs ingested
```

### 3. Verify Data
```bash
psql $DATABASE_URL -c "SELECT category, COUNT(*) FROM pois WHERE is_canonical = TRUE GROUP BY category;"
```

Expected counts:
```
category     | count
-------------+-------
transport    | 150
education    | 1,744
health       | 1,527
recreation   | 5,293
```

---

## Backend API Deployment

### Development Mode
```bash
cd packages/api
pnpm dev
```
API runs at: http://localhost:3000

### Production Build
```bash
cd packages/api
pnpm build
pnpm start
```

### Production Deployment Options

#### Option 1: Railway (Recommended for MVP)
1. Connect GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy:
   ```
   Database: Add PostgreSQL with PostGIS plugin
   Redis: Add Redis add-on
   API: Deploy from packages/api
   ```
4. Cost: ~$25-30/month

#### Option 2: Docker
```bash
# Build image
docker build -t bogota-insights-api -f packages/api/Dockerfile .

# Run container
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=$DATABASE_URL \
  -e REDIS_URL=$REDIS_URL \
  --name bogota-api \
  bogota-insights-api
```

#### Option 3: AWS EC2 / Google Cloud VM
```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Deploy code
cd /opt/bogota-insights-widget/packages/api
pnpm install --prod
pnpm build
pm2 start dist/index.js --name bogota-api
```

### Health Check
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-18T12:00:00.000Z",
  "services": {
    "database": "up",
    "redis": "up"
  }
}
```

### API Endpoints

#### 1. GET /v1/insights
Complete neighborhood analysis with scores and POI listings.

```bash
curl -H "X-API-Key: pk_dev_bogota2026" \
  "http://localhost:3000/v1/insights?lat=4.6289&lng=-74.1510&radius=1000&lang=es"
```

#### 2. GET /v1/scores
Lightweight scores only (no POI listings).

```bash
curl -H "X-API-Key: pk_dev_bogota2026" \
  "http://localhost:3000/v1/scores?lat=4.6289&lng=-74.1510&radius=1000"
```

#### 3. GET /v1/pois
Raw POI data with filtering.

```bash
curl -H "X-API-Key: pk_dev_bogota2026" \
  "http://localhost:3000/v1/pois?lat=4.6289&lng=-74.1510&radius=1000&categories=education,health"
```

---

## Frontend Widget Deployment

### Development Mode
```bash
cd packages/widget
pnpm dev
```
Demo page: http://localhost:5173

### Production Build
```bash
cd packages/widget
pnpm build
```

Output files in `packages/widget/dist/`:
- `bogota-insights.es.js` (ES module, 16.06KB gzipped)
- `bogota-insights.umd.js` (UMD bundle for older browsers)
- `bogota-insights.css` (1.2KB gzipped)

### CDN Deployment

#### Option 1: Cloudflare Pages (Free)
```bash
# Connect GitHub repo to Cloudflare Pages
# Build command: cd packages/widget && pnpm build
# Output directory: packages/widget/dist
```

#### Option 2: AWS S3 + CloudFront
```bash
aws s3 sync packages/widget/dist/ s3://your-bucket/bogota-widget/
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

#### Option 3: Self-Hosted (Nginx)
```nginx
server {
    listen 80;
    server_name widgets.yourdomain.com;

    location /bogota-insights/ {
        root /var/www;
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "public, max-age=31536000";
    }
}
```

### Embedding Instructions

Provide this to customers:

```html
<!-- 1. Include the widget script -->
<script type="module" src="https://cdn.yourdomain.com/bogota-insights.es.js"></script>
<link rel="stylesheet" href="https://cdn.yourdomain.com/bogota-insights.css">

<!-- 2. Add widget element to your page -->
<bogota-insights-widget
  api-url="https://api.yourdomain.com"
  api-key="YOUR_API_KEY"
  latitude="4.6289"
  longitude="-74.1510"
  radius="1000"
  lang="es"
  theme="light"
></bogota-insights-widget>
```

**Widget Attributes:**
- `api-url` (required): Your API base URL
- `api-key` (required): Customer's API key
- `latitude` (required): Property latitude (4.4 to 5.0)
- `longitude` (required): Property longitude (-74.3 to -73.9)
- `radius` (optional): Search radius in meters (500-5000, default: 1000)
- `lang` (optional): Language code ('es' or 'en', default: 'es')
- `theme` (optional): Color theme ('light' or 'dark', default: 'light')
- `compact` (optional): Compact mode (true/false, default: false)
- `show-estrato` (optional): Show estrato badge (true/false, default: false)

---

## Security Checklist

### ✅ Pre-Launch Security Review

#### Data Files Validation
- [x] All GeoJSON files from official sources (IDECA, TransMilenio)
- [x] Files contain no executable code (pure JSON data)
- [x] Coordinate bounds validated (Bogota only)
- [x] File sizes reasonable (2-4MB per dataset)
- [ ] ⚠️ WARNING: `tm-stops.txt` contains HTML error page (404) - should be deleted or re-downloaded

#### API Security
- [x] API keys stored as SHA-256 hashes (not plaintext)
- [x] Parameterized SQL queries (no SQL injection risk)
- [x] Input validation with Zod schemas
- [x] Rate limiting enabled (@fastify/rate-limit)
- [x] Helmet.js security headers enabled
- [x] CORS configured (must restrict in production)
- [ ] **TODO:** Change default database password before production
- [ ] **TODO:** Generate production API keys (remove dev key)
- [ ] **TODO:** Set up SSL/TLS certificate
- [ ] **TODO:** Configure CORS to specific domains only

#### Frontend Security
- [x] No eval() or unsafe code execution
- [x] Shadow DOM isolation (prevents CSS conflicts)
- [x] API key sent via headers (not URL params)
- [x] HTTPS enforcement for production API calls
- [x] XSS protection (Preact auto-escapes)

#### Infrastructure Security
- [ ] **TODO:** Enable firewall (allow only 80, 443, 22)
- [ ] **TODO:** Set up DDoS protection (Cloudflare)
- [ ] **TODO:** Configure automated backups (database)
- [ ] **TODO:** Set up monitoring alerts (uptime, errors)

### Production-Ready API Key Management

**Create production API keys:**
```bash
# Generate secure API key
API_KEY="pk_prod_$(openssl rand -hex 16)"
echo "Generated API Key: $API_KEY"

# Hash the key
API_KEY_HASH=$(echo -n "$API_KEY" | shasum -a 256 | cut -d' ' -f1)

# Insert into database
psql $DATABASE_URL <<EOF
INSERT INTO customers (name, email, company, tier)
VALUES ('Customer Name', 'customer@example.com', 'Company Inc', 'standard')
RETURNING id;

-- Use the returned customer_id
INSERT INTO api_keys (customer_id, key_prefix, key_hash, label, rate_limit_per_minute, rate_limit_per_day)
VALUES (
  'CUSTOMER_ID_HERE',
  'pk_prod_xxx',
  '$API_KEY_HASH',
  'Production Key',
  60,
  10000
);
EOF
```

**Provide to customer:** Only give them the `$API_KEY` value (e.g., `pk_prod_a1b2c3d4...`). Never share the hash.

---

## Monitoring & Maintenance

### Health Monitoring
```bash
# Automated health check (run every 5 minutes via cron)
*/5 * * * * curl -f https://api.yourdomain.com/health || echo "API DOWN" | mail -s "Alert" admin@yourdomain.com
```

### Performance Metrics
- **API Response Time:** Target p99 < 100ms (currently ~53ms with cache)
- **Cache Hit Rate:** Target >90% (Redis cache)
- **Error Rate:** Target <1% of requests

### Database Maintenance

**Weekly backup:**
```bash
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz
```

**Vacuum (monthly):**
```bash
psql $DATABASE_URL -c "VACUUM ANALYZE pois;"
psql $DATABASE_URL -c "VACUUM ANALYZE insights_cache;"
```

### Cache Management

**Flush cache after data updates:**
```bash
redis-cli -u $REDIS_URL FLUSHALL
psql $DATABASE_URL -c "DELETE FROM insights_cache;"
```

### Log Rotation

**Configure logrotate:**
```
/var/log/bogota-insights/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
}
```

---

## Troubleshooting

### API Returns 500 Error

**Check logs:**
```bash
pm2 logs bogota-api
# or
docker logs bogota-api
```

**Common causes:**
1. Database connection failed → Check DATABASE_URL
2. Redis connection failed → Check REDIS_URL
3. PostGIS extension missing → Run `CREATE EXTENSION postgis;`

### Widget Shows "Loading..." Forever

**Check browser console:** Open DevTools (F12) and check Console tab.

**Common causes:**
1. CORS error → Update CORS_ORIGIN in API `.env`
2. Invalid API key → Check X-API-Key header
3. API down → Check /health endpoint

### No Recreation Scores

**Verify parks data:**
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM pois WHERE category = 'recreation';"
```

Expected: ~5,293 parks. If 0, re-run ingestion:
```bash
cd packages/api
pnpm ingest --ideca
```

### Slow API Responses

**Check cache:**
```bash
redis-cli -u $REDIS_URL INFO stats
# Look for keyspace_hits vs keyspace_misses
```

**If cache hit rate < 80%:**
- Increase Redis memory limit
- Check cache TTL (default: 24 hours)

**Check database indexes:**
```bash
psql $DATABASE_URL -c "\d+ pois"
# Verify GiST index exists on geometry column
```

---

## Additional Resources

- **EXECUTIVE-SUMMARY.md** - Complete project overview and business context
- **docs/qa-report.md** - QA test results (v5.0 final)
- **data-validation-results.md** - OSM vs IDECA data comparison
- **technical-architecture-addendum.md** - Database schema details

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review QA report for known issues
3. Contact development team

**Version History:**
- v1.0.0 (2026-02-18): Initial production release

---

**⚠️ IMPORTANT REMINDERS:**

1. **Change default passwords before production deployment**
2. **Generate production API keys (remove dev key)**
3. **Configure CORS to specific domains only**
4. **Set up SSL/TLS certificate**
5. **Enable monitoring and alerting**
6. **Delete or re-download `tm-stops.txt` (contains HTML error page)**

---

**Production Deployment Checklist:**

- [ ] Update database password
- [ ] Generate production API keys
- [ ] Configure CORS allowlist
- [ ] Set up SSL/TLS certificate
- [ ] Deploy to production environment
- [ ] Run health checks
- [ ] Verify widget embedding works
- [ ] Set up monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Configure automated backups
- [ ] Test rollback procedure
- [ ] Document customer onboarding process

---

**MVP is production-ready pending completion of security checklist above.**
