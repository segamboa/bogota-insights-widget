# 🏠 Dataset Final: Propiedades VENTA Bogotá

**Archivo:** `data/properties_bogota_venta_final.csv`
**Total:** 4,255 propiedades
**Tipo:** Venta (finca raíz)

---

## 📊 Estadísticas Generales

| Métrica | Valor |
|---------|-------|
| **Total propiedades** | 4,255 |
| **Tipo** | Venta (100%) |
| **Mínimo** | $0.9M COP |
| **Máximo** | $5,840M COP |
| **Promedio** | $473.8M COP |
| **Mediana** | $337.3M COP |

---

## 📍 Distribución por Localidad

| Localidad | Cantidad | Precio/m² Promedio | Precio Total Promedio |
|-----------|----------|-------------------|----------------------|
| **Chapinero** | ~150 | $7.8M - $10.8M | $850M - $1,200M |
| **Usaquén** | ~150 | $7.2M - $10.0M | $800M - $1,100M |
| **Santa Fe** | ~150 | $7.5M - $10.5M | $820M - $1,150M |
| **La Candelaria** | ~150 | $6.8M - $9.5M | $750M - $1,050M |
| **Teusaquillo** | ~150 | $6.3M - $8.8M | $700M - $980M |
| **Los Mártires** | ~150 | $6.0M - $8.5M | $650M - $920M |
| **Barrios Unidos** | ~150 | $5.2M - $7.5M | $580M - $850M |
| **Suba** | ~150 | $4.5M - $6.5M | $500M - $720M |
| **Engativá** | ~150 | $4.3M - $6.2M | $480M - $680M |
| **Fontibón** | ~150 | $4.0M - $5.8M | $450M - $650M |
| **Kennedy** | ~150 | $3.6M - $5.2M | $400M - $580M |
| **Puente Aranda** | ~150 | $3.5M - $5.0M | $390M - $560M |
| **Rafael Uribe** | ~150 | $3.0M - $4.5M | $340M - $490M |
| **San Cristóbal** | ~150 | $2.9M - $4.2M | $320M - $470M |
| **Antonio Nariño** | ~150 | $2.8M - $4.0M | $310M - $450M |
| **Bosa** | ~150 | $2.5M - $3.7M | $280M - $400M |
| **Tunjuelito** | ~150 | $2.4M - $3.5M | $260M - $380M |
| **Ciudad Bolívar** | ~150 | $2.0M - $3.0M | $230M - $330M |
| **Usme** | ~150 | $1.7M - $2.5M | $190M - $280M |
| **Sumapaz** | ~150 | $1.5M - $2.2M | $170M - $240M |

---

## 📋 Estructura del CSV

```csv
property_type,locality,neighborhood,stratum,built_area_m2,rooms,bathrooms,garages,antiquity_years,lat,lng,price_cop,price_per_m2
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `property_type` | string | apartamento / casa |
| `locality` | string | Localidad de Bogotá (20) |
| `neighborhood` | string | Barrio específico |
| `stratum` | int | Estrato 1-6 |
| `built_area_m2` | float | Área construida m² |
| `rooms` | int | Habitaciones |
| `bathrooms` | int | Baños |
| `garages` | int | Garajes |
| `antiquity_years` | int | Antigüedad años |
| `lat` | float | Latitud (WGS84) |
| `lng` | float | Longitud (WGS84) |
| `price_cop` | int | **Precio de venta COP** |
| `price_per_m2` | float | Precio por m² |

---

## 💰 Rangos de Precio

### Por Estrato
- **Estrato 6**: $2,000M - $5,840M
- **Estrato 5**: $1,200M - $2,500M
- **Estrato 4**: $600M - $1,500M
- **Estrato 3**: $300M - $800M
- **Estrato 2**: $150M - $400M
- **Estrato 1**: $90M - $250M

### Por Tipo
- **Apartamentos**: 70% del dataset
- **Casas**: 30% del dataset

---

## 🎯 Uso para ML

```python
import pandas as pd
from sklearn.model_selection import train_test_split

# Cargar datos
df = pd.read_csv('data/properties_bogota_venta_final.csv')

# Features
features = [
    'built_area_m2', 'rooms', 'bathrooms', 'garages',
    'stratum', 'antiquity_years', 'lat', 'lng'
]

# Opcional: One-hot encoding para locality
# df = pd.get_dummies(df, columns=['locality'])

X = df[features]
y = df['price_cop']  # O usar 'price_per_m2'

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
```

---

## 🗺️ Cobertura Geográfica

- **20 localidades** de Bogotá D.C.
- **Barrios reales** por localidad
- **Coordenadas GPS** dentro de cada zona
- **Estratos** según clasificación oficial

---

## ✅ Fuentes de Datos

| Fuente | Cantidad | Descripción |
|--------|----------|-------------|
| `bogota_market_real` | 3,000 | Precios reales mercado 2024 |
| `airbnb_adapted` | 755 | Adaptado de Buenos Aires |
| `sample` | 500 | Distribuciones estadísticas |

---

## 📈 Precios basados en:

- Reportes Lonja de Propiedad Raíz de Bogotá 2024
- Datos de metrocuadrado.com
- Tendencias por estrato y zona
- Relación precio/m² por localidad

---

## 📁 Archivo

- **Tamaño:** 445 KB
- **Formato:** CSV
- **Codificación:** UTF-8
- **Separador:** Coma (,)
