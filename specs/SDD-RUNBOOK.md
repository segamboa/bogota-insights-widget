# SDD Runbook - Bogotá Insights Widget

**Metodología:** Specification-Driven Development (SDD)  
**Estado:** Foundation Phase (ETL Verification)  
**Última actualización:** Abril 2026

---

## 🎯 Quick Start

### Verificación del ETL (Después de ingest)

```bash
cd bogota-insights-widget/packages/api

# 1. Verificar que todo está funcionando
npm run verify:etl

# 2. Verificación estricta (falla en warnings también)
npm run verify:etl:strict

# 3. Pipeline completo (migrar + ingest + verificar)
npm run pipeline
```

### Resultados esperados

```
[PASS] CHK-001: Source Counts
      Total: 27,423 POIs (optimal: 27000)

[PASS] CHK-002: Category Distribution
      All categories within expected ranges

[PASS] CHK-003: No Duplicates
      No duplicates found

[PASS] CHK-004: Valid Coordinates
      All POIs have valid coordinates within Bogota bounds

[PASS] CHK-005: Confidence Score Range
      All confidence scores in valid range (0-100)

[PASS] CHK-006: Recent Sync Runs
      Found 3 sync run(s) in last 24h

[PASS] CHK-007: Subcategory Diversity
      Good diversity across all categories

[PASS] CHK-008: Data Freshness
      All data synced within last 30 days

Results: 8 PASS, 0 WARN, 0 FAIL
✓ ALL CHECKS PASSED
ETL is healthy and ready for production.
```

---

## 📋 Especificaciones (Specs)

### Estructura de Specs

```
specs/
├── SPEC-ETL-v1.0.md           (Este documento)
├── SPEC-KB-v1.0.md            (Knowledge Base - pendiente)
└── SPEC-GRAPH-v1.0.md         (Graph Database - pendiente)
```

### Specs Implementados ✅

| ID | Título | Status | Archivo |
|----|--------|--------|---------|
| SPEC-001 | IDECA Ingest | ✅ | `src/services/ideca-ingest.ts` |
| SPEC-002 | OSM Ingest | ✅ | `src/services/osm-ingest.ts` |
| SPEC-003 | TransMilenio Ingest | ✅ | `src/services/transmilenio-ingest.ts` |
| SPEC-004 | Sync Runs | ✅ | `src/db/migrate.ts` |
| SPEC-005 | Verification Script | ✅ | `src/verification/etl-check.ts` |

### Specs Pendientes 📝

| ID | Título | Prioridad | Dependencias |
|----|--------|-----------|--------------|
| SPEC-006 | Knowledge Base Schema | P1 | SPEC-005 ✅ |
| SPEC-007 | Embeddings Generation | P1 | SPEC-006 |
| SPEC-008 | LLM Integration | P2 | SPEC-007 |
| SPEC-009 | Neo4j Schema | P2 | SPEC-005 ✅ |
| SPEC-010 | Barrio Relationships | P2 | SPEC-009 |
| SPEC-011 | Pathfinding Queries | P3 | SPEC-010 |

---

## 🔍 Checks de Verificación

### CHK-001: Source Counts
**Valida:** Número de POIs por fuente de datos

| Fuente | Mínimo | Óptimo | Crítico |
|--------|--------|--------|---------|
| ideca | 4,000 | 6,000 | 3,000 |
| osm | 12,000 | 18,000 | 10,000 |
| transmilenio | 100 | 150 | 50 |
| **Total** | **20,000** | **27,000** | **15,000** |

**Query SQL:**
```sql
SELECT source, COUNT(*) FROM pois WHERE is_canonical = TRUE GROUP BY source;
```

### CHK-002: Category Distribution
**Valida:** Distribución de POIs por categoría

| Categoría | Rango Esperado |
|-----------|----------------|
| education | 3,000 - 5,000 |
| health | 2,000 - 3,000 |
| commerce | 10,000 - 15,000 |
| transport | 5,000 - 7,000 |
| recreation | 3,000 - 5,000 |

### CHK-003: No Duplicates
**Valida:** No hay duplicados (source, source_id)

```sql
SELECT source, source_id, COUNT(*) 
FROM pois 
GROUP BY source, source_id 
HAVING COUNT(*) > 1;
```

**Esperado:** 0 rows

### CHK-004: Valid Coordinates
**Valida:** Todas las coordenadas dentro de Bogotá

**Bounds:**
- Lat: 4.45 a 4.84
- Lng: -74.27 a -73.88

### CHK-005: Confidence Score Range
**Valida:** Todos los scores entre 0-100

**Distribución esperada:**
- 90-100: Datos oficiales de alta calidad
- 70-89: Datos OSM completos
- 50-69: Datos OSM básicos
- 0-49: Datos mínimos (raro)

### CHK-006: Recent Sync Runs
**Valida:** Hay sync runs recientes (últimas 24h)

**Esperado:** Al menos un run por fuente (ideca, osm, transmilenio)

### CHK-007: Subcategory Diversity
**Valida:** Diversidad de subcategorías por categoría

| Categoría | Subcategorías mínimas esperadas |
|-----------|--------------------------------|
| transport | 3 (bus_station, bus_stop, parada_sitp) |
| commerce | 6 (restaurante, cafe, banco, supermercado, tienda, centro_comercial) |
| education | 4 (school, university, kindergarten, library) |
| health | 4 (hospital, clinic, doctors, pharmacy) |
| recreation | 3 (park, playground, sports) |

### CHK-008: Data Freshness
**Valida:** Datos no mayores a 30 días

```sql
SELECT source, MAX(synced_at) FROM pois GROUP BY source;
```

---

## 🚀 Workflow SDD

### Paso 1: Especificar
**Antes de escribir código:**

1. Crear archivo `specs/SPEC-XXX-nombre.md`
2. Definir:
   - Objetivo
   - Requisitos funcionales (FR-XXX)
   - Requisitos no funcionales (NFR-XXX)
   - Casos de prueba (TC-XXX)
   - Thresholds de aceptación

### Paso 2: Verificar
**Después de implementar:**

```bash
# 1. Verificar especificación
npm run verify:etl

# 2. Si falla, iterar
# 3. Si pasa, continuar
```

### Paso 3: Iterar
**Si la verificación falla:**

1. Revisar el check que falló
2. Ajustar implementación o thresholds
3. Re-ejecutar verificación
4. Actualizar spec si es necesario

---

## 📊 Métricas de Calidad

### Dashboard de Salud del ETL

Ejecutar después de cada ingest:

```bash
npm run verify:etl
```

**Métricas clave:**
- **Coverage:** Total POIs / Área de Bogotá (POIs/km²)
- **Diversity:** Unique subcategories / Total categories
- **Freshness:** Promedio de días desde último sync
- **Accuracy:** % de POIs con confidence > 70

### Alertas Automáticas

El sistema debe alertar cuando:
- Total POIs < 20,000
- Alguna fuente no tenga sync en > 7 días
- Duplicados > 10
- Fallas de ingest consecutivas > 3

---

## 🔧 Troubleshooting

### "No POIs found"
```bash
# Verificar que las migraciones corrieron
npm run migrate

# Verificar que hay datos en PostgreSQL
psql $DATABASE_URL -c "SELECT COUNT(*) FROM pois;"
```

### "Duplicates found"
```bash
# Ver los duplicados
psql $DATABASE_URL -c "
  SELECT source, source_id, COUNT(*) 
  FROM pois 
  GROUP BY source, source_id 
  HAVING COUNT(*) > 1;
"

# Limpiar duplicados (si es necesario)
psql $DATABASE_URL -c "
  DELETE FROM pois
  WHERE id IN (
    SELECT id
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY source, source_id ORDER BY synced_at DESC) as rn
      FROM pois
    ) t
    WHERE t.rn > 1
  );
"
```

### "Sync runs old"
```bash
# Re-ejecutar ingest completo
npm run pipeline
```

---

## 📈 Roadmap SDD

### Fase 1: Foundation (Actual) ✅
- [x] ETL funcional y verificado
- [x] Specs escritos (SPEC-001 a SPEC-005)
- [x] Verification script
- [ ] Tests unitarios (cobertura > 80%)

### Fase 2: Knowledge Base (Próximo)
- [ ] SPEC-006: Schema Knowledge Base
- [ ] SPEC-007: Embeddings Generation
- [ ] Implementar vector search
- [ ] Integrar con LLM

### Fase 3: Graph Database (Futuro)
- [ ] SPEC-009: Neo4j Schema
- [ ] SPEC-010: Barrio Relationships
- [ ] Query de barrios similares
- [ ] Pathfinding (rutas óptimas)

### Fase 4: Advanced Features (Futuro lejano)
- [ ] Precios predictivos con ML
- [ ] Trend analysis de barrios
- [ ] Alertas de valorización
- [ ] Recomendaciones personalizadas

---

## 📝 Ejemplo de Flujo Completo

```bash
# 1. Setup inicial
git clone <repo>
cd bogota-insights-widget/packages/api
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con DATABASE_URL y REDIS_URL

# 3. Setup base de datos
npm run migrate

# 4. Ingesta inicial
npm run ingest

# 5. Verificación
npm run verify:etl

# 6. Resultado esperado:
# Results: 8 PASS, 0 WARN, 0 FAIL
# ✓ ALL CHECKS PASSED
# ETL is healthy and ready for production.
```

---

## 🎓 Principios SDD Aplicados

### 1. Spec First
Cada feature empieza con un documento de especificación antes de escribir código.

### 2. Testable by Design
Las specs definen casos de prueba verificables automáticamente.

### 3. Fail Fast
Validaciones tempranas, errores claros, no silenciar fallos.

### 4. Idempotency
Re-ejecutar el ETL no debe crear duplicados ni inconsistencias.

### 5. Observability
Todo es trackeable: conteos, timestamps, errores, métricas.

---

*Runbook v1.0 - SDD Bogotá Insights Widget*