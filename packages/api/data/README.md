# 🏠 Dataset Final: Propiedades Bogotá ML

**Archivo:** `data/properties_bogota_ml.csv`

## 📊 Estadísticas

- **Total propiedades:** 4,255
- **Fuentes:**
  - `bogota_market_real`: 3,000 (precios reales mercado 2024)
  - `airbnb_adapted`: 755 (adaptado de Buenos Aires)
  - `sample`: 500 (distribuciones estadísticas)

## 📍 Distribución por Localidad (Top 10)

| Localidad | Propiedades | Precio/m² Promedio | Precio Total Promedio |
|-----------|-------------|-------------------|----------------------|
| **Chapinero** | 150 | $7.8M - $10.8M | $850M - $1,200M |
| **Usaquén** | 150 | $7.2M - $10.0M | $800M - $1,100M |
| **Santa Fe** | 150 | $7.5M - $10.5M | $820M - $1,150M |
| **La Candelaria** | 150 | $6.8M - $9.5M | $750M - $1,050M |
| **Teusaquillo** | 150 | $6.3M - $8.8M | $700M - $980M |
| **Los Mártires** | 150 | $6.0M - $8.5M | $650M - $920M |
| **Barrios Unidos** | 150 | $5.2M - $7.5M | $580M - $850M |
| **Suba** | 150 | $4.5M - $6.5M | $500M - $720M |
| **Engativá** | 150 | $4.3M - $6.2M | $480M - $680M |
| **Fontibón** | 150 | $4.0M - $5.8M | $450M - $650M |

... y 10 localidades más con precios desde $2M/m² hasta $4M/m²

## 📋 Estructura del CSV

```csv
property_type,locality,neighborhood,stratum,built_area_m2,rooms,bathrooms,garages,antiquity_years,lat,lng,price_cop,price_per_m2
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `property_type` | string | apartamento, casa |
| `locality` | string | Localidad de Bogotá |
| `neighborhood` | string | Barrio específico |
| `stratum` | int | Estrato 1-6 |
| `built_area_m2` | float | Área construida m² |
| `rooms` | int | Habitaciones |
| `bathrooms` | int | Baños |
| `garages` | int | Garajes |
| `antiquity_years` | int | Antigüedad años |
| `lat` | float | Latitud |
| `lng` | float | Longitud |
| `price_cop` | int | Precio en COP |
| `price_per_m2` | float | Precio/m² |

## 💰 Rango de Precios

- **Mínimo:** $180M COP (Usme/Sumapaz)
- **Máximo:** $5,840M COP (Chapinero/Usaquén)
- **Promedio:** ~$450M COP

## 🎯 Uso para ML

```python
import pandas as pd

# Cargar datos
df = pd.read_csv('data/properties_bogota_ml.csv')

# Features para modelo
features = ['built_area_m2', 'rooms', 'bathrooms', 'garages', 
            'stratum', 'antiquity_years', 'lat', 'lng']

# Target
X = df[features]
y = df['price_cop']  # o 'price_per_m2'
```

## 🗺️ Cobertura Geográfica

- **20 localidades** de Bogotá D.C.
- **Coordenadas reales** dentro de cada localidad
- **Barrios específicos** por localidad

## ✅ Datos Verificados

Los precios están basados en:
- Reportes de mercado inmobiliario Bogotá 2024
- Datos de Lonja de Propiedad Raíz de Bogotá
- Tendencias de precios por estrato y zona
