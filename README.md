# Bogotá Insights Widget - Demo

Widget de insights de barrios para Bogotá. Funciona completamente en el cliente sin necesidad de backend.

## 🚀 Demo en Vivo

**URL:** [https://bogota-insights-demo.vercel.app](https://bogota-insights-demo.vercel.app) *(una vez deployado)*

## 📦 Estructura

- `index.html` - Frontend con widget interactivo
- `bogota-pois.geojson` - 27,923 puntos de interés de Bogotá (5.6MB)

## 🎯 Características

- ✅ **Sin backend** - Todo el procesamiento en el navegador
- ✅ **27,923 POIs** reales de Bogotá
- ✅ **Cálculo instantáneo** de scores para cualquier ubicación
- ✅ **6 perfiles de zona** (Urbano, Familiar, Tranquilo, etc.)
- ✅ **Enfoque positivo** - Ninguna zona es "mala"

## 🏗️ Deploy

### Opción 1: Vercel (Recomendada)

1. Instalar Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
cd bogota-insights-widget
vercel --prod
```

### Opción 2: Netlify

Arrastrar carpeta a [netlify.com/drop](https://netlify.com/drop)

### Opción 3: GitHub Pages

1. Crear repo en GitHub
2. Subir archivos
3. Activar GitHub Pages en settings

## 📊 Fuentes de Datos

Los 27,923 POIs incluyen:
- **IDECA** - Datos oficiales de Bogotá (educación, salud)
- **OpenStreetMap** - Comercios, restaurantes, parques
- **TransMilenio** - Estaciones y paradas de transporte

## 🔧 Tecnologías

- HTML5 + CSS3 + Vanilla JavaScript
- Haversine formula para cálculo de distancias
- GeoJSON para datos geoespaciales

## 📍 Uso

1. Ingresar coordenadas (lat, lng) o dirección
2. Hacer clic en "Analizar"
3. Ver el widget con:
   - Score general (0-100)
   - Perfil de la zona (Urbano/Familiar/etc.)
   - Fortalezas específicas
   - POIs más cercanos

## 📝 Ejemplos de Ubicaciones

| Zona | Latitud | Longitud |
|------|---------|----------|
| Chapinero | 4.65 | -74.05 |
| Lagos de Córdoba | 4.706116 | -74.068203 |
| Zona T | 4.67 | -74.05 |
| Centro | 4.60 | -74.08 |

## ⚠️ Limitaciones

- El archivo GeoJSON es de 5.6MB (descarga inicial)
- Cálculo en cliente puede ser lento en dispositivos móviles antiguos
- No incluye geocodificación de direcciones (solo coordenadas)

## 🔗 Links

- Repositorio: https://github.com/segamboa/bogota-insights-widget
- API completa: *(documentación del backend)*

---

*Demo creada con datos reales de Bogotá - 2026*
