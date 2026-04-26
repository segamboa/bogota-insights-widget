# 🏠 Property Scraping - Bogotá Insights

Sistema de scraping de inmuebles en Bogotá para el modelo de predicción de precios.

## ✅ Estado Actual

### Datos Disponibles

**Datos de muestra generados:** 500 propiedades con distribuciones realistas del mercado de Bogotá.

```bash
# Ver dataset
ls -la data/properties_ml_*.csv
```

**Distribución por localidad:**
- Chapinero: $7.5M/m² (estrato 4-6)
- Usaquén: $6.5M/m² (estrato 4-6)
- Santa Fe: $6.8M/m² (estrato 3-5)
- Teusaquillo: $5.8M/m² (estrato 3-5)
- Kennedy: $3.5M/m² (estrato 1-4)
- Bosa: $2.8M/m² (estrato 1-3)
- Usme: $2.0M/m² (estrato 1-2)
- (20 localidades totales)

## 🚀 Uso Rápido

### Generar más datos de muestra

```bash
cd packages/api

# Generar 1000 propiedades
pnpm ingest:properties:sample 1000

# O con npx
npx tsx src/services/scrapers/sample-generator.ts 1000
```

### Exportar para ML

```bash
# CSV (recomendado)
pnpm export:ml

# JSON
npx tsx src/services/export-ml.ts --json
```

### Ver estadísticas

```bash
# Stats por fuente
npx tsx -e "
const { getPropertyCountsBySource, getPriceStats } = require('./src/db/property-queries.js');
const { pool } = require('./src/db/connection.js');

async function main() {
  console.log('By source:', await getPropertyCountsBySource());
  console.log('Price stats:', await getPriceStats());
  await pool.end();
}
main();
"
```

## 📊 Estructura del Dataset

```csv
property_type,locality,neighborhood,stratum,built_area_m2,rooms,bathrooms,garages,antiquity_years,lat,lng,price_cop,price_per_m2
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `property_type` | string | apartamento, casa |
| `locality` | string | Localidad de Bogotá |
| `neighborhood` | string | Barrio |
| `stratum` | int | 1-6 |
| `built_area_m2` | float | Metros construidos |
| `rooms` | int | Habitaciones |
| `bathrooms` | int | Baños |
| `garages` | int | Garajes |
| `antiquity_years` | int | Años de antigüedad |
| `lat` / `lng` | float | Coordenadas GPS |
| `price_cop` | int | Precio en pesos |
| `price_per_m2` | float | Precio por m² |

## 🔄 Scrapers Implementados

### 1. Datos de Muestra ✅
**Archivo:** `src/services/scrapers/sample-generator.ts`

Genera propiedades sintéticas con distribuciones realistas basadas en:
- Precios reales por localidad (2024)
- Distribución de estratos por zona
- Correlación área-habitaciones
- Factor antigüedad

### 2. Metrocuadrado API ⚠️
**Archivo:** `src/services/scrapers/metrocuadrado.ts`

Requiere autenticación. Endpoints descubiertos:
- `https://www.metrocuadrado.com/rest-search/search`
- Requiere API key o cookies válidas

### 3. Metrocuadrado HTML ⚠️
**Archivo:** `src/services/scrapers/metrocuadrado-html.ts`

Requiere renderizado JavaScript. Alternativas:
- Playwright/Puppeteer (por implementar)
- Selenium (por implementar)

### 4. Properati 🔄
**Archivo:** `src/services/scrapers/properati.ts`

En desarrollo. Estructura HTML más simple.

## 📈 Modelo ML - Ideas

### Features

**Numéricas:**
- `built_area_m2`: Área construida
- `rooms`, `bathrooms`, `garages`: Características
- `stratum`: Estrato socioeconómico
- `antiquity_years`: Antigüedad
- `lat`, `lng`: Coordenadas (para features espaciales)

**Categóricas:**
- `property_type`: apartamento vs casa
- `locality`: One-hot encoding de 20 localidades
- `neighborhood`: Agrupar por precio promedio

**Features derivadas:**
- Distancia al centro financiero
- Densidad de POIs cercanos (integrar con datos existentes)
- Precio promedio del barrio
- Precio promedio de la localidad

### Target
- `price_cop`: Precio absoluto
- `price_per_m2`: Precio por metro (más estable)

### Modelos a probar
1. **Random Forest**: Baseline, interpretable
2. **XGBoost**: Generalmente mejor performance
3. **Neural Network**: Si tenemos >10k datos
4. **Geospatial model**: Incorporar lat/lng directamente

## 🛠️ Arquitectura

```
packages/api/
├── migrations/013_create_properties_table.sql
├── src/
│   ├── db/
│   │   ├── types.ts              # Tipos TypeScript
│   │   ├── property-queries.ts   # CRUD + queries ML
│   │   └── connection.ts         # Pool PostgreSQL
│   └── services/
│       ├── scrapers/
│       │   ├── sample-generator.ts      # ✅ Listo
│       │   ├── metrocuadrado.ts         # ⚠️ Necesita auth
│       │   ├── metrocuadrado-html.ts    # ⚠️ Necesita browser
│       │   └── properati.ts             # 🔄 En desarrollo
│       ├── export-ml.ts          # Export CSV/JSON
│       └── property-ingest-runner.ts
└── data/properties_ml_*.csv      # Dataset generado
```

## 📋 Próximos Pasos

### Corto plazo
- [ ] Probar Properati scraper
- [ ] Investigar API de MercadoLibre
- [ ] Implementar Playwright para Metrocuadrado
- [ ] Agregar más barrios específicos

### Mediano plazo
- [ ] Integrar con POIs existentes (features de ubicación)
- [ ] Feature engineering avanzado
- [ ] Training pipeline ML
- [ ] API endpoint para predicciones

### Largo plazo
- [ ] Scraping continuo (cron job)
- [ ] Deduplicación avanzada
- [ ] Detección de outliers/fraude
- [ ] Actualización de precios en tiempo real

## 💡 Troubleshooting

### "relation 'properties' does not exist"
```bash
# Correr migraciones
npx tsx src/db/migrate.ts
```

### Metrocuadrado 401/403
Requiere autenticación o navegador real. Opciones:
1. Usar datos de muestra por ahora
2. Implementar Playwright (más lento pero funciona)
3. Contactar a Metrocuadrado para API oficial

### CSV no se genera
```bash
# Crear directorio
mkdir -p data
```

## 📚 Recursos

- [Properati API Docs](https://www.properati.com.co)
- [Metrocuadrado Developers](https://www.metrocuadrado.com)
- [Inside Airbnb](http://insideairbnb.com) - Datos de renta
- [IDECA Datos Abiertos](https://datosabiertos.bogota.gov.co) - Valor catastral
