import type { CategoryType } from '@bogota-insights/shared';

type Lang = 'es' | 'en';

const translations: Record<Lang, Record<string, string>> = {
  es: {
    'header.bogota': 'Bogota',
    'header.localidad': 'Localidad',
    'header.estrato': 'Estrato',
    'score.low': 'Bajo',
    'score.moderate': 'Moderado',
    'score.good': 'Bueno',
    'score.excellent': 'Excelente',
    'score.overall': 'Puntuación general',
    'score.limited': 'Datos limitados',
    'score.noData': '--',
    'percentile.label': 'Percentil',
    'percentile.top': 'Top',
    'median.city': 'Mediana ciudad',
    'median.local': 'Mediana local',
    'trend.up': '↑ Mejorando',
    'trend.down': '↓ Declinando',
    'trend.stable': '→ Estable',
    'investment.title': 'Potencial de inversión',
    'investment.signal.strong_buy': 'Compra fuerte',
    'investment.signal.buy': 'Compra',
    'investment.signal.hold': 'Mantener',
    'investment.signal.watch': 'Observar',
    'category.transport': 'Transporte',
    'category.commerce': 'Comercio',
    'category.education': 'Educacion',
    'category.health': 'Salud',
    'category.recreation': 'Recreacion',
    'category.nearby': 'cercanos',
    'category.closest': 'Mas cercano',
    'category.noData': 'No se encontraron datos dentro de',
    'category.noDataShort': 'Sin datos cercanos',
    'category.tryExpand': 'Intente aumentar el radio de busqueda.',
    'radius.label': 'Radio',
    'footer.sources': 'Fuentes',
    'footer.radius': 'Radio',
    'loading.text': 'Cargando informacion del barrio...',
    'error.network': 'No se pudo cargar la informacion. Verifique su conexion e intente de nuevo.',
    'error.outside': 'Las coordenadas proporcionadas estan fuera del area metropolitana de Bogota.',
    'error.rateLimit': 'Demasiadas solicitudes. Por favor espere un momento.',
    'error.retry': 'Reintentar',
    'estrato.tooltip': 'El estrato socioeconomico (1-6) clasifica la zona segun sus caracteristicas urbanas e infraestructura. Se usa para tarifas de servicios publicos. No mide ingresos individuales.',
    'help.title': 'Acerca de los datos',
    'source.ideca': 'Registros oficiales de IDECA',
    'source.osm': 'Datos comunitarios de OpenStreetMap',
    'source.transmilenio': 'Autoridad de transito',
  },
  en: {
    'header.bogota': 'Bogota',
    'header.localidad': 'Localidad',
    'header.estrato': 'Estrato',
    'score.low': 'Low',
    'score.moderate': 'Moderate',
    'score.good': 'Good',
    'score.excellent': 'Excellent',
    'score.overall': 'Overall score',
    'score.limited': 'Limited data',
    'score.noData': '--',
    'percentile.label': 'Percentile',
    'percentile.top': 'Top',
    'median.city': 'City median',
    'median.local': 'Local median',
    'trend.up': '↑ Improving',
    'trend.down': '↓ Declining',
    'trend.stable': '→ Stable',
    'investment.title': 'Investment potential',
    'investment.signal.strong_buy': 'Strong buy',
    'investment.signal.buy': 'Buy',
    'investment.signal.hold': 'Hold',
    'investment.signal.watch': 'Watch',
    'category.transport': 'Transport',
    'category.commerce': 'Commerce',
    'category.education': 'Education',
    'category.health': 'Health',
    'category.recreation': 'Recreation',
    'category.nearby': 'nearby',
    'category.closest': 'Closest',
    'category.noData': 'No data found within',
    'category.noDataShort': 'No nearby data',
    'category.tryExpand': 'Try increasing the search radius.',
    'radius.label': 'Radius',
    'footer.sources': 'Sources',
    'footer.radius': 'Radius',
    'loading.text': 'Loading neighborhood information...',
    'error.network': 'Unable to load insights. Check your connection and try again.',
    'error.outside': 'The provided coordinates are outside the Bogota metropolitan area.',
    'error.rateLimit': 'Too many requests. Please wait a moment.',
    'error.retry': 'Retry',
    'estrato.tooltip': 'The socioeconomic stratum (1-6) classifies the area by its urban characteristics and infrastructure. It is used for public utility rates. It does not measure individual income.',
    'help.title': 'About the data',
    'source.ideca': 'IDECA official records',
    'source.osm': 'OpenStreetMap community data',
    'source.transmilenio': 'Transit authority',
  },
};

export function t(key: string, lang: Lang = 'es'): string {
  return translations[lang]?.[key] ?? translations.es[key] ?? key;
}

export function getCategoryLabel(category: CategoryType, lang: Lang = 'es'): string {
  return t(`category.${category}`, lang);
}

export function getScoreLabel(score: number, lang: Lang = 'es'): string {
  if (score < 40) return t('score.low', lang);
  if (score < 60) return t('score.moderate', lang);
  if (score < 80) return t('score.good', lang);
  return t('score.excellent', lang);
}

const subcategoryTranslations: Record<string, string> = {
  // Transport
  bus_station: 'Estación de bus',
  bus_stop: 'Parada de bus',
  parada_sitp: 'Parada SITP',
  bicycle_rental: 'Cicloruta',
  // Commerce
  restaurante: 'Restaurante',
  cafe: 'Café',
  bank: 'Banco',
  banco: 'Banco',
  supermarket: 'Supermercado',
  supermercado: 'Supermercado',
  tienda: 'Tienda',
  centro_comercial: 'Centro comercial',
  mall: 'Centro comercial',
  commerce: 'Comercio',
  // Education
  school: 'Colegio',
  colegio: 'Colegio',
  university: 'Universidad',
  universidad: 'Universidad',
  kindergarten: 'Jardín infantil',
  jardin: 'Jardín infantil',
  library: 'Biblioteca',
  // Health
  hospital: 'Hospital',
  clinica: 'Clínica',
  clinic: 'Clínica',
  doctors: 'Médico',
  medico: 'Médico',
  pharmacy: 'Farmacia',
  farmacia: 'Farmacia',
  // Recreation
  park: 'Parque',
  playground: 'Parque infantil',
  sports_centre: 'Centro deportivo',
  cinema: 'Cine',
  theatre: 'Teatro',
  museum: 'Museo',
  gallery: 'Galería',
  attraction: 'Atracción turística',
  monument: 'Monumento',
  historic_site: 'Sitio histórico',
  arts_centre: 'Centro de artes',
  culture: 'Cultura',
};

export function getSubcategoryLabel(subtype: string, lang: Lang = 'es'): string {
  if (lang === 'es' && subcategoryTranslations[subtype]) {
    return subcategoryTranslations[subtype];
  }
  return subtype
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
