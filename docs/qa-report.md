# QA Report: Bogota Insights Widget -- OSM Enhancement

**Date:** 2026-02-18
**QA Engineer:** qa-engineer
**Status:** GO FOR LAUNCH
**Revision:** 6.3 (final -- all issues resolved, 23,423 POIs validated)
**Previous:** v6.2 (CONDITIONAL GO, SITP bug), v6.1 (code review only), v6.0 (1 blocking issue), v5.1 (MVP -- 8,714 POIs)

---

## 1. Executive Summary

This report covers the OSM (OpenStreetMap) enhancement that adds:
- **Commerce category** (restaurants, cafes, banks, pharmacies, supermarkets, convenience stores, malls) via OSM Overpass API
- **SITP bus stops** (2,631 additional transport POIs) via OSM Overpass API
- Commerce is now the 5th scored category (joining transport, education, health, recreation)

**Live test environment:** PostgreSQL 16 + PostGIS 3.4 (Docker), Redis 7 (Docker), API on localhost:3000
**Total POIs ingested:** 23,423 (ideca: 8,564, osm: 14,709, transmilenio: 150)
**Integration tests:** 77/77 passed
**Duplicate source_ids:** 0

**Overall Assessment: GO FOR LAUNCH**
- Data Source Verification: **PASS** -- Overpass API is the sole OSM data source, no scraping
- Security Audit: **PASS** -- SQL injection safe, XSS mitigated (2 layers), coordinate bounds enforced (3 levels)
- Commerce Integration: **PASS** -- 12,078 commerce POIs across 7 subcategories, all 5 neighborhoods have scores
- SITP Bus Stops: **PASS** -- 2,631 bus stops ingested (ISSUE-OSM06 resolved)
- Kennedy Bias Check: **PASS** -- Kennedy (273 commerce POIs) is 70% of Usaquen (388)
- Performance: **PASS** -- p99 = 25ms (target <100ms), with 23,423 POIs (2.7x more than MVP)
- Frontend: **PASS** -- 5 categories displayed, 15.7KB gzipped bundle (71% under budget)

---

## 2. Data Source Verification

### 2.1 Source Provenance Audit

| Data Source | Origin | Official? | Method | Verified |
|-------------|--------|-----------|--------|----------|
| IDECA Colegios | datosabiertos.bogota.gov.co | YES | GeoJSON download | PASS |
| IDECA IPS (Health) | datosabiertos.bogota.gov.co | YES | GeoJSON download | PASS |
| IDECA BiblioRed | datosabiertos.bogota.gov.co | YES | GeoJSON download | PASS |
| IDECA Parques | datosabiertos.bogota.gov.co | YES | GeoJSON download | PASS |
| TransMilenio Stations | gis.transmilenio.gov.co | YES | Esri REST / GeoJSON | PASS |
| OSM Commerce Amenities | overpass-api.de | YES | Overpass API POST | **PASS** |
| OSM Commerce Shops | overpass-api.de | YES | Overpass API POST | **PASS** |
| OSM SITP Bus Stops | overpass-api.de | YES | Overpass API POST | **PASS** |

### 2.2 OSM Overpass Queries (final version)

**Endpoint:** `https://overpass-api.de/api/interpreter` (osm-ingest.ts:42)
**Bounding box:** `4.4,-74.3,4.85,-73.9` (osm-ingest.ts:65, slightly wider than BOGOTA_BOUNDS)

1. **Commerce Amenities** (8,434 elements, 8,408 ingested):
   - `node/way["amenity"~"^(restaurant|cafe|bank|pharmacy)$"]`
   - Output: `out center tags`

2. **Commerce Shops** (3,692 elements, 3,674 ingested):
   - `node/way["shop"~"^(supermarket|convenience|department_store|mall)$"]`
   - Output: `out center tags`

3. **SITP Bus Stops** (2,638 elements, 2,631 ingested, 7 skipped outside bounds):
   - `node["highway"="bus_stop"]`, `node["public_transport"="platform"]["bus"="yes"]`
   - Output: `out body` (fixed from `out tags`)

**NO web scraping detected.** All data from official Overpass API.

### 2.3 Downloaded File Security Scan

| File | Size | Valid JSON | Elements | Script/Eval/Exec | Status |
|------|------|-----------|----------|-------------------|--------|
| osm-commerce-amenities.json | 2.5MB | YES | 8,434 | 0/0/0 | **SAFE** |
| osm-commerce-shops.json | 734KB | YES | 3,692 | 0/0/0 | **SAFE** |
| osm-sitp-bus-stops.json | 583KB | YES | 2,638 | 0/0/0 | **SAFE** |

All files are valid JSON containing only OSM element data (type, id, lat, lon, tags). No executable code detected.

---

## 3. Security Audit

### 3.1 SQL Injection Testing

| Test | File:Line | Status | Details |
|------|-----------|--------|---------|
| OSM POI upsert | osm-ingest.ts:320 -> queries.ts:178 | **SAFE** | Parameterized queries ($1-$13) |
| Sync run creation | osm-ingest.ts:356 -> queries.ts:211 | **SAFE** | Parameterized queries ($1-$2) |
| Sync run completion | osm-ingest.ts:378 -> queries.ts:234 | **SAFE** | Parameterized queries ($1-$9) |
| Source ID generation | osm-ingest.ts:312 | **SAFE** | Deterministic: `osm-{type}-{id}` |
| Tag storage | osm-ingest.ts:317,332 | **SAFE** | Sanitized via sanitizeTags(), then JSON.stringify'd |

**Zero SQL injection risk.** All queries parameterized.

### 3.2 XSS Prevention

| Vector | Status | Details |
|--------|--------|---------|
| POI names | **SAFE** | `sanitizeString()` strips HTML tags (`/<[^>]*>/g`), then Preact auto-escapes |
| OSM tags | **SAFE** | `sanitizeTags()` whitelists 22 known keys, truncates to 500 chars |
| Category param | **SAFE** | Tested `categories=<script>alert(1)</script>` -- returns error, no reflection |
| API responses | **SAFE** | JSON Content-Type only, no HTML rendering |

### 3.3 Coordinate Bounds Enforcement

| Level | Location | Status |
|-------|----------|--------|
| Overpass query bbox | osm-ingest.ts:65 | **PASS** -- `4.4,-74.3,4.85,-73.9` |
| Post-query server filter | osm-ingest.ts:199-206 | **PASS** -- uses `BOGOTA_BOUNDS` from shared |
| API middleware | validation.ts:25-32 | **PASS** -- rejects coords outside bounds |
| Live test: lat=50 | API request | **PASS** -- returns 400 OUTSIDE_COVERAGE |

### 3.4 Rate Limiting & Timeouts

| Check | Status | Details |
|-------|--------|---------|
| Overpass rate limiting | **PASS** | 500ms minimum between requests (osm-ingest.ts:14-22) |
| Overpass timeout | **PASS** | 120s AbortSignal + 30s Overpass query timeout |
| User-Agent | **PASS** | `BogotaInsightsWidget/1.0` |
| API rate limiting | **PASS** | @fastify/rate-limit + tier-based limits |

---

## 4. Issues Found

### RESOLVED: ISSUE-OSM06 [was MEDIUM]: SITP bus stops not ingested

**Status:** FIXED. The Overpass query at osm-ingest.ts:139 now reads `out body;` (was `out tags;`). The cached `osm-sitp-bus-stops.json` file was re-fetched with the corrected query and contains full lat/lon coordinates. Re-ingestion result:
```
--- Ingesting: SITP Bus Stops ---
  Parsed 2638 elements from SITP Bus Stops
  Created: 2631, Updated: 0, Skipped: 7, Errors: 0
```

### RESOLVED: ISSUE-OSM01 [was BLOCKING]: Missing if(runOsm) block

**Status:** FIXED in ingest-runner.ts:50-58. Verified working in live ingestion run.

### RESOLVED: ISSUE-OSM02 [was LOW]: sanitizeString HTML stripping

**Status:** FIXED. sanitizeString() at osm-ingest.ts:215 now strips HTML tags.

### RESOLVED: ISSUE-OSM03 [was LOW]: Pharmacy categorization

**Status:** Pharmacies are ingested under commerce category as subcategory `farmacia` (1,455 POIs). Consistent with the Overpass query targeting `amenity=pharmacy`.

### ISSUE-OSM07 [LOW]: OVERPASS_BBOX differs from BOGOTA_BOUNDS

**File:** `osm-ingest.ts:65`
**Description:** The Overpass bounding box `'4.4,-74.3,4.85,-73.9'` is slightly wider than the shared `BOGOTA_BOUNDS` (south: 4.45, west: -74.27, north: 4.84, east: -73.88). The post-query `isWithinBogota()` filter uses the tighter `BOGOTA_BOUNDS`, so elements outside the official bounds are correctly rejected.
**Impact:** None -- the wider query bbox captures edge cases, and the server-side filter enforces the proper bounds. 51 elements were correctly skipped by this filter across all 3 datasets.
**Status:** Acceptable -- defense in depth working as expected.

### ISSUE-OSM08 [LOW]: Spanish subcategory names vs English scoring config

**File:** `osm-ingest.ts:80-84,111-114`
**Description:** OSM subcategories use Spanish names (restaurante, cafe, banco, farmacia, supermercado, tienda, centro_comercial, parada_sitp), while the scoring engine's `EXPECTED_DIVERSITY` config in `scoring.ts:22` lists English names. Diversity scoring counts unique subcategory strings, so these mismatched names are still counted correctly (7 unique subcategories is above the expected 5).
**Impact:** Functional -- diversity scoring works correctly because it counts unique strings regardless of language.

### ISSUE-B02 [LOW]: Migrations without transactions (carried from v5.1)
### ISSUE-D01 [LOW]: GTFS CSV parser fragility (carried from v5.1)

---

## 5. Integration Testing Results

**STATUS: COMPLETE** -- 77/77 tests PASS
**Environment:** PostgreSQL 16 + PostGIS 3.4, Redis 7, 23,423 POIs (14,709 OSM + 8,564 IDECA + 150 TransMilenio)

### 5.1 Neighborhood Scores (fresh cache, post-SITP fix)

| Neighborhood | Estrato | Overall | Transport | Commerce | Education | Health | Recreation |
|-------------|---------|---------|-----------|----------|-----------|--------|------------|
| Kennedy | 2-3 | 56 | 52 | **64** | 58 | 58 | 54 |
| Chapinero | 4-5 | 50 | 44 | **77** | 35 | 63 | 45 |
| Usaquen | 5-6 | 53 | 52 | **68** | 39 | 58 | 56 |
| Centro | 2-4 | 47 | 44 | **76** | 59 | 44 | 28 |
| Suba | 3-4 | 56 | 44 | **67** | 65 | 59 | 54 |

All 5 neighborhoods now have both transport and commerce scores > 0. Notable improvement:
- Transport scores improved significantly (Chapinero: 0 -> 44, Usaquen: 0 -> 52) due to SITP bus stops
- Commerce scores range from 64 (Kennedy) to 77 (Chapinero)

### 5.2 Test Results Detail

| Test | Result | Details |
|------|--------|---------|
| TC1-TC5: Neighborhood insights (5x) | **PASS** | All return 200, all scores in 0-100 range, all have commerce + transport |
| TC6: Out-of-bounds (lat=50) | **PASS** | Returns 400 OUTSIDE_COVERAGE |
| TC7: Missing params | **PASS** | Returns 400 |
| TC8: Invalid lat (abc) | **PASS** | Returns 400 |
| TC9: Cache hit | **PASS** | Second request cache_hit=true, 1ms response |
| TC10: Cached score consistency | **PASS** | Scores match between requests |
| TC11: POIs endpoint | **PASS** | Returns array with 13 education POIs |
| TC12: POI filter (commerce) | **PASS** | Returns commerce POIs, source='osm', correct subcategories |
| TC13: English summaries | **PASS** | Correct summaries for all categories |
| TC14: XSS in category param | **PASS** | Returns error, no script reflection |
| TC15: Commerce in all neighborhoods | **PASS** | 5/5 neighborhoods have commerce > 0 |

---

## 6. Kennedy Bias Check

### 6.1 Live Database Query Results (2km radius)

| Neighborhood | Transport | Commerce | Education | Health | Recreation | Total |
|-------------|-----------|----------|-----------|--------|------------|-------|
| Kennedy | 85 | 273 | 100 | 58 | 240 | 756 |
| Usaquen | 112 | 388 | 16 | 217 | 156 | 889 |
| Ratio (K/U) | 76% | **70%** | 625% | 27% | 154% | 85% |

**Kennedy commerce (273) is 70% of Usaquen (388).** Well above the 30% acceptable threshold. PASS.

**Kennedy transport (85) is 76% of Usaquen (112).** SITP bus stops provide excellent coverage across socioeconomic zones. PASS.

### 6.2 Comparison to MVP Research

In the MVP, Kennedy had 0 general OSM POIs vs 115 in Usaquen. The commerce-specific OSM data has dramatically better coverage in Kennedy because banks (Davivienda, Bancolombia, Banco de Bogota), supermarkets (Exito, Jumbo), and pharmacies (Drogueria) are well-mapped even in lower-estrato areas.

**Kennedy bias: RESOLVED for both commerce and transport data.**

---

## 7. Performance Testing

**10 uncached requests with varied coordinates (23,423 POIs in database):**

| Request | Latency |
|---------|---------|
| 1 | 19ms |
| 2 | 17ms |
| 3 | 19ms |
| 4 | 19ms |
| 5 | 18ms |
| 6 | 18ms |
| 7 | 17ms |
| 8 | 20ms |
| 9 | 25ms |
| 10 | 20ms |

| Metric | Target | Result | Status |
|--------|--------|--------|--------|
| p50 (uncached) | - | 19ms | **GOOD** |
| p99 (uncached) | < 100ms | 25ms | **PASS** |
| Cached response | < 50ms | 1ms | **PASS** |
| Bundle gzipped | < 55KB | 15.7KB | **PASS** (71% under budget) |
| POI count | +5,000-10,000 | +14,709 | Above estimate but performant |

Performance improved from v6.2 (p99=57ms to p99=25ms) with 2,631 more POIs. PostGIS spatial indexing handles the 23,423-POI dataset efficiently.

---

## 8. Data Quality Summary

### 8.1 POI Distribution by Source and Category

| Source | Category | Count |
|--------|----------|-------|
| osm | commerce | 12,078 |
| osm | transport | 2,631 |
| ideca | education | 1,744 |
| ideca | health | 1,527 |
| ideca | recreation | 5,293 |
| transmilenio | transport | 150 |
| **TOTAL** | | **23,423** |

### 8.2 OSM Commerce POIs by Subcategory

| Subcategory | Count | Pct |
|------------|-------|-----|
| restaurante | 4,625 | 38.3% |
| supermercado | 1,752 | 14.5% |
| tienda | 1,546 | 12.8% |
| farmacia | 1,455 | 12.0% |
| cafe | 1,445 | 12.0% |
| banco | 883 | 7.3% |
| centro_comercial | 372 | 3.1% |
| **TOTAL** | **12,078** | **100%** |

### 8.3 SITP Bus Stops

- 2,638 elements fetched from Overpass API
- 2,631 ingested (7 skipped -- outside Bogota bounds)
- 0 duplicate source_ids
- Timestamp of cached data: 2026-02-18T22:34:38Z

### 8.4 Duplicate Check

- 0 duplicate source_ids across all 14,709 OSM records
- upsertPoi() uses ON CONFLICT(source, source_id) DO UPDATE for idempotent re-runs

---

## 9. Recommendations

### No Blocking Issues

All previously identified blocking and medium issues have been resolved.

### Ship Without (can fix post-launch)

1. **ISSUE-OSM07 [LOW]:** OVERPASS_BBOX vs BOGOTA_BOUNDS mismatch (defense in depth working correctly)
2. **ISSUE-OSM08 [LOW]:** Spanish subcategory names vs English scoring config (functional but confusing)
3. **ISSUE-B02 [LOW]:** Migrations without transactions (carried from v5.1)
4. **ISSUE-D01 [LOW]:** GTFS CSV parser fragility (carried from v5.1)

### Post-Launch

5. Monitor OSM data freshness (re-run ingestion periodically)
6. Consider adding Ciudad Bolivar to test neighborhoods (low commerce coverage: 34 POIs)
7. Align subcategory naming convention (Spanish vs English) for consistency

---

## 10. Conclusion

**VERDICT: GO FOR LAUNCH**

All critical validations pass:

- **Commerce Enhancement: PASS.** 12,078 commerce POIs successfully ingested from the official Overpass API across 7 subcategories. All 5 test neighborhoods show commerce scores (64-77). Kennedy bias check passed (70% of Usaquen).

- **SITP Bus Stops: PASS.** 2,631 bus stops successfully ingested after ISSUE-OSM06 fix. Transport scores improved significantly across all neighborhoods (Chapinero: 0 -> 44, Usaquen: 0 -> 52, Kennedy: 24 -> 52).

- **Security: PASS.** Zero SQL injection risk (all parameterized queries). XSS mitigated at 2 layers (HTML stripping + Preact auto-escape). Coordinate bounds enforced at 3 levels. Rate limiting in place.

- **Performance: PASS.** p99 = 25ms uncached with 23,423 POIs (2.7x MVP baseline). Cached responses in 1ms.

- **Integration: PASS.** 77/77 tests passed. All 5 neighborhoods have all 5 category scores > 0.

**Final validated scores (23,423 POIs, all 5 categories):**

| Neighborhood | Overall | Transport | Commerce | Education | Health | Recreation |
|-------------|---------|-----------|----------|-----------|--------|------------|
| Kennedy | 56 | 52 | 64 | 58 | 58 | 54 |
| Chapinero | 50 | 44 | 77 | 35 | 63 | 45 |
| Usaquen | 53 | 52 | 68 | 39 | 58 | 56 |
| Centro | 47 | 44 | 76 | 59 | 44 | 28 |
| Suba | 56 | 44 | 67 | 65 | 59 | 54 |

---

**Report prepared by:** qa-engineer
**Final review date:** 2026-02-18
**Review status:** Full live validation complete (infrastructure + code review + security audit + integration tests + performance + SITP re-ingestion). **GO FOR LAUNCH.**
