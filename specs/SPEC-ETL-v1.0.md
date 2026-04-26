# Spec-Driven Development: Bogotá Insights ETL

**Metodología:** Specification-Driven Development (SDD)  
**Fase:** Foundation (ETL funcional antes de features avanzadas)  
**Versión:** 1.0.0  

---

## 1. Filosofía SDD para este Proyecto

### 1.1 Principios

1. **Spec First**: Cada componente tiene una especificación escrita antes del código
2. **Testable by Design**: Cada spec debe ser verificable automáticamente
3. **Fail Fast**: Validaciones tempranas, errores claros
4. **Idempotency**: Re-ejecutar el ETL no debe crear duplicados
5. **Observability**: Todo debe ser trackeable y medible

### 1.2 Workflow SDD

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   SPEC       │────▶│    TEST      │────▶│   IMPLEMENT  │
│  (Markdown)  │     │   (Script)   │     │    (Code)    │
└──────────────┘     └──────────────┘     └──────────────┘
        │                    │                    │
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                  VERIFICATION                            │
│         (Automated checks + Manual review)              │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Especificaciones del ETL

### SPEC-001: Ingesta de Datos IDECA

**Status:** ✅ Implemented  
**Priority:** P0 (Critical)  
**Owner:** ETL Pipeline

#### 2.1.1 Objetivo
Ingerir datos oficiales del IDECA (Instituto Distrital de Ciencia, Tecnología e Innovación en Salud) para Bogotá.

#### 2.1.2 Fuentes de Datos
| Dataset | URL | Tipo | Frecuencia Actualización |
|---------|-----|------|-------------------------|
| Colegios | datosabiertos.bogota.gov.co | GeoJSON | Mensual |
| Instituciones de Salud | datosabiertos.bogota.gov.co | GeoJSON | Mensual |
| Bibliotecas | datosabiertos.bogota.gov.co | GeoJSON | Trimestral |
| Parques | datosabiertos.bogota.gov.co | GeoJSON | Anual |

#### 2.1.3 Requisitos Funcionales

**FR-001.1:** El sistema debe descargar datos de IDECA vía HTTP GET
- **Input:** URL del dataset
- **Output:** GeoJSON FeatureCollection válido
- **Error:** Timeout después de 60s, retry 3 veces

**FR-001.2:** El sistema debe parsear GeoJSON y extraer features
- **Input:** GeoJSON con campos: `geometry`, `properties`
- **Output:** Array de features con coordenadas validadas
- **Validación:** Coordenadas dentro de bounds de Bogotá (4.45, -74.27) a (4.84, -73.88)

**FR-001.3:** El sistema debe mapear propiedades a schema POI
```typescript
interface POIMapping {
  source: 'ideca';
  source_id: string;           // ideca-{dataset}-{objectid}
  category: 'education' | 'health' | 'recreation';
  subcategory: string;         // school | university | hospital | clinic | park | library
  name: string | null;
  name_es: string | null;
  location: { lat: number, lng: number };
  address: string | null;
  confidence: number;          // 85-100 basado en completitud
}
```

**FR-001.4:** El sistema debe calcular confidence score
```
Base: 85
+5 si tiene nombre
+5 si tiene dirección
+2 si tiene teléfono
Max: 100
```

**FR-001.5:** El sistema debe hacer upsert a PostgreSQL
- **Query:** `INSERT ... ON CONFLICT (source, source_id) DO UPDATE`
- **Campos actualizados:** name, address, location, confidence, synced_at
- **Campos preservados:** created_at

#### 2.1.4 Requisitos No Funcionales

**NFR-001.1:** Rendimiento
- Ingesta de 2,000 registros en < 2 minutos
- Uso de memoria < 512MB

**NFR-001.2:** Confiabilidad
- Skip de registros inválidos (no fail completo)
- Log de errores con contexto (máximo 5 errores mostrados)

**NFR-001.3:** Observabilidad
- Tabla `sync_runs` con: records_fetched, created, updated, errors
- Timestamp de inicio y fin
- Status: completed | partial | failed

#### 2.1.5 Casos de Prueba

| ID | Caso | Input Esperado | Output Esperado |
|----|------|----------------|-----------------|
| TC-001.1 | Feature válida | Coordenadas dentro de Bogotá | POI insertado |
| TC-001.2 | Coordenadas fuera de bounds | Lat > 5.0 | Skip + log |
| TC-001.3 | Sin geometría | geometry: null | Skip + log |
| TC-001.4 | Polygon en lugar de Point | Polygon válido | Calcular centroid |
| TC-001.5 | Duplicado | Mismo source_id | Update en lugar de insert |
| TC-001.6 | Re-ingesta | Mismos datos | 0 created, N updated |

---

### SPEC-002: Ingesta de Datos OpenStreetMap

**Status:** ✅ Implemented  
**Priority:** P0 (Critical)  
**Owner:** ETL Pipeline

#### 2.2.1 Objetivo
Ingerir datos de OpenStreetMap vía Overpass API para comercios, transporte, salud y educación.

#### 2.2.2 Fuentes de Datos
| Dataset | Overpass Query | Categoría |
|---------|---------------|-----------|
| Commerce Amenities | restaurant, cafe, bank | commerce |
| Commerce Shops | supermarket, mall, convenience | commerce |
| SITP Bus Stops | highway=bus_stop | transport |
| Health Amenities | hospital, clinic, doctors, pharmacy | health |
| Education Facilities | school, university, kindergarten | education |

#### 2.2.3 Requisitos Funcionales

**FR-002.1:** Rate limiting para Overpass API
- **Max rate:** 2 requests por segundo
- **Intervalo mínimo:** 500ms entre requests
- **Timeout:** 120 segundos por request
- **User-Agent:** BogotaInsightsWidget/1.0

**FR-002.2:** Cache local de datos
- **Location:** `packages/api/data/osm-{dataset}.json`
- **Formato:** Overpass JSON response
- **Refresh:** Manual (no auto-expira)
- **Fallback:** Si existe cache, usar sin llamar API

**FR-002.3:** Parseo de elementos Overpass
```typescript
interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number, lon: number }; // para ways
  tags?: Record<string, string>;
}
```

**FR-002.4:** Extracción de coordenadas
- **Node:** Usar lat/lon directamente
- **Way/Relation:** Usar center (de `out center`)
- **Validación:** isWithinBogota(bounds)

**FR-002.5:** Sanitización de datos
- **XSS:** Strip HTML tags de todos los campos
- **Length:** Max 500 caracteres por string
- **Tags permitidos:** name, name:es, amenity, shop, addr:*, brand, opening_hours, etc.

**FR-002.6:** Confidence score por tipo
```
Base: 65-75
+15 si tiene nombre
+5 si tiene dirección
+5 si tiene brand/operator
+5 si tiene opening_hours
Max: 100
```

#### 2.2.4 Requisitos No Funcionales

**NFR-002.1:** Robustez
- Si Overpass API falla, usar cache existente si está disponible
- Si cache no existe, fail con mensaje claro

**NFR-002.2:** Performance
- Ingesta con cache: < 5 minutos para 18,000 POIs
- Sin cache: < 15 minutos (incluyendo descargas)

#### 2.2.5 Casos de Prueba

| ID | Caso | Input | Output |
|----|------|-------|--------|
| TC-002.1 | Cache hit | Archivo local existe | Usar cache, no llamar API |
| TC-002.2 | Cache miss | No existe archivo | Llamar API, guardar cache |
| TC-002.3 | Rate limit | 3 requests rápidos | Esperar 500ms entre cada una |
| TC-002.4 | Way sin center | geometry type: way, no center | Skip + log |
| TC-002.5 | XSS en nombre | name: "<script>alert(1)</script>" | Guardar: "alert(1)" |
| TC-002.6 | Tags largos | value de 1000 caracteres | Truncar a 500 |

---

### SPEC-003: Ingesta de Datos TransMilenio

**Status:** ✅ Implemented  
**Priority:** P0 (Critical)  
**Owner:** ETL Pipeline

#### 2.3.1 Objetivo
Ingerir estaciones de TransMilenio desde la API oficial de Esri.

#### 2.3.2 Fuente de Datos
- **URL:** `https://gis.transmilenio.gov.co/arcgis/rest/services/Troncal/consulta_estaciones_troncales/MapServer/0/query`
- **Formato:** Esri REST GeoJSON
- **Frecuencia:** Mensual

#### 2.3.3 Requisitos Funcionales

**FR-003.1:** Consulta a Esri REST API
- **Method:** GET
- **Params:** `where=1=1`, `outFields=*`, `returnGeometry=true`, `f=geojson`
- **Timeout:** 30 segundos

**FR-003.2:** Clasificación de estaciones
```typescript
function getSubcategory(props): string {
  if (nombre.includes('portal')) return 'bus_station';
  if (tipo.includes('cabecera')) return 'bus_station';
  if (tipo.includes('intermedia')) return 'bus_stop';
  return 'bus_station';
}
```

**FR-003.3:** Confidence score
- **Base:** 92 (datos oficiales de alta calidad)
- **+3** si tiene nombre
- **+3** si tiene ubicación
- **Max:** 100

#### 2.3.4 Casos de Prueba

| ID | Caso | Output |
|----|------|--------|
| TC-003.1 | Portal Norte | subcategory: bus_station |
| TC-003.2 | Estación intermedia | subcategory: bus_stop |
| TC-003.3 | Sin geometría | Skip |

---

### SPEC-004: Sync Runs y Observabilidad

**Status:** ✅ Implemented  
**Priority:** P1 (High)  
**Owner:** ETL Pipeline

#### 2.4.1 Objetivo
Trackear todas las ejecuciones del ETL para debugging, auditoría y métricas.

#### 2.4.2 Schema sync_runs
```sql
CREATE TABLE sync_runs (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,          -- 'ideca', 'osm', 'transmilenio'
  sync_type VARCHAR(50) NOT NULL,       -- 'full', 'incremental'
  status VARCHAR(20) NOT NULL,          -- 'running', 'completed', 'partial', 'failed'
  
  -- Métricas
  records_fetched INTEGER,
  records_created INTEGER,
  records_updated INTEGER,
  records_deleted INTEGER,
  duplicates_found INTEGER,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,                  -- Computed
  
  -- Errores
  error_message TEXT,
  error_details JSONB
);
```

#### 2.4.3 Requisitos Funcionales

**FR-004.1:** Crear registro al inicio
- **Trigger:** Al comenzar cada ingestor
- **Status:** 'running'

**FR-004.2:** Actualizar registro al finalizar
- **Status:** 'completed' (0 errores), 'partial' (>0 errores), 'failed' (exception)
- **Métricas:** Conteos reales de registros
- **Duration:** EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000

**FR-004.3:** Query de resumen
```sql
SELECT 
  source,
  COUNT(*) as total_runs,
  SUM(records_created) as total_created,
  AVG(duration_ms) as avg_duration
FROM sync_runs
WHERE status = 'completed'
GROUP BY source;
```

---

### SPEC-005: Verificación Post-ETL

**Status:** 📝 Spec Only (Implementation needed)  
**Priority:** P0 (Critical)  
**Owner:** QA/Verification Script

#### 2.5.1 Objetivo
Verificar automáticamente que el ETL funcionó correctamente después de cada ejecución.

#### 2.5.2 Checks Automáticos

**CHK-001: Conteos por Fuente**
```sql
-- Esperado:
-- ideca: 5,000-7,000
-- osm: 15,000-20,000
-- transmilenio: 100-200
SELECT source, COUNT(*) FROM pois WHERE is_canonical = TRUE GROUP BY source;
```

**CHK-002: Distribución por Categoría**
```sql
-- Esperado:
-- education: 3,000-5,000
-- health: 2,000-3,000
-- commerce: 10,000-15,000
-- transport: 5,000-7,000
-- recreation: 3,000-5,000
SELECT category, COUNT(*) FROM pois GROUP BY category;
```

**CHK-003: Sin Duplicados**
```sql
-- Esperado: 0 rows
SELECT source, source_id, COUNT(*) 
FROM pois 
GROUP BY source, source_id 
HAVING COUNT(*) > 1;
```

**CHK-004: Coordenadas Válidas**
```sql
-- Esperado: 0 rows
SELECT COUNT(*) FROM pois 
WHERE location IS NULL 
   OR ST_Y(location::geometry) < 4.45 
   OR ST_Y(location::geometry) > 4.84;
```

**CHK-005: Confidence Score Rango**
```sql
-- Esperado: 0 rows
SELECT COUNT(*) FROM pois WHERE confidence < 0 OR confidence > 100;
```

**CHK-006: Sync Run Reciente**
```sql
-- Esperado: último sync_run en las últimas 24h para cada source
SELECT source, MAX(started_at) 
FROM sync_runs 
WHERE status IN ('completed', 'partial')
GROUP BY source;
```

#### 2.5.3 Thresholds de Aceptación

| Check | Mínimo | Óptimo | Crítico |
|-------|--------|--------|---------|
| Total POIs | 20,000 | 27,000 | < 15,000 |
| IDECA | 4,000 | 6,000 | < 3,000 |
| OSM | 12,000 | 18,000 | < 10,000 |
| Duplicados | 0 | 0 | > 10 |
| Sin coordenadas | 0 | 0 | > 0 |

---

## 3. Implementation Guide

### 3.1 Estructura de Archivos

```
packages/api/
├── specs/
│   └── SPEC-001-ideca.md         (Este documento)
├── src/
│   ├── services/
│   │   ├── ideca-ingest.ts       (Implementación SPEC-001)
│   │   ├── osm-ingest.ts         (Implementación SPEC-002)
│   │   ├── transmilenio-ingest.ts (Implementación SPEC-003)
│   │   └── ingest-runner.ts      (Orquestador)
│   ├── db/
│   │   ├── queries.ts            (FR-001.5, FR-002.5)
│   │   └── migrate.ts            (Schema SPEC-004)
│   └── verification/
│       └── etl-check.ts          (SPEC-005 - Nuevo)
├── tests/
│   ├── unit/                     (Tests por función)
│   └── integration/              (Tests end-to-end)
└── scripts/
    └── verify-etl.sh             (Script de verificación)
```

### 3.2 Definición de Done

Para cada SPEC, el criterio de completitud es:

- [ ] Especificación escrita y revisada
- [ ] Tests unitarios escritos (cobertura > 80%)
- [ ] Tests de integración escritos
- [ ] Implementación pasa todos los tests
- [ ] Script de verificación pasa (SPEC-005)
- [ ] Documentación actualizada
- [ ] Code review aprobado

---

## 4. Próximos Pasos (SDD Iteration)

### Sprint Actual: Foundation
**Objetivo:** ETL funcional y verificado

**Specs:**
- [x] SPEC-001: IDECA Ingest
- [x] SPEC-002: OSM Ingest
- [x] SPEC-003: TransMilenio Ingest
- [x] SPEC-004: Sync Runs
- [ ] SPEC-005: Verification Script (Implementar)

### Siguiente Sprint: Knowledge Base (Después de foundation sólida)
**Specs pendientes:**
- SPEC-006: Knowledge Base Schema
- SPEC-007: Embeddings Generation
- SPEC-008: LLM Integration

### Sprint Futuro: Graph Database
**Specs pendientes:**
- SPEC-009: Neo4j Schema
- SPEC-010: Barrio Relationships
- SPEC-011: Pathfinding Queries

---

*Documento de especificaciones - SDD v1.0*