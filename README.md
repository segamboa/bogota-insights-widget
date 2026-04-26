# Bogotá Insights Widget

Widget embebible de **insights inmobiliarios para Bogotá, Colombia**. Se inserta en páginas de inmobiliarias como un script y analiza la ubicación de cada propiedad para mostrar scores de barrio, perfiles de zona y puntos de interés cercanos.

## 🏗️ Arquitectura

Monorepo con **pnpm workspaces** y **Turborepo**:

```
packages/
  api/      → Fastify backend (Node.js 20+, TypeScript, PostGIS, Redis)
  widget/   → Preact web component embebible (Vite)
  shared/   → Tipos, constantes y utilidades compartidas
jobs/       → Vacío (reservado para futuros workers)
specs/      → Especificaciones SDD del pipeline ETL
docs/       → Documentación adicional
```

**Backend:** API REST con autenticación por API key, rate limiting y 3 niveles de caché (Redis → PostgreSQL insights_cache → localStorage del widget).

**Frontend:** Web Component `<bogota-insights-widget>` con Shadow DOM para aislamiento CSS. Se distribuye como un bundle JS + CSS que las inmobiliarias insertan con un `<script>`.

## 🚀 Setup local

### Requisitos

- Node.js ≥20
- pnpm ≥8
- Docker + docker-compose

### 1. Levantar infraestructura

```bash
docker-compose up -d
```

Esto levanta PostgreSQL 16 + PostGIS y Redis 7.

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Configurar variables de entorno

Copiar y ajustar:

```bash
cp packages/api/.env.example packages/api/.env
```

### 4. Ejecutar migraciones

```bash
cd packages/api
pnpm migrate
```

### 5. Seed de datos de desarrollo (opcional, rápido)

Si quieres probar el widget inmediatamente sin descargar datos reales:

```bash
cd packages/api
pnpm seed
```

Inserta ~25 POIs de demo alrededor de Chapinero y una API key de desarrollo.

### 6. Ingesta de datos reales (POIs)

```bash
pnpm ingest
```

Descarga e inserta datos de IDECA, OpenStreetMap y TransMilenio. Requiere conexión a internet.

### 7. Verificar calidad del ETL

```bash
pnpm verify:etl
```

Ejecuta 8 checks automatizados sobre los datos ingestados.

### 7. Levantar en modo desarrollo

```bash
# Terminal 1: API
pnpm dev

# Terminal 2: Widget demo
# (ver packages/widget/README.md)
```

## 🧪 Testing

```bash
# Ejecutar todos los tests
pnpm test

# Tests con cobertura (API)
cd packages/api
pnpm test:coverage
```

**Nota:** Actualmente solo `packages/api` tiene tests. `widget` y `shared` están pendientes.

## 📦 Scripts útiles por package

### `packages/api`

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | API en modo watch (tsx) |
| `pnpm seed` | Inserta datos de demo para desarrollo |
| `pnpm ingest` | Pipeline completo de ingesta |
| `pnpm ingest:ideca` | Solo IDECA |
| `pnpm ingest:osm` | Solo OpenStreetMap |
| `pnpm ingest:transmilenio` | Solo TransMilenio |
| `pnpm verify:etl` | Verificación SDD del ETL |
| `pnpm verify:etl:strict` | Verificación estricta (falla en warnings) |
| `pnpm pipeline` | migrate + ingest + verify |
| `pnpm test` | Tests unitarios con Vitest |

### `packages/widget`

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Servidor de desarrollo Vite |
| `pnpm build` | Compila el bundle para producción |
| `pnpm preview` | Previsualiza el build |

## 📡 API Endpoints

| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `GET /health` | — | Estado de DB + Redis |
| `GET /v1/insights` | API Key | Análisis completo de barrio |
| `GET /v1/scores` | API Key | Scores ligeros |
| `GET /v1/pois` | API Key | Datos crudos de POIs |
| `GET /v1/heatmap` | API Key | Datos para heatmap |
| `GET /v1/facilities` | API Key | Instalaciones cercanas |
| `GET /v1/profiles` | API Key | Perfiles de ubicación |

## 📊 Fuentes de datos

Los POIs se ingestan desde:

- **IDECA** — Datos oficiales de Bogotá (colegios, IPS, bibliotecas, parques)
- **OpenStreetMap** — Comercios, restaurantes, parques, paradas SITP
- **TransMilenio** — Estaciones y paradas vía API Esri REST

## 🗺️ Roadmap

- [x] Widget embebible con análisis de barrio
- [x] Pipeline ETL con verificación SDD
- [x] API REST con caché multi-nivel
- [ ] Tests para widget y shared
- [ ] Dockerfile para API
- [ ] Multi-fuente de propiedades (MetroCuadrado → FincaRaíz, Properati)
- [ ] Grafo de conocimiento (planeado, sin especificación aún)

## 📚 Documentación adicional

- `DEPLOYMENT.md` — Guía de deploy en producción
- `SECURITY-AUDIT.md` — Auditoría de seguridad
- `specs/SPEC-ETL-v1.0.md` — Especificaciones del pipeline ETL
- `specs/SDD-RUNBOOK.md` — Runbook de operación SDD

---

*Widget creado con datos reales de Bogotá — 2026*
