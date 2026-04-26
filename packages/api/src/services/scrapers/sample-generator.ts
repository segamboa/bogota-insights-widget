/**
 * Generate sample property data for ML model development.
 * Uses realistic distributions based on Bogotá market data.
 */
import { upsertProperty } from '../../db/property-queries.js';
import type { PropertyType } from '../../db/types.js';

// Bogotá bounds
const BOGOTA_BOUNDS = {
  lat: { min: 4.4, max: 4.85 },
  lng: { min: -74.3, max: -73.9 },
};

// Localidades with average price per m2 (COP) for apartments
const LOCALIDADES: Record<string, { 
  center: [number, number]; 
  radius: number;
  avgPriceM2: number;
  stratumDist: number[]; // Probabilities for strata 1-6
}> = {
  'Chapinero': { 
    center: [4.65, -74.05], 
    radius: 0.03, 
    avgPriceM2: 7500000,
    stratumDist: [0, 0, 5, 20, 50, 25],
  },
  'Usaquén': { 
    center: [4.70, -74.03], 
    radius: 0.04, 
    avgPriceM2: 6500000,
    stratumDist: [0, 0, 5, 15, 45, 35],
  },
  'Suba': { 
    center: [4.75, -74.08], 
    radius: 0.06, 
    avgPriceM2: 4200000,
    stratumDist: [5, 15, 35, 30, 12, 3],
  },
  'Kennedy': { 
    center: [4.62, -74.15], 
    radius: 0.05, 
    avgPriceM2: 3500000,
    stratumDist: [10, 25, 35, 20, 8, 2],
  },
  'Teusaquillo': { 
    center: [4.63, -74.08], 
    radius: 0.03, 
    avgPriceM2: 5800000,
    stratumDist: [0, 0, 5, 30, 45, 20],
  },
  'Santa Fe': { 
    center: [4.60, -74.07], 
    radius: 0.025, 
    avgPriceM2: 6800000,
    stratumDist: [0, 5, 10, 35, 35, 15],
  },
  'Fontibón': { 
    center: [4.67, -74.15], 
    radius: 0.05, 
    avgPriceM2: 3800000,
    stratumDist: [5, 20, 35, 25, 12, 3],
  },
  'Engativá': { 
    center: [4.71, -74.11], 
    radius: 0.04, 
    avgPriceM2: 4000000,
    stratumDist: [5, 15, 35, 30, 12, 3],
  },
  'Puente Aranda': { 
    center: [4.61, -74.11], 
    radius: 0.04, 
    avgPriceM2: 3600000,
    stratumDist: [5, 20, 35, 25, 12, 3],
  },
  'Bosa': { 
    center: [4.60, -74.19], 
    radius: 0.05, 
    avgPriceM2: 2800000,
    stratumDist: [15, 30, 35, 15, 4, 1],
  },
  'Ciudad Bolívar': { 
    center: [4.50, -74.15], 
    radius: 0.06, 
    avgPriceM2: 2200000,
    stratumDist: [20, 35, 30, 12, 2, 1],
  },
  'Rafael Uribe Uribe': { 
    center: [4.57, -74.12], 
    radius: 0.04, 
    avgPriceM2: 3200000,
    stratumDist: [10, 25, 35, 20, 8, 2],
  },
  'San Cristóbal': { 
    center: [4.55, -74.08], 
    radius: 0.05, 
    avgPriceM2: 3000000,
    stratumDist: [15, 25, 35, 18, 6, 1],
  },
  'Tunjuelito': { 
    center: [4.58, -74.14], 
    radius: 0.035, 
    avgPriceM2: 2900000,
    stratumDist: [15, 30, 35, 15, 4, 1],
  },
  'Los Mártires': { 
    center: [4.60, -74.09], 
    radius: 0.02, 
    avgPriceM2: 5200000,
    stratumDist: [0, 5, 15, 40, 30, 10],
  },
  'Antonio Nariño': { 
    center: [4.55, -74.10], 
    radius: 0.025, 
    avgPriceM2: 3100000,
    stratumDist: [10, 25, 35, 20, 8, 2],
  },
  'Barrios Unidos': { 
    center: [4.67, -74.08], 
    radius: 0.03, 
    avgPriceM2: 4500000,
    stratumDist: [2, 10, 30, 35, 18, 5],
  },
  'Usme': { 
    center: [4.47, -74.12], 
    radius: 0.07, 
    avgPriceM2: 2000000,
    stratumDist: [25, 35, 28, 10, 2, 0],
  },
  'Sumapaz': { 
    center: [4.50, -74.25], 
    radius: 0.08, 
    avgPriceM2: 1800000,
    stratumDist: [30, 35, 25, 8, 2, 0],
  },
  'La Candelaria': { 
    center: [4.60, -74.07], 
    radius: 0.015, 
    avgPriceM2: 6200000,
    stratumDist: [0, 0, 10, 40, 35, 15],
  },
};

const BARRIOS: Record<string, string[]> = {
  'Chapinero': ['El Nogal', 'Chico Norte', 'Chapinero Alto', 'Marly', 'Sucre', 'Pardo Rubio'],
  'Usaquén': ['Cedritos', 'Santa Bárbara', 'Uniceros', 'San Patricio', 'Toberín'],
  'Suba': ['Niza', 'Colina Campestre', 'Suba Centro', 'Portales del Norte', 'El Rincón'],
  'Kennedy': ['Kennedy Central', 'Granjas de Kennedy', 'Tintal', 'Patio Bonito', 'Castilla'],
  'Teusaquillo': ['Quinta Paredes', 'La Soledad', 'Galerías', 'Camuchita'],
  'Santa Fe': ['Las Nieves', 'La Macarena', 'San Diego', 'González Jiménez'],
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRandom(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) return i + 1; // Strata are 1-indexed
  }
  return 1;
}

function generatePropertyId(index: number): string {
  return `sample-${Date.now()}-${index}`;
}

function generateCoordinates(center: [number, number], radius: number): { lat: number; lng: number } {
  // Random point within circle
  const r = radius * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  
  const lat = center[0] + r * Math.cos(theta);
  const lng = center[1] + r * Math.sin(theta);
  
  return { lat, lng };
}

interface GeneratedProperty {
  sourceId: string;
  propertyType: PropertyType;
  businessType: string;
  lat: number;
  lng: number;
  address: string;
  neighborhood: string;
  locality: string;
  stratum: number;
  builtAreaM2: number;
  rooms: number;
  bathrooms: number;
  garages: number;
  antiquityYears: number;
  priceCop: number;
  adminFeeCop: number;
  title: string;
  description: string;
}

function generateProperty(locality: string, index: number): GeneratedProperty {
  const locData = LOCALIDADES[locality];
  const { lat, lng } = generateCoordinates(locData.center, locData.radius);
  
  const stratum = weightedRandom(locData.stratumDist);
  const propertyType: PropertyType = Math.random() > 0.3 ? 'apartamento' : 'casa';
  
  // Area based on property type and stratum
  let baseArea = propertyType === 'apartamento' 
    ? randomInt(45, 120) 
    : randomInt(80, 300);
  
  // Higher stratum = larger areas on average
  baseArea = Math.round(baseArea * (0.8 + stratum * 0.08));
  
  // Rooms based on area
  const rooms = Math.max(1, Math.floor(baseArea / 35) + randomInt(0, 2));
  const bathrooms = Math.max(1, Math.floor(rooms * 0.6) + randomInt(0, 2));
  const garages = randomInt(0, 3);
  
  // Antiquity
  const antiquityYears = weightedRandom([5, 10, 25, 30, 20, 10]);
  
  // Price calculation
  const stratumMultiplier = 0.6 + stratum * 0.15;
  const antiquityDiscount = antiquityYears > 20 ? 0.85 : antiquityYears > 10 ? 0.92 : 1;
  const areaMultiplier = Math.pow(baseArea / 70, 0.3); // Slight discount for very large
  
  const pricePerM2 = locData.avgPriceM2 * stratumMultiplier * antiquityDiscount;
  const priceCop = Math.round(baseArea * pricePerM2 * areaMultiplier);
  
  // Admin fee (only for apartments)
  const adminFeeCop = propertyType === 'apartamento' 
    ? Math.round(baseArea * (300000 + stratum * 100000))
    : 0;
  
  const neighborhood = BARRIOS[locality] 
    ? randomChoice(BARRIOS[locality])
    : `Barrio ${randomInt(1, 50)}`;
  
  const address = `Calle ${randomInt(10, 200)} # ${randomInt(10, 80)} - ${randomInt(10, 90)}`;
  
  const titles = {
    apartamento: [
      `Hermoso apartamento en ${neighborhood}`,
      `Apartamento ${rooms} hab ${baseArea}m² - ${locality}`,
      `Excelente apto ${stratum}° estrato en ${locality}`,
      `Apartamento con vista en ${neighborhood}`,
    ],
    casa: [
      `Casa amplia en ${neighborhood}`,
      `Casa ${rooms} hab ${baseArea}m² - ${locality}`,
      `Hermosa casa ${stratum}° estrato`,
      `Casa con jardín en ${locality}`,
    ],
  };
  
  return {
    sourceId: generatePropertyId(index),
    propertyType,
    businessType: 'venta',
    lat,
    lng,
    address,
    neighborhood,
    locality,
    stratum,
    builtAreaM2: baseArea,
    rooms,
    bathrooms,
    garages,
    antiquityYears,
    priceCop,
    adminFeeCop,
    title: randomChoice(titles[propertyType]),
    description: `Inmueble de ${baseArea}m² ubicado en ${neighborhood}, ${locality}. ` +
      `Estrato ${stratum}, ${rooms} habitaciones, ${bathrooms} baños. ` +
      `Excelente ubicación y acceso a vías principales.`,
  };
}

/**
 * Generate and insert sample properties.
 */
export async function generateSampleProperties(
  count: number = 1000
): Promise<{
  created: number;
  errors: number;
}> {
  const localities = Object.keys(LOCALIDADES);
  
  let created = 0;
  let errors = 0;
  
  console.log(`=== Generating ${count} Sample Properties ===\n`);
  
  for (let i = 0; i < count; i++) {
    const locality = localities[i % localities.length];
    const property = generateProperty(locality, i);
    
    try {
      await upsertProperty('sample', property.sourceId, {
        sourceUrl: `https://example.com/property/${property.sourceId}`,
        propertyType: property.propertyType,
        businessType: property.businessType,
        lat: property.lat,
        lng: property.lng,
        address: property.address,
        neighborhood: property.neighborhood,
        locality: property.locality,
        city: 'Bogotá',
        stratum: property.stratum,
        builtAreaM2: property.builtAreaM2,
        rooms: property.rooms,
        bathrooms: property.bathrooms,
        garages: property.garages,
        antiquityYears: property.antiquityYears,
        priceCop: property.priceCop,
        adminFeeCop: property.adminFeeCop,
        title: property.title,
        description: property.description,
        features: property.propertyType === 'apartamento' 
          ? ['Ascensor', 'Gimnasio', 'Parqueadero']
          : ['Jardín', 'Terraza'],
      });
      
      created++;
      
      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/${count} created`);
      }
      
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`  Error creating property ${i}:`, err);
      }
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Created: ${created}`);
  console.log(`Errors: ${errors}`);
  
  return { created, errors };
}

// Direct run
if (import.meta.url === `file://${process.argv[1]}`) {
  const count = parseInt(process.argv[2] || '100', 10);
  
  generateSampleProperties(count)
    .then((result) => {
      console.log('Done:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal:', err);
      process.exit(1);
    });
}
