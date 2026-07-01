# Widget Inmobiliario

Widget de evaluación inmobiliaria para Bogotá. Calcula puntajes de caminata, accesibilidad vehicular y conectividad vial a partir de datos GeoJSON de OpenStreetMap.

## Stack

- React 18 + Vite 5
- Leaflet + React-Leaflet
- `@turf/*` (geoprocesamiento modular)
- Vitest + React Testing Library
- ESLint 9 (flat config)

## Estructura del proyecto

```
widget/
├── src/
│   ├── App.jsx                  # demo con coordenadas de prueba
│   ├── Widget.jsx               # componente principal
│   ├── components/
│   │   └── MapComponent.jsx     # mapa con radios y POIs
│   ├── utils/
│   │   ├── scoring.js           # motor de puntuación
│   │   └── scoring.test.js      # tests del motor
│   ├── Widget.test.jsx          # tests del componente
│   └── test/setup.js            # setup de Testing Library
├── public/data/                 # archivos GeoJSON servidos en runtime
└── scripts/debug-scoring.js     # utilidad para depurar scoring
```

## Scripts

```bash
cd widget
npm install
npm run dev              # servidor de desarrollo
npm run build            # build de producción
npm test                 # ejecutar tests
npm run test:watch       # ejecutar tests en modo watch
npm run lint             # linting
npm run debug:scoring    # debug del motor de scoring
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

El proyecto usa Vitest con jsdom. Los tests están junto al código fuente (`*.test.js` / `*.test.jsx`).

## Puntuación

El widget calcula tres scores:

- **Peatonal (500 m)**: transporte público, educación, abastecimiento, estilo de vida.
- **Vehicular (3 km)**: salud, universidades, entretenimiento.
- **Conectividad vial**: vías arteriales en 1.5 km y densidad de vías secundarias en 1 km.
