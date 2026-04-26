# 🏠 Datos REALES Disponibles - Opciones

## ⚠️ Situación Actual

**No existen datasets abiertos gratuitos** de precios de venta de inmuebles en Bogotá con:
- Precios reales de transacciones
- Ubicaciones exactas
- Características detalladas

Las inmobiliarias (Metrocuadrado, OLX, MercadoLibre) protegen estos datos.

---

## ✅ Opción 1: Datos Airbnb Buenos Aires (REALES)

**Fuente:** Inside Airbnb (Creative Commons)
**URL:** https://insideairbnb.com/buenos-aires/

### 📊 Contenido (Datos Reales)
- **35,347 propiedades**
- **Precios reales** de renta diaria (ARS)
- **Ubicaciones exactas** (lat/lng)
- **Barrios reales** (Palermo, Recoleta, Belgrano, etc.)
- **Características:** habitaciones, tipo de propiedad, etc.

### 💰 Ejemplo de Precios
```
Palermo: $40,000 - $100,000 ARS/noche
Recoleta: $50,000 - $120,000 ARS/noche
San Telmo: $30,000 - $70,000 ARS/noche
```

### 📁 Archivo
`/tmp/buenos_aires_real.csv` (5.4 MB)

---

## 🔧 Opción 2: Scraping Legal

### Fuentes Accesibles (con trabajo)

**1. OLX Colombia**
- URL: https://www.olx.com.co/inmuebles/venta/
- Requiere: Playwright/Selenium
- Riesgo: Bloqueo por protección anti-bot

**2. MercadoLibre API**
- URL: https://developers.mercadolibre.com.co/
- Requiere: Registro y API key
- Límite: 1000 requests/día gratis

**3. Datos.gov.co (Gobierno)**
- URL: https://www.datos.gov.co/
- Disponible: Avalúos catastrales (precios de referencia, no de mercado)
- Limitación: No incluye precios de venta reales

---

## 💡 Recomendación

Para tu modelo ML, tienes estas opciones REALES:

### Opción A: Usar Buenos Aires (Inmediato)
- 35k+ datos reales
- Mismo idioma, cultura similar
- Mercado inmobiliario comparable
- Puedes ajustar precios por factor de conversión

### Opción B: MercadoLibre API (1-2 días)
1. Registrar app en developers.mercadolibre.com.co
2. Obtener API key
3. Extraer datos de Bogotá (límite 1000/día)
4. Acumular durante varios días

### Opción C: Comprar Dataset (Inmediato)
- Kaggle: ~$50-200 USD
- Data providers locales: ~$100-500 USD

---

## 📁 Archivo Buenos Aires Disponible

```
/tmp/buenos_aires_real.csv
- 35,347 propiedades reales
- 5.4 MB
- Actualizado: Enero 2025
```

**Columnas:**
- id, name, host_id, host_name
- neighbourhood (barrio real)
- latitude, longitude
- room_type (Entire home/apt, Private room)
- price (precio real en ARS/noche)
- minimum_nights, number_of_reviews

---

## ❓ Decisión

¿Cuál opción prefieres?

1. **Usar Buenos Aires** (datos reales, inmediato)
2. **Implementar MercadoLibre API** (datos Bogotá, 2-3 días)
3. **Buscar datasets de pago** (datos Bogotá, inmediato con costo)
