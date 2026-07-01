# Widget Inmobiliario Cleanup and Testability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Sub-agents MUST follow superpowers:test-driven-development for all production code changes.

**Goal:** Leave the widget in a clean, tested, lint-passing, build-passing state with real unit tests for scoring, basic component tests, fixed data duplication, and improved UX/error handling.

**Architecture:** Keep the existing React + Vite + Leaflet + Turf stack. Extract pure scoring helpers so they can be unit-tested without the browser or full GeoJSON files. Use Vitest + jsdom + React Testing Library for fast tests. Use ESLint flat config. Remove duplicated data assets and keep the canonical source in `widget/public/data/`. Add minimal POI visualization on the map.

**Tech Stack:** React 18, Vite 5, ESLint 9 flat config, Vitest 2, @testing-library/react, jsdom, Leaflet, react-leaflet, @turf/* (modular imports).

---

## Task 1: Configure ESLint with flat config

**Files:**
- Create: `widget/eslint.config.js`
- Delete: `widget/.eslintrc.*` if exists (none currently)
- Test: `npm run lint` from `widget/`

- [ ] **Step 1: Add ESLint flat config**

Create `widget/eslint.config.js`:

```js
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react/react-in-jsx-scope': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
```

- [ ] **Step 2: Install ESLint flat-config dependencies**

Run from `widget/`:

```bash
npm install -D @eslint/js globals eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh
```

- [ ] **Step 3: Update lint script (optional)**

Ensure `widget/package.json` has:

```json
"lint": "eslint ."
```

- [ ] **Step 4: Run lint and fix auto-fixable issues**

```bash
npm run lint -- --fix
```

Expected: lint passes or surfaces only issues to fix in later tasks.

- [ ] **Step 5: Commit**

```bash
git add widget/eslint.config.js widget/package.json widget/package-lock.json
git commit -m "chore: configure ESLint flat config and install plugins"
```

---

## Task 2: Set up Vitest + Testing Library

**Files:**
- Create: `widget/vitest.config.js`
- Create: `widget/src/test/setup.js`
- Modify: `widget/package.json`
- Test: `npm test` from `widget/`

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create Vitest config**

`widget/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
```

- [ ] **Step 3: Create test setup**

`widget/src/test/setup.js`:

```js
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add test script**

Update `widget/package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Run tests (empty suite should pass)**

```bash
npm test
```

Expected: `No test files found` or `0 passing` with exit 0.

- [ ] **Step 6: Commit**

```bash
git add widget/vitest.config.js widget/src/test/setup.js widget/package.json widget/package-lock.json
git commit -m "chore: set up Vitest with jsdom and React Testing Library"
```

---

## Task 3: Refactor scoring.js for testability and correctness

**Files:**
- Create: `widget/src/utils/scoring.test.js`
- Modify: `widget/src/utils/scoring.js`
- Modify: `widget/package.json` (replace `@turf/turf` with modular packages)

**Goal:** Make `calculateScores` pure, tested, and align category criteria with `debug_scoring.js` findings. Keep the same public API.

- [ ] **Step 1: Replace monolithic turf dependency with modular imports**

```bash
npm uninstall @turf/turf
npm install @turf/point-to-line-distance @turf/distance @turf/centroid @turf/helpers @turf/invariant
```

- [ ] **Step 2: Write failing tests for scoring helpers**

Create `widget/src/utils/scoring.test.js` with tests for:

```js
import { describe, it, expect } from 'vitest'
import { calculateScores } from './scoring'

const makePointFeature = (lat, lng, properties = {}) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lng, lat] },
  properties,
})

const makeLineFeature = (coordinates, properties = {}) => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates },
  properties,
})

const emptyData = {
  pois: { type: 'FeatureCollection', features: [] },
  primaryRoads: { type: 'FeatureCollection', features: [] },
  secondaryRoads: { type: 'FeatureCollection', features: [] },
  hospEscEntret: { type: 'FeatureCollection', features: [] },
  publicTransport: { type: 'FeatureCollection', features: [] },
}

describe('calculateScores', () => {
  it('returns default low scores for empty data', () => {
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, emptyData)
    expect(result.scores.walking.total).toBe(0)
    expect(result.scores.driving.total).toBe(0)
    expect(result.scores.transport).toBeLessThanOrEqual(3)
  })

  it('counts transport stops within walking radius', () => {
    const data = {
      ...emptyData,
      publicTransport: {
        type: 'FeatureCollection',
        features: [
          makePointFeature(4.656, -74.056, { highway: 'bus_stop' }),
          makePointFeature(4.656, -74.056, { public_transport: 'platform' }),
          makePointFeature(4.657, -74.057, { public_transport: 'stop_position' }),
          makePointFeature(4.7, -74.1, { highway: 'bus_stop' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.walk.transport).toBe(3)
    expect(result.scores.walking.details.transport).toBeGreaterThan(0)
  })

  it('counts education amenities within walking radius', () => {
    const data = {
      ...emptyData,
      hospEscEntret: {
        type: 'FeatureCollection',
        features: [
          makePointFeature(4.656, -74.056, { amenity: 'school' }),
          makePointFeature(4.656, -74.057, { amenity: 'library' }),
          makePointFeature(4.656, -74.058, { amenity: 'kindergarten' }),
          makePointFeature(4.7, -74.1, { amenity: 'school' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.walk.education).toBe(3)
  })

  it('counts health including clinic and doctors within drive radius', () => {
    const data = {
      ...emptyData,
      hospEscEntret: {
        type: 'FeatureCollection',
        features: [
          makePointFeature(4.656, -74.056, { amenity: 'hospital' }),
          makePointFeature(4.656, -74.057, { amenity: 'clinic' }),
          makePointFeature(4.656, -74.058, { amenity: 'doctors' }),
          makePointFeature(4.9, -74.3, { amenity: 'hospital' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.drive.health).toBe(3)
  })

  it('counts universities and colleges within drive radius', () => {
    const data = {
      ...emptyData,
      hospEscEntret: {
        type: 'FeatureCollection',
        features: [
          makePointFeature(4.656, -74.056, { amenity: 'university' }),
          makePointFeature(4.656, -74.057, { amenity: 'college' }),
          makePointFeature(4.9, -74.3, { amenity: 'university' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.drive.university).toBe(2)
  })

  it('counts daily amenities from pois', () => {
    const data = {
      ...emptyData,
      pois: {
        type: 'FeatureCollection',
        features: [
          makePointFeature(4.656, -74.056, { shop: 'supermarket' }),
          makePointFeature(4.656, -74.057, { amenity: 'pharmacy' }),
          makePointFeature(4.656, -74.058, { amenity: 'bank' }),
          makePointFeature(4.7, -74.1, { shop: 'supermarket' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.walk.daily).toBe(3)
  })

  it('counts lifestyle amenities from pois', () => {
    const data = {
      ...emptyData,
      pois: {
        type: 'FeatureCollection',
        features: [
          makePointFeature(4.656, -74.056, { amenity: 'restaurant' }),
          makePointFeature(4.656, -74.057, { amenity: 'cafe' }),
          makePointFeature(4.656, -74.058, { leisure: 'park' }),
          makePointFeature(4.7, -74.1, { amenity: 'restaurant' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.walk.lifestyle).toBe(3)
  })

  it('scores primary road connectivity', () => {
    const data = {
      ...emptyData,
      primaryRoads: {
        type: 'FeatureCollection',
        features: [
          makeLineFeature([[-74.06, 4.65], [-74.05, 4.66]], { name: 'Calle 100' }),
          makeLineFeature([[-74.07, 4.65], [-74.06, 4.66]], { name: 'Carrera 15' }),
          makeLineFeature([[-74.08, 4.65], [-74.07, 4.66]], { name: 'Calle 116' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.scores.transport).toBeGreaterThanOrEqual(6)
  })

  it('returns insights array', () => {
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, emptyData)
    expect(result.insights.length).toBeGreaterThan(0)
    expect(result.insights.some(i => i.category === 'Conectividad Vial')).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests and confirm failures**

```bash
npm test -- src/utils/scoring.test.js
```

Expected: tests fail because modular turf imports and category criteria are not yet implemented.

- [ ] **Step 4: Refactor scoring.js**

Modify `widget/src/utils/scoring.js`:

1. Replace `import * as turf from '@turf/turf'` with modular imports:

```js
import { point } from '@turf/helpers'
import distance from '@turf/distance'
import centroid from '@turf/centroid'
import pointToLineDistance from '@turf/point-to-line-distance'
import { lineString } from '@turf/helpers'
```

2. Extract `getPoint` as exported helper:

```js
export const getPoint = (f) => {
  try {
    if (!f.geometry || !f.geometry.coordinates || f.geometry.coordinates.length === 0) return null
    if (f.geometry.type === 'Point') {
      return point(f.geometry.coordinates)
    }
    return centroid(f)
  } catch (e) {
    return null
  }
}
```

3. Keep `calculateScores` signature and return shape, but update category matches:
   - Health: include `hospital`, `clinic`, `doctors`.
   - University: include `university`, `college`.
   - Entertainment: add `casino`, `department_store` to align with debug script.

4. Use `lineString` helper for primary/secondary roads.

- [ ] **Step 5: Run tests and confirm green**

```bash
npm test -- src/utils/scoring.test.js
```

Expected: all tests pass.

- [ ] **Step 6: Run lint and build**

```bash
npm run lint -- --fix
npm run build
```

Expected: lint and build pass.

- [ ] **Step 7: Commit**

```bash
git add widget/src/utils/scoring.js widget/src/utils/scoring.test.js widget/package.json widget/package-lock.json
git commit -m "refactor(scoring): modular turf imports and aligned category criteria"
```

---

## Task 4: Add Widget component tests

**Files:**
- Create: `widget/src/Widget.test.jsx`
- Modify: `widget/src/Widget.jsx` (only if tests require)

- [ ] **Step 1: Write failing tests for Widget**

Create `widget/src/Widget.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Widget from './Widget'

const emptyGeojson = { type: 'FeatureCollection', features: [] }

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    const file = url.split('/').pop()
    const responses = {
      'pois.geojson': emptyGeojson,
      'vias_primarias.geojson': emptyGeojson,
      'vias_secundarias.geojson': emptyGeojson,
      'hosp_esc_entret.geojson': emptyGeojson,
      'transporte_publico.geojson': emptyGeojson,
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(responses[file] || emptyGeojson) })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Widget', () => {
  it('shows loading state initially', () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    expect(screen.getByText(/Cargando datos/i)).toBeInTheDocument()
  })

  it('renders score after data loads', async () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    await waitFor(() => expect(screen.getByText(/Puntaje General/i)).toBeInTheDocument())
  })

  it('switches to drive tab', async () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    await waitFor(() => expect(screen.getByText(/Puntaje General/i)).toBeInTheDocument())
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /En Carro/i }))
    expect(screen.getByText(/Vehicular/i)).toBeInTheDocument()
  })

  it('shows location inputs with accessible labels', async () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    await waitFor(() => expect(screen.getByText(/Puntaje General/i)).toBeInTheDocument())
    expect(screen.getByLabelText(/Latitud/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Longitud/i)).toBeInTheDocument()
  })
})
```

Install user-event if needed:

```bash
npm install -D @testing-library/user-event
```

- [ ] **Step 2: Run tests and confirm failures**

```bash
npm test -- src/Widget.test.jsx
```

Expected: tests fail because labels and accessible names are missing.

- [ ] **Step 3: Update Widget.jsx for accessibility and validation**

Modify `widget/src/Widget.jsx`:

1. Add `<label>` elements for lat/lng inputs with `htmlFor` matching input ids.
2. Add `id="lat-input"` and `id="lng-input"` to inputs.
3. Add validation feedback in `handleUpdateLocation` for invalid coordinates.
4. Add loading indicator when recalculating (e.g., `isRecalculating` state) or disable button during load.
5. Replace `if (!results) return null;` with a friendly message or keep the loading overlay.
6. Guard `calculateScores` with try/catch so errors don't blank the screen.

- [ ] **Step 4: Run tests and confirm green**

```bash
npm test -- src/Widget.test.jsx
```

Expected: all Widget tests pass.

- [ ] **Step 5: Commit**

```bash
git add widget/src/Widget.jsx widget/src/Widget.test.jsx widget/package.json widget/package-lock.json
git commit -m "feat(widget): accessible location inputs, validation, and component tests"
```

---

## Task 5: Fix MapComponent and add POI visualization

**Files:**
- Create: `widget/src/components/MapComponent.test.jsx`
- Modify: `widget/src/components/MapComponent.jsx`
- Modify: `widget/src/Widget.jsx` (pass `data` and `activeTab` to MapComponent)

- [ ] **Step 1: Write failing tests for MapComponent**

Create `widget/src/components/MapComponent.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MapComponent from './MapComponent'

describe('MapComponent', () => {
  it('renders without crashing', () => {
    const { container } = render(<MapComponent lat={4.656} lng={-74.056} />)
    expect(container.querySelector('.leaflet-container')).toBeInTheDocument()
  })

  it('renders POI markers when data is provided', () => {
    const data = {
      pois: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-74.056, 4.656] },
            properties: { amenity: 'restaurant', name: 'Test Cafe' },
          },
        ],
      },
    }
    const { container } = render(<MapComponent lat={4.656} lng={-74.056} data={data} activeTab="walk" />)
    expect(container.querySelector('.leaflet-marker-icon')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests and confirm failures**

```bash
npm test -- src/components/MapComponent.test.jsx
```

Expected: tests fail because `data` prop and POI rendering are not implemented.

- [ ] **Step 3: Update MapComponent.jsx**

Modify `widget/src/components/MapComponent.jsx`:

1. Remove global `L.Marker.prototype.options.icon = DefaultIcon` mutation. Use `icon={DefaultIcon}` prop on Marker.
2. Remove empty `eventHandlers={{ click: () => {} }}` from Circle.
3. Accept `data` and `activeTab` props.
4. Add a `PoiLayer` component that filters POIs within active radius and renders small CircleMarkers or Markers with Popups.
5. Use stable keys for markers.

Example `PoiLayer`:

```jsx
const PoiLayer = ({ data, activeTab, center }) => {
  const radius = activeTab === 'walk' ? 0.5 : 3.0
  if (!data || !data.pois) return null

  const pois = data.pois.features.filter((f) => {
    const p = getPoint(f)
    if (!p) return false
    const d = distance(center, p, { units: 'kilometers' })
    return d <= radius
  })

  return (
    <>
      {pois.map((f, idx) => (
        <Marker
          key={`poi-${idx}-${f.properties.name || ''}`}
          position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
          icon={PoiIcon}
        >
          <Popup>{f.properties.name || f.properties.amenity || 'POI'}</Popup>
        </Marker>
      ))}
    </>
  )
}
```

Import `getPoint` and `distance` from `../utils/scoring` or add minimal local helpers.

- [ ] **Step 4: Update Widget.jsx to pass data to MapComponent**

```jsx
<MapComponent lat={currentLat} lng={currentLng} data={data} activeTab={activeTab} />
```

- [ ] **Step 5: Run tests and confirm green**

```bash
npm test -- src/components/MapComponent.test.jsx
```

Expected: all MapComponent tests pass.

- [ ] **Step 6: Run lint and build**

```bash
npm run lint -- --fix
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add widget/src/components/MapComponent.jsx widget/src/components/MapComponent.test.jsx widget/src/Widget.jsx widget/src/utils/scoring.js
git commit -m "feat(map): remove dead code, avoid global icon mutation, render nearby POIs"
```

---

## Task 6: Clean up data duplication and orphan file

**Files:**
- Delete: `widget/public/data/hospitales_escuelas.geojson`
- Delete: `pois/` directory at project root (canonical data moves to `widget/public/data/`)
- Modify: `widget/package.json` (add build copy script if canonical source stays at root)

**Decision:** Keep canonical GeoJSON files in `widget/public/data/` because the widget fetches from `/data/`. Remove the root `pois/` duplication and the orphan `hospitales_escuelas.geojson`.

- [ ] **Step 1: Verify files are identical**

```bash
diff -q widget/public/data/pois.geojson pois/pois.geojson
diff -q widget/public/data/hosp_esc_entret.geojson pois/hosp_esc_entret.geojson
diff -q widget/public/data/transporte_publico.geojson pois/transporte_publico.geojson
diff -q widget/public/data/vias_primarias.geojson pois/vias_primarias.geojson
diff -q widget/public/data/vias_secundarias.geojson pois/vias_secundarias.geojson
```

Expected: no output (files identical).

- [ ] **Step 2: Remove duplicates and orphan**

```bash
rm -rf pois
rm -f widget/public/data/hospitales_escuelas.geojson
```

- [ ] **Step 3: Run build and tests**

```bash
npm test
npm run build
```

Expected: tests and build pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(data): remove duplicated poi sources and orphan geojson file"
```

---

## Task 7: Fix or replace debug_scoring.js

**Files:**
- Delete: `debug_scoring.js` at project root
- Create: `widget/scripts/debug-scoring.js`

- [ ] **Step 1: Convert debug script into a runnable Node script inside widget/**

Create `widget/scripts/debug-scoring.js`:

```js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculateScores, getPoint } from '../src/utils/scoring.js'
import distance from '@turf/distance'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '../public/data')

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))

const runDebug = () => {
  const data = {
    pois: readJson('pois.geojson'),
    primaryRoads: readJson('vias_primarias.geojson'),
    secondaryRoads: readJson('vias_secundarias.geojson'),
    hospEscEntret: readJson('hosp_esc_entret.geojson'),
    publicTransport: readJson('transporte_publico.geojson'),
  }

  const location = { lat: 4.656, lng: -74.056 }
  const result = calculateScores(location, data)

  console.log('--- SCORING DEBUG ---')
  console.log(JSON.stringify(result.scores, null, 2))
  console.log('\n--- INSIGHTS ---')
  result.insights.forEach(i => console.log(`[${i.type}] ${i.category}: ${i.text}`))
}

runDebug()
```

- [ ] **Step 2: Add debug script to package.json**

```json
"debug:scoring": "node scripts/debug-scoring.js"
```

- [ ] **Step 3: Delete old debug_scoring.js**

```bash
rm debug_scoring.js
```

- [ ] **Step 4: Run debug script**

```bash
npm run debug:scoring
```

Expected: prints scores and insights for the test location.

- [ ] **Step 5: Commit**

```bash
git add widget/scripts/debug-scoring.js widget/package.json debug_scoring.js
git commit -m "chore(debug): replace broken root debug script with runnable widget script"
```

---

## Task 8: Documentation and project metadata

**Files:**
- Create: `README.md`
- Create: `AGENTS.md`
- Modify: `widget/package.json` (optional version bump to `0.1.0`)

- [ ] **Step 1: Create README.md**

`README.md`:

```markdown
# Widget Inmobiliario

Widget de evaluación inmobiliaria para Bogotá. Calcula puntajes de caminata, accesibilidad vehicular y conectividad vial a partir de datos GeoJSON.

## Stack

- React 18 + Vite 5
- Leaflet + React-Leaflet
- @turf/* (geoprocesamiento modular)
- Vitest + React Testing Library

## Scripts

```bash
cd widget
npm install
npm run dev       # servidor de desarrollo
npm run build     # build de producción
npm test          # ejecutar tests
npm run lint      # linting
npm run debug:scoring  # debug del motor de scoring
```

## Datos

Los archivos GeoJSON se sirven desde `widget/public/data/`:

- `pois.geojson` — comercios, servicios y amenities
- `hosp_esc_entret.geojson` — hospitales, colegios, universidades, entretenimiento
- `transporte_publico.geojson` — paradas SITP
- `vias_primarias.geojson` — vías arteriales
- `vias_secundarias.geojson` — calles secundarias

## Tests

```bash
cd widget
npm test
```
```

- [ ] **Step 2: Create AGENTS.md**

`AGENTS.md`:

```markdown
# Agent Instructions

## Project Layout

- `widget/` — React application.
- `widget/src/utils/scoring.js` — pure scoring engine. Must remain testable without browser APIs.
- `widget/public/data/` — GeoJSON assets served at runtime.
- `widget/scripts/` — Node utilities (e.g., debug-scoring.js).
- Tests live next to source files: `*.test.js` / `*.test.jsx`.

## Coding Conventions

- Use functional React components and hooks.
- Keep scoring helpers pure and exported for tests.
- Import `@turf/*` modules individually; do not import the full `@turf/turf` bundle.
- Run `npm run lint`, `npm test`, and `npm run build` before considering work complete.
- Use Conventional Commits.
```

- [ ] **Step 3: Bump version to 0.1.0**

Update `widget/package.json`:

```json
"version": "0.1.0"
```

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md widget/package.json
git commit -m "docs: add README, AGENTS.md and bump version to 0.1.0"
```

---

## Task 9: Final verification and review

- [ ] **Step 1: Run full verification**

```bash
cd widget
npm run lint
npm test
npm run build
npm run debug:scoring
```

Expected:
- Lint: 0 errors, 0 warnings
- Tests: all pass
- Build: success
- Debug script: prints scores

- [ ] **Step 2: Review git log**

```bash
git log --oneline -10
```

Expected: clean conventional commits on branch `fix/widget-cleanup-and-tests`.

- [ ] **Step 3: Use finishing-a-development-branch skill**

Present merge/PR options to the user after all checks pass.

---

## Spec Coverage Checklist

| Requirement | Task |
|-------------|------|
| ESLint configured | Task 1 |
| Tests runnable | Task 2 |
| Scoring tested | Task 3 |
| Category criteria aligned with debug findings | Task 3 |
| Widget inputs accessible and validated | Task 4 |
| Widget component tests | Task 4 |
| MapComponent dead code removed | Task 5 |
| POIs visible on map | Task 5 |
| Data duplication removed | Task 6 |
| Orphan `hospitales_escuelas.geojson` removed | Task 6 |
| `debug_scoring.js` fixed | Task 7 |
| README and AGENTS.md | Task 8 |
| Full verification | Task 9 |
