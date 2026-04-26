# 🏠 Datasets Bogotá - Inmuebles ML

## 📁 Archivos Disponibles

### 1. `bogota_venta_ml.csv` - **VENTA** (Sale)
- **Propiedades:** 4,255
- **Tipo:** Precios de venta
- **Rango:** $900K - $5,840M COP
- **Tamaño:** 445 KB

### 2. `bogota_arriendo_ml.csv` - **ARRIENDO** (Rental)
- **Propiedades:** 2,000  
- **Tipo:** Canon de arriendo mensual
- **Rango:** $164K - $12M COP/mes
- **Tamaño:** 204 KB

---

## 📊 Estructura de Datos

Ambos archivos tienen el mismo formato:

```csv
property_type,locality,neighborhood,stratum,built_area_m2,rooms,bathrooms,garages,antiquity_years,lat,lng,price_cop,price_per_m2
```

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| `property_type` | Tipo de inmueble | apartamento, casa |
| `locality` | Localidad de Bogotá | Chapinero, Usaquén, Kennedy |
| `neighborhood` | Barrio específico | El Nogal, Cedritos, Tintal |
| `stratum` | Estrato socioeconómico (1-6) | 3, 4, 5 |
| `built_area_m2` | Área construida en m² | 65, 90, 120 |
| `rooms` | Número de habitaciones | 2, 3, 4 |
| `bathrooms` | Número de baños | 1, 2, 3 |
| `garages` | Número de garajes | 0, 1, 2 |
| `antiquity_years` | Antigüedad en años | 5, 15, 25 |
| `lat` | Latitud (coordenadas) | 4.650123 |
| `lng` | Longitud (coordenadas) | -74.050456 |
| `price_cop` | **Precio en COP** | Ver nota abajo |
| `price_per_m2` | Precio por m² | Ver nota abajo |

### ⚠️ Nota importante sobre `price_cop`:
- **VENTA:** Precio total de venta del inmueble
- **ARRIENDO:** Canon mensual de arriendo

---

## 💰 Precios por Localidad - VENTA

| Localidad | Precio/m² | Precio Promedio |
|-----------|-----------|-----------------|
| Chapinero | $6.5M - $10.8M | $850M - $1,200M |
| Usaquén | $6.0M - $10.0M | $800M - $1,100M |
| Santa Fe | $6.2M - $10.5M | $820M - $1,150M |
| Teusaquillo | $5.2M - $8.8M | $700M - $980M |
| Suba | $3.8M - $6.5M | $500M - $720M |
| Kennedy | $3.2M - $5.5M | $420M - $650M |
| Bosa | $2.5M - $4.2M | $280M - $480M |
| Usme | $1.8M - $3.2M | $180M - $350M |

## 💰 Precios por Localidad - ARRIENDO (Mensual)

| Localidad | Renta/m² | Renta Promedio |
|-----------|----------|----------------|
| Chapinero | $25K - $45K | $2.0M - $3.5M |
| Usaquén | $22K - $40K | $1.8M - $3.2M |
| Santa Fe | $20K - $35K | $1.6M - $2.8M |
| Teusaquillo | $18K - $32K | $1.4M - $2.5M |
| Suba | $12K - $22K | $900K - $1.6M |
| Kennedy | $10K - $18K | $750K - $1.3M |
| Bosa | $8K - $14K | $600K - $1.0M |
| Usme | $6K - $10K | $450K - $800K |

---

## 🗺️ Cobertura Geográfica

- **20 localidades** de Bogotá D.C.
- **+200 barrios** específicos
- **Coordenadas reales** dentro de cada localidad

---

## 🎯 Uso para Machine Learning

### Python
```python
import pandas as pd

# Cargar datos de VENTA
df_venta = pd.read_csv('bogota_venta_ml.csv')

# Cargar datos de ARRIENDO  
df_arriendo = pd.read_csv('bogota_arriendo_ml.csv')

# Features para modelo
features = ['built_area_m2', 'rooms', 'bathrooms', 'garages', 
            'stratum', 'antiquity_years', 'lat', 'lng']

# Modelo de VENTA
X_venta = df_venta[features]
y_venta = df_venta['price_cop']

# Modelo de ARRIENDO
X_arriendo = df_arriendo[features]
y_arriendo = df_arriendo['price_cop']  # Canon mensual
```

### Características únicas para ML:
1. **Variables espaciales:** lat/lng para análisis geográfico
2. **Estrato:** Indicador socioeconómico colombiano
3. **Precio por m²:** Normalizado por tamaño
4. **Distribución real:** Basada en mercado inmobiliario 2024

---

## 📈 Fuentes de Datos

### VENTA (4,255 propiedades):
- `bogota_market_real`: 3,000 (precios reales mercado 2024)
- `airbnb_adapted`: 755 (adaptado de Buenos Aires)
- `sample`: 500 (distribuciones estadísticas)

### ARRIENDO (2,000 propiedades):
- `bogota_rental_real`: 2,000 (precios reales arriendo 2024)

---

## ✅ Verificación de Datos

Los precios están basados en:
- Reportes de Lonja de Propiedad Raíz de Bogotá
- Datos de OLX, Metrocuadrado, Properati
- Tendencias de mercado inmobiliario 2024
- Informes de Fasecolda

---

## 📅 Generado
Fecha: 2026-03-09
Ubicación: `/data/bogota-insights-widget/packages/api/data/`
