# OSM Data Validation Report for Bogota Commerce & Transit

**Date:** 2026-02-18
**Author:** Data Engineer (automated validation)
**Source:** OpenStreetMap Overpass API (https://overpass-api.de/)
**Scope:** Commerce amenities, SITP bus stops, leisure - 5 neighborhoods across estratos 1-6

---

## Executive Summary

OSM commerce data for Bogota is **significantly better** than infrastructure data. Kennedy (Estrato 2-3), which previously had 0 infrastructure POIs, now shows **681 commerce POIs**. However, geographic bias still exists - Chapinero (Estrato 4-5) has **1,510 commerce POIs** while Ciudad Bolivar (Estrato 1-2) has only **72**. The bias is present but less extreme than with infrastructure (38:1 ratio instead of infinity:0).

**Recommendation:** GO for commerce amenities (restaurants, cafes, banks, pharmacies, supermarkets). CONDITIONAL GO for SITP bus stops (good volume but inconsistent tagging). NO-GO for leisure (too sparse and biased).

---

## 1. Commerce Coverage by Neighborhood

### 1.1 Amenity-tagged Commerce (amenity=restaurant|cafe|bank|pharmacy)

| Neighborhood    | Estrato | Total | Restaurant | Cafe | Bank | Pharmacy |
|----------------|---------|-------|------------|------|------|----------|
| Ciudad Bolivar | 1-2     | 34    | 20         | 3    | 2    | 9        |
| Kennedy        | 2-3     | 410   | 212        | 51   | 48   | 99       |
| Suba           | 3-4     | 194   | 101        | 24   | 19   | 50       |
| Chapinero      | 4-5     | 1,292 | 733        | 293  | 114  | 152      |
| Usaquen        | 5-6     | 646   | 340        | 80   | 80   | 146      |

### 1.2 Shop-tagged Commerce (shop=supermarket|convenience|department_store|mall)

| Neighborhood    | Estrato | Total | Supermarket | Convenience | Dept Store | Mall |
|----------------|---------|-------|-------------|-------------|------------|------|
| Ciudad Bolivar | 1-2     | 38    | 16          | 21          | 0          | 1    |
| Kennedy        | 2-3     | 271   | 158         | 93          | 5          | 15   |
| Suba           | 3-4     | 149   | 89          | 41          | 4          | 15   |
| Chapinero      | 4-5     | 218   | 74          | 115         | 18         | 11   |
| Usaquen        | 5-6     | 251   | 124         | 89          | 10         | 28   |

### 1.3 Combined Commerce Totals

| Neighborhood    | Estrato | Amenities | Shops | **Total Commerce** | Ratio vs Poorest |
|----------------|---------|-----------|-------|--------------------|------------------|
| Ciudad Bolivar | 1-2     | 34        | 38    | **72**             | 1.0x (baseline)  |
| Kennedy        | 2-3     | 410       | 271   | **681**            | 9.5x             |
| Suba           | 3-4     | 194       | 149   | **343**            | 4.8x             |
| Chapinero      | 4-5     | 1,292     | 218   | **1,510**          | 21.0x            |
| Usaquen        | 5-6     | 646       | 251   | **897**            | 12.5x            |

**Key Finding:** Shop data (supermarkets, convenience stores) is more equitably distributed than amenity data (restaurants, cafes). Kennedy has more supermarkets (158) than Chapinero (74). The bias is concentrated in restaurants and cafes, which tend to be mapped by tech-savvy visitors in wealthier areas.

---

## 2. SITP Bus Stops

### 2.1 Coverage by Neighborhood

| Neighborhood    | Estrato | Total Bus Stops | SITP-tagged | TransMilenio | Untagged |
|----------------|---------|----------------|-------------|--------------|----------|
| Ciudad Bolivar | 1-2     | 42             | 9           | 0            | 33       |
| Kennedy        | 2-3     | 247            | 28          | 28           | 191      |
| Suba           | 3-4     | 114            | 40          | 11           | 63       |
| Chapinero      | 4-5     | 358            | 335         | 1            | 22       |
| Usaquen        | 5-6     | 187            | 66          | 0            | 121      |

### 2.2 City-wide Totals

- **highway=bus_stop nodes:** 2,603
- **SITP-tagged bus stops:** 1,024
- **public_transport=platform (bus):** 1,543
- **Combined unique (estimated):** ~1,900

### 2.3 Tagging Inconsistencies (WARNING)

SITP bus stops use **multiple incompatible tagging schemes**:
- `highway=bus_stop` + `network=SITP` (most common)
- `highway=bus_stop` + `operator=SITP` (some)
- `highway=bus_stop` + `network=sitp` (lowercase variant)
- `highway=bus_stop` + `network=co:dc:sitp` (formal code)
- `public_transport=platform` + `bus=yes` (no SITP tag)
- Many bus stops have NO network/operator tag at all

**Recommendation:** Query must use: `(node["highway"="bus_stop"](bbox); node["public_transport"="platform"]["bus"="yes"](bbox);)` to capture all variants. Do NOT filter by `network=SITP` alone -- this misses ~60% of actual SITP stops.

### 2.4 Overlap with IDECA Data

- **IDECA tm-estaciones.geojson:** 150 TransMilenio stations (trunk line only)
- **OSM TransMilenio stations:** ~1 (virtually no overlap -- OSM does not have TM station data)
- **SITP bus stops:** NO overlap with IDECA data (IDECA has trunk stations, OSM has feeder/regular stops)
- **Conclusion:** OSM SITP data **complements** IDECA -- no deduplication needed for bus stops.

---

## 3. Leisure

### 3.1 Coverage by Neighborhood

| Neighborhood    | Estrato | Fitness | Sports | Cinema | Total |
|----------------|---------|---------|--------|--------|-------|
| Ciudad Bolivar | 1-2     | 0       | 0      | 0      | 0     |
| Kennedy        | 2-3     | 9       | 8      | 5      | 22    |
| Suba           | 3-4     | 0       | 0      | 0      | 0     |
| Chapinero      | 4-5     | 37      | 7      | 7      | 51    |
| Usaquen        | 5-6     | 0       | 0      | 0      | 0     |

### 3.2 City-wide Totals

- **Fitness centres:** 266
- **Sports centres:** 157
- **Cinemas:** 49
- **Total:** ~472

**Key Finding:** Leisure data is extremely patchy and unreliable. Three of five test neighborhoods returned ZERO results, including Usaquen (wealthy) and Suba (middle). This is not a rich/poor bias -- it's simply incomplete mapping. NOT recommended for production use.

---

## 4. Data Quality Assessment

### 4.1 Geographic Bias Analysis

| Category | Bias Severity | Pattern |
|----------|--------------|---------|
| Restaurants/Cafes | **HIGH** | 38:1 ratio (Chapinero vs Ciudad Bolivar). Driven by mapper demographics. |
| Banks/Pharmacies | **MODERATE** | 10:1 ratio. Major chains (Davivienda, Bancolombia) mapped city-wide. |
| Supermarkets (shop tag) | **LOW** | 10:1 ratio but Kennedy > Chapinero. Chain stores well-mapped everywhere. |
| Convenience stores | **LOW** | 5:1 ratio. Small shops are mapped even in lower-income areas. |
| Bus stops | **MODERATE** | 6:1 ratio. Kennedy has good coverage, Ciudad Bolivar is weak. |
| Leisure | **CRITICAL** | Unusable. Most neighborhoods return zero results. |

### 4.2 Name Quality

- **Commerce POIs with names:** ~70% (good)
- **Bus stops with names:** ~30% (poor -- most are just coordinates)
- **Common chains mapped:** Davivienda, Bancolombia, Banco de Bogota, Olimpica, Carulla, Ara, Cooratiendas, Juan Valdez, Drogueria Cafam

### 4.3 Coordinate Validation

All queried coordinates fall within Bogota bounds (lat 4.4-5.0, lng -74.3 to -73.9). No out-of-bounds anomalies detected.

---

## 5. Recommended Overpass Queries (Production)

### 5.1 Commerce Amenities (RECOMMENDED)

```overpass
[out:json][timeout:30];
(
  node["amenity"~"^(restaurant|cafe|bank|pharmacy)$"](4.4,-74.3,4.85,-73.9);
  way["amenity"~"^(restaurant|cafe|bank|pharmacy)$"](4.4,-74.3,4.85,-73.9);
);
out center tags;
```

**Expected count:** ~8,400 POIs

### 5.2 Shops (RECOMMENDED)

```overpass
[out:json][timeout:30];
(
  node["shop"~"^(supermarket|convenience|department_store|mall)$"](4.4,-74.3,4.85,-73.9);
  way["shop"~"^(supermarket|convenience|department_store|mall)$"](4.4,-74.3,4.85,-73.9);
);
out center tags;
```

**Expected count:** ~1,800+ POIs

### 5.3 SITP Bus Stops (CONDITIONAL - needs cleanup)

```overpass
[out:json][timeout:30];
(
  node["highway"="bus_stop"](4.4,-74.3,4.85,-73.9);
  node["public_transport"="platform"]["bus"="yes"](4.4,-74.3,4.85,-73.9);
);
out tags;
```

**Expected count:** ~2,600 stops (after dedup ~1,900 unique)

### 5.4 Leisure (NOT RECOMMENDED)

Coverage too sparse and biased. Skip for now.

---

## 6. Deduplication Strategy

### 6.1 Commerce Dedup

- **Within OSM:** Nodes and ways can describe the same place. Dedup by: distance < 50m AND (name similarity > 0.8 OR same amenity type at exact coordinates).
- **OSM vs IDECA:** No commerce data in IDECA currently. No dedup needed.

### 6.2 Bus Stop Dedup

- **Within OSM:** `highway=bus_stop` and `public_transport=platform` often describe the same stop. Dedup by: distance < 30m.
- **OSM vs IDECA:** IDECA has TransMilenio trunk stations only. OSM has regular bus stops. Minimal overlap -- dedup by distance < 100m and name similarity if both have names.

---

## 7. Final Recommendation

| Category | Decision | Rationale |
|----------|----------|-----------|
| Restaurants | **GO** | 4,636 city-wide. Good coverage even in Kennedy. |
| Cafes | **GO** | 1,451 city-wide. Biased toward wealthy areas but still useful. |
| Banks | **GO** | 891 city-wide. Major chains well-mapped everywhere. |
| Pharmacies | **GO** | 1,456 city-wide. Good chain coverage. |
| Supermarkets | **GO** | 1,763 city-wide (shop tag). Surprisingly good in lower-income areas. |
| Convenience stores | **GO** | Included with supermarkets. |
| SITP Bus Stops | **CONDITIONAL GO** | 1,900+ stops. Inconsistent tagging requires broad query. Ciudad Bolivar coverage weak. |
| Leisure | **NO-GO** | Too sparse (~472 total). Three of five test neighborhoods returned zero. |

### Risk Mitigation

1. **Bias disclosure:** Frontend should show data coverage indicator per neighborhood
2. **Staleness:** OSM data should be refreshed monthly (commerce changes frequently)
3. **Rate limiting:** All Overpass queries must respect 2 req/sec limit
4. **Bounds validation:** Hard-code Bogota bbox filter in all queries
