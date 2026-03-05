/**
 * Context-aware location profiles
 * Highlights strengths based on what the location actually offers
 * No "bad" scores - just different lifestyles
 */

import type { CategoryType } from '@bogota-insights/shared';

export interface LocationProfile {
  type: 'urban' | 'suburban' | 'tranquil' | 'family' | 'commercial' | 'mixed';
  headline: string;
  tagline: string;
  highlights: string[];
  idealFor: string[];
  scoreRange: { min: number; max: number };
}

export interface LocationPersona {
  title: string;
  icon: string;
  description: string;
  bestFeatures: string[];
  lifestyle: string;
}

/**
 * Determine location profile based on actual characteristics
 */
export function getLocationProfile(
  scores: Record<CategoryType, number>,
  poiCounts: Record<CategoryType, number>,
  density: 'high' | 'medium' | 'low'
): LocationProfile {
  const { transport, commerce, education, health, recreation } = scores;
  const totalPois = Object.values(poiCounts).reduce((a, b) => a + b, 0);
  
  // URBAN: High connectivity, lots of services
  if (transport >= 70 && commerce >= 70 && density === 'high') {
    return {
      type: 'urban',
      headline: 'Corazón Urbano',
      tagline: 'Todo a tu alcance',
      highlights: [
        `🚌 ${poiCounts.transport || 0} opciones de transporte`,
        `🛒 ${poiCounts.commerce || 0} establecimientos comerciales`,
        '⚡ Máxima conectividad',
        '🏃 Vida dinámica y activa'
      ],
      idealFor: ['Profesionales', 'Jóvenes', 'Amantes de la ciudad'],
      scoreRange: { min: 70, max: 100 }
    };
  }
  
  // FAMILY: Good schools, parks, health
  if (education >= 60 && recreation >= 60 && health >= 50) {
    return {
      type: 'family',
      headline: 'Ideal para Familias',
      tagline: 'Espacio para crecer',
      highlights: [
        `🎓 ${poiCounts.education || 0} instituciones educativas`,
        `🌳 ${poiCounts.recreation || 0} zonas de recreación`,
        `🏥 ${poiCounts.health || 0} servicios de salud`,
        '👨‍👩‍👧‍👦 Ambiente familiar seguro'
      ],
      idealFor: ['Familias con niños', 'Parejas', 'Long-term residents'],
      scoreRange: { min: 50, max: 80 }
    };
  }
  
  // TRANQUIL: Low density, parks, residential
  if (density === 'low' && recreation >= 40 && transport < 50) {
    return {
      type: 'tranquil',
      headline: 'Oasis de Tranquilidad',
      tagline: 'Espacio para respirar',
      highlights: [
        `🌳 ${poiCounts.recreation || 0} parques y zonas verdes`,
        '🏡 Ambiente residencial tranquilo',
        '🌄 Aire puro y vistas abiertas',
        '🚗 Conexión por carretera disponible'
      ],
      idealFor: ['Busca tranquilidad', 'Teletrabajadores', 'Retirados', 'Amantes de la naturaleza'],
      scoreRange: { min: 25, max: 55 }
    };
  }
  
  // COMMERCIAL: Lots of shops, restaurants
  if (commerce >= 70 && poiCounts.commerce > 20) {
    return {
      type: 'commercial',
      headline: 'Zona Comercial',
      tagline: 'Vida y movimiento',
      highlights: [
        `🛒 ${poiCounts.commerce || 0} comercios cercanos`,
        '🍽️ Variedad gastronómica',
        '🏪 Servicios 24/7',
        '💼 Oportunidades de negocio'
      ],
      idealFor: ['Emprendedores', 'Comerciantes', 'Urbanitas'],
      scoreRange: { min: 60, max: 90 }
    };
  }
  
  // SUBURBAN: Mix of residential with some services
  if (density === 'medium' && totalPois > 20) {
    return {
      type: 'suburban',
      headline: 'Equilibrio Perfecto',
      tagline: 'Lo mejor de dos mundos',
      highlights: [
        '🏘️ Barrio consolidado',
        `✓ ${totalPois} servicios a tu alcance`,
        '🚶 Buena accesibilidad peatonal',
        '🌳 Espacios verdes cercanos'
      ],
      idealFor: ['Familias jóvenes', 'Primeros compradores', 'Busca equilibrio'],
      scoreRange: { min: 40, max: 70 }
    };
  }
  
  // MIXED: Balanced, nothing outstanding
  return {
    type: 'mixed',
    headline: 'Zona en Desarrollo',
    tagline: 'Potencial por descubrir',
    highlights: [
      '📈 Área con crecimiento',
      `📍 ${totalPois} facilidades identificadas`,
      '🏗️ Oportunidad de inversión',
      '💰 Buena relación precio-valor'
    ],
    idealFor: ['Inversionistas', 'Primera vivienda', 'Visionarios'],
    scoreRange: { min: 30, max: 60 }
  };
}

/**
 * Get persona-based recommendation
 */
export function getLocationPersona(
  scores: Record<CategoryType, number>,
  topCategory: CategoryType
): LocationPersona {
  const personas: Record<CategoryType, LocationPersona> = {
    transport: {
      title: 'Conectado al Mundo',
      icon: '🚌',
      description: 'Máxima movilidad para quienes valoran el tiempo',
      bestFeatures: ['Múltiples rutas de transporte', 'Cercanía a vías principales', 'Bajo tiempo de traslado'],
      lifestyle: 'Urbano dinámico'
    },
    commerce: {
      title: 'Vida Práctica',
      icon: '🛒',
      description: 'Todo lo que necesitas, a pocos pasos de casa',
      bestFeatures: ['Comercio local diverso', 'Restaurantes y cafés', 'Servicios diarios'],
      lifestyle: 'Práctico y conveniente'
    },
    education: {
      title: 'Futuro Asegurado',
      icon: '🎓',
      description: 'El mejor entorno para el desarrollo familiar',
      bestFeatures: ['Colegios de calidad', 'Bibliotecas', 'Espacios de estudio'],
      lifestyle: 'Familiar educativo'
    },
    health: {
      title: 'Bienestar Prioritario',
      icon: '🏥',
      description: 'Tranquilidad de tener salud cerca',
      bestFeatures: ['Hospitales cercanos', 'Farmacias', 'Centros de bienestar'],
      lifestyle: 'Consciente y preventivo'
    },
    recreation: {
      title: 'Calidad de Vida',
      icon: '🌳',
      description: 'Espacios para disfrutar, descansar y vivir',
      bestFeatures: ['Parques y zonas verdes', 'Centros deportivos', 'Espacios culturales'],
      lifestyle: 'Activo y saludable'
    }
  };
  
  return personas[topCategory] || personas.recreation;
}

/**
 * Generate positive summary (no negative language)
 */
export function generatePositiveSummary(
  profile: LocationProfile,
  persona: LocationPersona,
  totalPois: number
): string {
  const summaries: Record<LocationProfile['type'], string> = {
    urban: `${persona.title}: ${profile.tagline}. ${totalPois} facilidades para una vida sin límites.`,
    family: `${profile.headline} con ${totalPois} servicios pensados para tu familia. ${persona.description}`,
    tranquil: `${profile.headline}: ${persona.description}. Perfecto para quien busca calidad de vida.`,
    commercial: `${profile.headline} con acceso inmediato a ${totalPois} establecimientos.`,
    suburban: `${profile.headline}: Barrio consolidado con ${totalPois} servicios y excelente potencial.`,
    mixed: `Zona con ${totalPois} facilidades y gran potencial de crecimiento. Oportunidad única.`
  };
  
  return summaries[profile.type];
}

/**
 * Get score presentation (always positive)
 */
export function getPositiveScorePresentation(
  score: number,
  profile: LocationProfile
): { stars: number; label: string; badge: string } {
  // Stars based on the profile's expected range
  const relativeScore = (score - profile.scoreRange.min) / 
    (profile.scoreRange.max - profile.scoreRange.min);
  
  if (relativeScore >= 0.8) {
    return { 
      stars: 5, 
      label: 'Destacado', 
      badge: '⭐⭐⭐⭐⭐ Excelente en su categoría'
    };
  }
  if (relativeScore >= 0.6) {
    return { 
      stars: 4, 
      label: 'Muy Bueno', 
      badge: '⭐⭐⭐⭐ Sólida opción'
    };
  }
  if (relativeScore >= 0.4) {
    return { 
      stars: 3, 
      label: 'Bueno', 
      badge: '⭐⭐⭐ Cumple expectativas'
    };
  }
  return { 
    stars: 2, 
    label: 'Estable', 
    badge: '⭐⭐ Base sólida'
  };
}

// Test
if (process.argv[1] && process.argv[1].includes('location-profiles')) {
  // Test cases
  const testCases = [
    { 
      name: 'Chapinero (Urban)',
      scores: { transport: 85, commerce: 90, education: 70, health: 75, recreation: 60 },
      counts: { transport: 30, commerce: 80, education: 15, health: 10, recreation: 5 },
      density: 'high' as const
    },
    { 
      name: 'Lagos de Córdoba (Suburban)',
      scores: { transport: 60, commerce: 70, education: 65, health: 60, recreation: 80 },
      counts: { transport: 10, commerce: 30, education: 12, health: 8, recreation: 25 },
      density: 'medium' as const
    },
    { 
      name: 'Zona Rural (Tranquil)',
      scores: { transport: 30, commerce: 20, education: 40, health: 25, recreation: 70 },
      counts: { transport: 2, commerce: 5, education: 3, health: 1, recreation: 15 },
      density: 'low' as const
    }
  ];
  
  testCases.forEach(tc => {
    const profile = getLocationProfile(tc.scores, tc.counts, tc.density);
    const topCat = Object.entries(tc.scores).sort((a, b) => b[1] - a[1])[0][0] as CategoryType;
    const persona = getLocationPersona(tc.scores, topCat);
    const presentation = getPositiveScorePresentation(
      tc.scores[topCat], 
      profile
    );
    
    console.log(`\n🏠 ${tc.name}`);
    console.log(`   ${profile.headline}: ${profile.tagline}`);
    console.log(`   ${presentation.badge}`);
    console.log(`   Ideal para: ${profile.idealFor.join(', ')}`);
    console.log(`   Persona: ${persona.title} ${persona.icon}`);
  });
}
