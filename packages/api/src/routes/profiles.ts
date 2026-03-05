/**
 * Profile-based API routes
 * Positive-focused location insights
 */

import type { FastifyInstance } from 'fastify';
import { findPoisWithinRadius, getCategoryCounts } from '../db/queries.js';
import { pool } from '../db/connection.js';
import { 
  getLocationProfile, 
  getLocationPersona, 
  generatePositiveSummary, 
  getPositiveScorePresentation 
} from '../services/location-profiles.js';
import { ERROR_CODES } from '@bogota-insights/shared';
import { isWithinBogota } from '../middleware/validation.js';
import type { CategoryType } from '@bogota-insights/shared';

export async function profileRoutes(fastify: FastifyInstance): Promise<void> {
  
  // GET /v1/profile - Get profile-based insights (positive focus)
  fastify.get('/v1/profile', async (request, reply) => {
    const { lat, lng, radius = '1000', lang = 'es' } = request.query as {
      lat?: string;
      lng?: string;
      radius?: string;
      lang?: string;
    };

    const latNum = parseFloat(lat || '');
    const lngNum = parseFloat(lng || '');

    if (isNaN(latNum) || isNaN(lngNum)) {
      return reply.code(400).send({
        error: { code: ERROR_CODES.INVALID_COORDINATES, message: 'lat and lng required' }
      });
    }

    if (!isWithinBogota(latNum, lngNum)) {
      return reply.code(400).send({
        error: { 
          code: ERROR_CODES.OUTSIDE_COVERAGE, 
          message: 'Outside Bogota metropolitan area' 
        }
      });
    }

    try {
      const radiusM = parseInt(radius, 10);
      
      // Get POIs
      const allPois = await findPoisWithinRadius(lngNum, latNum, radiusM);
      
      // Count by category
      const categoryCounts: Record<CategoryType, number> = {
        transport: 0, commerce: 0, education: 0, health: 0, recreation: 0
      };
      
      const categoryScores: Record<CategoryType, number> = {
        transport: 0, commerce: 0, education: 0, health: 0, recreation: 0
      };

      // Group POIs by category and calculate scores
      const poisByCategory: Record<CategoryType, typeof allPois> = {
        transport: [], commerce: [], education: [], health: [], recreation: []
      };

      for (const poi of allPois) {
        if (poisByCategory[poi.category]) {
          poisByCategory[poi.category].push(poi);
          categoryCounts[poi.category]++;
        }
      }

      // Calculate scores for each category (simplified)
      const avgCounts = { transport: 3, commerce: 12, education: 4, health: 2, recreation: 8 };
      
      for (const cat of Object.keys(poisByCategory) as CategoryType[]) {
        const pois = poisByCategory[cat];
        if (pois.length === 0) {
          categoryScores[cat] = 25;
        } else {
          const countScore = Math.min((pois.length / avgCounts[cat]) * 50, 60);
          const proximityScore = pois.slice(0, 5).reduce((sum, p) => {
            return sum + Math.max(0, 1 - p.distance_m / radiusM) * 15;
          }, 0);
          categoryScores[cat] = Math.round(25 + countScore + proximityScore);
        }
      }

      // Determine density
      const totalPois = allPois.length;
      const density: 'high' | 'medium' | 'low' = 
        totalPois > 50 ? 'high' : totalPois > 20 ? 'medium' : 'low';

      // Get profile
      const profile = getLocationProfile(categoryScores, categoryCounts, density);
      
      // Find top category
      const topCategory = Object.entries(categoryScores)
        .sort((a, b) => b[1] - a[1])[0][0] as CategoryType;
      
      const persona = getLocationPersona(categoryScores, topCategory);
      const presentation = getPositiveScorePresentation(categoryScores[topCategory], profile);
      const summary = generatePositiveSummary(profile, persona, totalPois);

      // Get top facilities
      const topFacilities = allPois.slice(0, 5).map(p => ({
        id: String(p.id),
        name: p.name || p.name_es || 'Facilidad',
        category: p.category,
        subcategory: p.subcategory,
        distanceM: Math.round(p.distance_m),
        walkingTimeMin: Math.round(p.distance_m / 83),
        isPremium: ['hospital', 'university', 'mall', 'park'].includes(p.subcategory)
      }));

      return reply.send({
        location: { lat: latNum, lng: lngNum },
        profile: {
          type: profile.type,
          headline: lang === 'en' ? profile.headline : translateHeadline(profile.headline),
          tagline: lang === 'en' ? profile.tagline : translateTagline(profile.tagline),
          highlights: profile.highlights,
          idealFor: profile.idealFor,
        },
        persona: {
          title: persona.title,
          icon: persona.icon,
          description: persona.description,
          lifestyle: persona.lifestyle,
        },
        presentation: {
          stars: presentation.stars,
          label: presentation.label,
          badge: presentation.badge,
        },
        scores: categoryScores,
        topCategory,
        topFacilities,
        summary,
        totalFacilities: totalPois,
        meta: {
          radius_m: radiusM,
          lang,
          timestamp: new Date().toISOString(),
        }
      });

    } catch (err) {
      fastify.log.error(err, 'Error computing profile');
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to compute profile' }
      });
    }
  });
}

// Simple translations
function translateHeadline(headline: string): string {
  const translations: Record<string, string> = {
    'Corazón Urbano': 'Urban Heart',
    'Ideal para Familias': 'Family Friendly',
    'Oasis de Tranquilidad': 'Tranquil Oasis',
    'Zona Comercial': 'Commercial Hub',
    'Equilibrio Perfecto': 'Perfect Balance',
    'Potencial por Descubrir': 'Hidden Gem',
  };
  return translations[headline] || headline;
}

function translateTagline(tagline: string): string {
  const translations: Record<string, string> = {
    'Todo a tu alcance': 'Everything within reach',
    'Espacio para crecer': 'Room to grow',
    'Espacio para respirar': 'Room to breathe',
    'Vida y movimiento': 'Life and movement',
    'Lo mejor de dos mundos': 'Best of both worlds',
    'Oportunidad única': 'Unique opportunity',
  };
  return translations[tagline] || tagline;
}
