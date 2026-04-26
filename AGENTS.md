# Bogotá Insights Widget — Contexto para Agentes

## Qué es este proyecto

Widget embebible de **insights inmobiliarios para Bogotá, Colombia**. Se vende a páginas de inmobiliarias como un script `<script>` que se inserta en sus listados de propiedades. El widget analiza la ubicación del inmueble y muestra:

- Score general del barrio (0-100)
- Perfil de la zona (Urbano, Familiar, Tranquilo, etc.)
- Fortalezas específicas (cercanía a colegios, parques, transporte, salud)
- POIs más cercanos con distancias

## Arquitectura

Monorepo **pnpm workspace + Turborepo** con 3 packages:

```
packages/
  api/      → Fastify + TypeScript + PostGIS + Redis
  widget/   → Preact web component (Vite build)
  shared/   → Tipos, constantes, utilidades compartidas
jobs/       → Vacío (reservado para futuros workers)
```

**Backend:** API REST con autenticación por API key, rate limiting, 3 niveles de caché (Redis → PostgreSQL → localStorage).

**Frontend:** Web Component `<bogota-insights-widget>` con Shadow DOM para aislamiento CSS.

## Qué debe funcionar sí o sí

1. **ETL de POIs** — El pipeline de ingesta de puntos de interés es el corazón del producto. Debe ejecutarse, verificarse y mantener datos actualizados.
   - Fuentes: IDECA (datos oficiales Bogotá), OpenStreetMap, TransMilenio
   - Verificación: `pnpm verify:etl` en `packages/api`
   - Especificaciones: ver `specs/SPEC-ETL-v1.0.md`

2. **Widget embebible** — Debe compilarse a un bundle JS + CSS que cualquier inmobiliaria pueda insertar con un `<script>`.

## Roadmap y decisiones abiertas

- **Grafo de conocimiento:** Planeado como valor añadido futuro. Aún no hay nada definido ni código escrito. No agregar infraestructura de grafo hasta que haya una especificación clara.
- **Multi-ciudad:** Actualmente hardcodeado a Bogotá. La abstracción de ciudad/esquema está en el radar pero no es prioridad inmediata.
- **Scrapers de propiedades:** MetroCuadrado es un POC. La arquitectura debe permitir múltiples fuentes (FincaRaíz, Properati, etc.) sin acoplamiento.

## Principios de desarrollo

- **Simple primero:** Mínimo código que resuelva el problema. Sin abstracciones para uso único.
- **Cambios quirúrgicos:** Tocar solo lo necesario. No "mejorar" código adyacente.
- **ETL verificable:** Cada cambio en el pipeline debe poder validarse con `verify:etl`.
- **Tests antes de refactorizar:** El widget y shared actualmente no tienen tests. Priorizar cobertura básica antes de cambios grandes.

## Stack técnico

- Node.js ≥20, pnpm ≥8, TypeScript 5.3
- PostgreSQL 16 + PostGIS, Redis 7
- Fastify 4, Preact 10, Vite 5
- Vitest para testing
- Docker / docker-compose para infraestructura local
