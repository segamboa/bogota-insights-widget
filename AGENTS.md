# Bogotá Insights Widget — Contexto para Agentes

## Qué es este proyecto

Widget embebible de **insights inmobiliarios para Bogotá, Colombia**. Se vende a páginas de inmobiliarias como un script `<script>` que se inserta en sus listados de propiedades. El widget analiza la ubicación del inmueble y muestra:

- **Score general** del barrio (0-100) con badge visual prominente
- **5 categorías**: Transporte, Comercio, Educación, Salud, Recreación
- **Investment Score** — señal de compra/venta basada en potencial de valorización
- **Contexto de mercado**: percentil ciudad, mediana local, comparación con promedios
- **Tendencias**: si el barrio está mejorando o declinando (month-over-month)
- **POIs cercanos** con distancias reales

## Arquitectura

Monorepo **pnpm workspace + Turborepo** con 3 packages:

```
packages/
  api/      → Fastify + TypeScript + PostGIS + Redis
  widget/   → Preact web component (Vite build)
  shared/   → Tipos, constantes, utilidades compartidas
```

**Backend:** API REST con autenticación por API key, rate limiting, 3 niveles de caché (Redis → PostgreSQL insights_cache → localStorage del widget).

**Frontend:** Web Component `<bogota-insights>` con Shadow DOM para aislamiento CSS.

## Estado actual del producto (última sesión)

### Widget (rediseñado)
- **Vista cliente (por defecto)**: Icono + nombre de categoría + 1 línea de resumen amigable + score pill. Sin números técnicos.
- **Vista expandida (click)**: Percentil, trend (↑↓→), barras de mediana ciudad vs local, lista de POIs detallada.
- **Investment card**: Destacada con borde lateral de color según la señal (strong_buy/buy/hold/watch).
- **Score rings**: Anillos SVG con número centrado + icono de categoría + etiqueta debajo.
- **Header**: Nombre del barrio (reverse geocoding) + score general circular grande + estrato como pill sutil.
- **Temas**: Light y dark funcionales.
- **Bundle**: ~19.6 KB gzipped (límite: 50 KB).

### API
- **Investment Score v2**: Fórmula híbrida (`basicUpside*0.30 + gapVsMedian*0.25 + diversity*0.20 + proximity*0.15 + trend*0.10`). Mapeo lineal `score = 25 + (raw/100)*75`.
- **Percentiles**: Calculados desde survey JSON (`packages/api/data/survey-urban-fine.json`, 185 puntos urbanos).
- **Local context**: Medianas y percentiles dentro de radio 3km usando Haversine.
- **Trends**: Tabla `score_snapshots` guarda scores mensuales. Se comparan vs snapshot anterior.
- **Reverse geocoding**: Nominatim (OpenStreetMap) con cache Redis 1 semana. Fallback silencioso.
- **Datos**: ~26,000 POIs (IDECA ~8,500 + OSM ~17,200 + TransMilenio 152).

### ETL y datos
- Fuentes: IDECA, OpenStreetMap, TransMilenio GTFS.
- Ingesta: `pnpm ingest` en `packages/api`.
- Verificación: `pnpm verify:etl`.
- Cache invalidation: `flushInsightsCache()` (Redis) + `clearInsightsCache()` (PostgreSQL) al finalizar ETL.

## Tablas de base de datos relevantes

| Tabla | Propósito |
|-------|-----------|
| `pois` | POIs canónicos (~26k filas) con PostGIS geography(Point,4326) |
| `insights_cache` | Cache de respuestas API por geohash (24h TTL) |
| `score_snapshots` | Series temporales de scores para trend tracking |
| `properties` | **Vacía** — reservada para datos inmobiliarios futuros |
| `api_keys` | Rate limiting por tier |

## Decisiones de diseño importantes

1. **Investment score es heurístico** (no usa precios reales). La tabla `properties` existe pero está vacía. La correlación precios-score es planeado como fase futura.
2. **Survey JSON** (`survey-urban-fine.json`) se carga en runtime. Debe estar en el build context de Docker.
3. **Caché por geohash-6** (~1.2km x 0.6km). Peticiones dentro del mismo geohash comparten cache.
4. **Mock data** en widget (`packages/widget/src/utils/api.ts`) tiene perfiles por ubicación para demo offline.

## Cómo levantar localmente

```bash
# Infraestructura (PostgreSQL + Redis)
docker-compose up -d

# API
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock  # si usas Colima
cd packages/api && pnpm dev   # localhost:3000

# Widget demo
cd packages/widget && pnpm dev   # localhost:5173
```

## Tests

```bash
# API (40 tests)
cd packages/api && pnpm test:run

# Widget (16 tests)
cd packages/widget && pnpm test

# Shared (7 tests)
cd packages/shared && pnpm test
```

## Stack técnico

- Node.js ≥20, pnpm ≥8, TypeScript 5.3
- PostgreSQL 16 + PostGIS, Redis 7
- Fastify 4, Preact 10, Vite 5
- Vitest para testing
- Docker / Colima para infraestructura local
- Nominatim para reverse geocoding
