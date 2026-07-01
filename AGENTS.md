# Agent Instructions

## Project Layout

- `widget/` — React application.
- `widget/src/utils/scoring.js` — motor de puntuación puro. Debe seguir siendo testable sin APIs del navegador.
- `widget/src/components/MapComponent.jsx` — mapa Leaflet con marcadores y radios.
- `widget/public/data/` — activos GeoJSON servidos en runtime.
- `widget/scripts/` — utilidades Node (p. ej., `debug-scoring.js`).
- Los tests viven junto al código fuente: `*.test.js` / `*.test.jsx`.

## Coding Conventions

- Usa componentes funcionales de React y hooks.
- Mantén los helpers de `scoring.js` puros y exportados para tests.
- Importa los módulos de `@turf/*` de forma individual; no importes el bundle completo `@turf/turf`.
- Prefiere nombres descriptivos y constantes con nombre para umbrales y radios.
- Antes de dar por terminado un cambio, ejecuta desde `widget/`:
  ```bash
  npm run lint
  npm test
  npm run build
  ```
- Usa Conventional Commits.

## Tests

- Escribe tests para cualquier función nueva o cambio de comportamiento.
- Sigue TDD cuando sea posible: test rojo → implementación mínima → test verde.
- Los tests de componentes usan `@testing-library/react` + `user-event` + `jsdom`.
