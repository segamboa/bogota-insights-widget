#!/usr/bin/env tsx
/**
 * Seed script for local development.
 * Inserts sample POIs so the widget works immediately
 * without running the full ETL pipeline.
 *
 * A dev customer and API key already exist from migration 009.
 * Default dev key: pk_dev_bogota2026
 *
 * Usage: npx tsx src/db/seed.ts
 */

import { config } from 'dotenv';
config();

import { query, pool } from './connection.js';

interface SeedPoi {
  source: string;
  sourceId: string;
  sourceDataset: string;
  category: string;
  subcategory: string;
  name: string;
  nameEs: string | null;
  lat: number;
  lng: number;
  address: string | null;
  confidence: number;
  sourceTags: Record<string, unknown>;
}

// Sample POIs around Chapinero, Bogotá
const SAMPLE_POIS: SeedPoi[] = [
  // Transport
  { source: 'transmilenio', sourceId: 'tm-calle-85', sourceDataset: 'transmilenio-estaciones', category: 'transport', subcategory: 'bus_station', name: 'Estación Calle 85', nameEs: 'Estación Calle 85', lat: 4.6715, lng: -74.0572, address: 'Calle 85 con Carrera 15', confidence: 95, sourceTags: { line: 'H' } },
  { source: 'transmilenio', sourceId: 'tm-calle-100', sourceDataset: 'transmilenio-estaciones', category: 'transport', subcategory: 'bus_station', name: 'Estación Calle 100', nameEs: 'Estación Calle 100', lat: 4.6842, lng: -74.0558, address: 'Calle 100 con Carrera 15', confidence: 95, sourceTags: { line: 'H' } },
  { source: 'osm', sourceId: 'osm-sitp-1', sourceDataset: 'osm-sitp', category: 'transport', subcategory: 'bus_stop', name: 'Parada SITP Cra 15 #85', nameEs: 'Parada SITP Cra 15 #85', lat: 4.6701, lng: -74.0565, address: null, confidence: 70, sourceTags: {} },
  { source: 'osm', sourceId: 'osm-sitp-2', sourceDataset: 'osm-sitp', category: 'transport', subcategory: 'bus_stop', name: 'Parada SITP Cra 11 #82', nameEs: 'Parada SITP Cra 11 #82', lat: 4.6678, lng: -74.0532, address: null, confidence: 70, sourceTags: {} },
  { source: 'osm', sourceId: 'osm-bike-1', sourceDataset: 'osm-bicycle', category: 'transport', subcategory: 'bicycle_rental', name: 'Cicloruta Carrera 11', nameEs: 'Cicloruta Carrera 11', lat: 4.6650, lng: -74.0520, address: null, confidence: 60, sourceTags: {} },

  // Commerce
  { source: 'osm', sourceId: 'osm-andino', sourceDataset: 'osm-shops', category: 'commerce', subcategory: 'mall', name: 'Centro Comercial Andino', nameEs: 'Centro Comercial Andino', lat: 4.6665, lng: -74.0525, address: 'Calle 82 #12-21', confidence: 90, sourceTags: { brand: 'Andino' } },
  { source: 'osm', sourceId: 'osm-exito-85', sourceDataset: 'osm-shops', category: 'commerce', subcategory: 'supermarket', name: 'Éxito Express Calle 85', nameEs: 'Éxito Express Calle 85', lat: 4.6720, lng: -74.0580, address: 'Calle 85 #14-30', confidence: 85, sourceTags: { brand: 'Éxito' } },
  { source: 'osm', sourceId: 'osm-banco-1', sourceDataset: 'osm-banks', category: 'commerce', subcategory: 'bank', name: 'Banco de Bogotá', nameEs: 'Banco de Bogotá', lat: 4.6690, lng: -74.0550, address: 'Calle 82 #10-40', confidence: 85, sourceTags: { brand: 'Banco de Bogotá' } },
  { source: 'osm', sourceId: 'osm-cafe-1', sourceDataset: 'osm-cafes', category: 'commerce', subcategory: 'cafe', name: 'Juan Valdez', nameEs: 'Juan Valdez', lat: 4.6680, lng: -74.0545, address: 'Calle 82 #12-10', confidence: 80, sourceTags: { brand: 'Juan Valdez' } },
  { source: 'osm', sourceId: 'osm-rest-1', sourceDataset: 'osm-restaurants', category: 'commerce', subcategory: 'restaurant', name: 'Restaurante Andres Carne de Res', nameEs: 'Restaurante Andres Carne de Res', lat: 4.6710, lng: -74.0570, address: 'Zona T', confidence: 75, sourceTags: { cuisine: 'colombian' } },

  // Education
  { source: 'ideca', sourceId: 'ideca-sanbartolome', sourceDataset: 'colegios-bogota', category: 'education', subcategory: 'school', name: 'Colegio San Bartolomé La Merced', nameEs: 'Colegio San Bartolomé La Merced', lat: 4.6600, lng: -74.0600, address: 'Carrera 7 #8-21', confidence: 95, sourceTags: { type: 'secundaria' } },
  { source: 'ideca', sourceId: 'ideca-javeriana', sourceDataset: 'universidades-bogota', category: 'education', subcategory: 'university', name: 'Pontificia Universidad Javeriana', nameEs: 'Pontificia Universidad Javeriana', lat: 4.6825, lng: -74.0650, address: 'Carrera 7 #40-62', confidence: 95, sourceTags: { type: 'universidad' } },
  { source: 'ideca', sourceId: 'ideca-biblio-barco', sourceDataset: 'bibliotecas-publicas', category: 'education', subcategory: 'library', name: 'Biblioteca Virgilio Barco', nameEs: 'Biblioteca Virgilio Barco', lat: 4.6560, lng: -74.0820, address: 'Calle 57 #5-00', confidence: 95, sourceTags: {} },
  { source: 'ideca', sourceId: 'ideca-nogal', sourceDataset: 'colegios-bogota', category: 'education', subcategory: 'school', name: 'Gimnasio Moderno', nameEs: 'Gimnasio Moderno', lat: 4.6650, lng: -74.0550, address: 'Calle 74 #1-80', confidence: 90, sourceTags: { type: 'primaria_y_secundaria' } },
  { source: 'osm', sourceId: 'osm-kindergarten-1', sourceDataset: 'osm-education', category: 'education', subcategory: 'kindergarten', name: 'Jardín Infantil Pequeños Gigantes', nameEs: 'Jardín Infantil Pequeños Gigantes', lat: 4.6700, lng: -74.0560, address: null, confidence: 65, sourceTags: {} },

  // Health
  { source: 'ideca', sourceId: 'ideca-clinica-country', sourceDataset: 'hospitales-clinicas', category: 'health', subcategory: 'hospital', name: 'Clínica del Country', nameEs: 'Clínica del Country', lat: 4.6760, lng: -74.0480, address: 'Calle 82 #10-22', confidence: 95, sourceTags: { level: 'tertiary' } },
  { source: 'ideca', sourceId: 'ideca-fundacion-santafe', sourceDataset: 'hospitales-clinicas', category: 'health', subcategory: 'hospital', name: 'Fundación Santa Fe de Bogotá', nameEs: 'Fundación Santa Fe de Bogotá', lat: 4.6840, lng: -74.0550, address: 'Calle 119 #7-75', confidence: 95, sourceTags: { level: 'tertiary' } },
  { source: 'osm', sourceId: 'osm-drogueria-1', sourceDataset: 'osm-pharmacy', category: 'health', subcategory: 'pharmacy', name: 'Droguería Colsubsidio', nameEs: 'Droguería Colsubsidio', lat: 4.6690, lng: -74.0565, address: 'Calle 85 #15-20', confidence: 80, sourceTags: { brand: 'Colsubsidio' } },
  { source: 'osm', sourceId: 'osm-doctor-1', sourceDataset: 'osm-doctors', category: 'health', subcategory: 'doctors', name: 'Consultorio Médico Zona T', nameEs: 'Consultorio Médico Zona T', lat: 4.6710, lng: -74.0575, address: null, confidence: 60, sourceTags: {} },

  // Recreation
  { source: 'ideca', sourceId: 'ideca-parque-93', sourceDataset: 'parques-zonas-verdes', category: 'recreation', subcategory: 'park', name: 'Parque de la 93', nameEs: 'Parque de la 93', lat: 4.6765, lng: -74.0485, address: 'Calle 93A con Carrera 11A', confidence: 95, sourceTags: { area: 'medium' } },
  { source: 'ideca', sourceId: 'ideca-parque-chico', sourceDataset: 'parques-zonas-verdes', category: 'recreation', subcategory: 'park', name: 'Parque El Chico', nameEs: 'Parque El Chico', lat: 4.6820, lng: -74.0450, address: 'Calle 94 con Carrera 13', confidence: 95, sourceTags: { area: 'large' } },
  { source: 'osm', sourceId: 'osm-cinema-1', sourceDataset: 'osm-cinema', category: 'recreation', subcategory: 'cinema', name: 'Cine Colombia Andino', nameEs: 'Cine Colombia Andino', lat: 4.6668, lng: -74.0528, address: 'C.C. Andino', confidence: 85, sourceTags: {} },
  { source: 'osm', sourceId: 'osm-gym-1', sourceDataset: 'osm-sports', category: 'recreation', subcategory: 'sports_centre', name: 'Smart Fit Zona T', nameEs: 'Smart Fit Zona T', lat: 4.6705, lng: -74.0560, address: 'Calle 82 #12-30', confidence: 75, sourceTags: { brand: 'Smart Fit' } },
  { source: 'osm', sourceId: 'osm-playground-1', sourceDataset: 'osm-playground', category: 'recreation', subcategory: 'playground', name: 'Juegos Infantiles Parque 93', nameEs: 'Juegos Infantiles Parque 93', lat: 4.6770, lng: -74.0490, address: null, confidence: 60, sourceTags: {} },
];

async function seed(): Promise<void> {
  console.log('🌱 Seeding development data...\n');

  try {
    // 1. Verify dev API key exists (from migration 009)
    const keyResult = await query(
      `SELECT ak.id, ak.customer_id, c.name 
       FROM api_keys ak
       JOIN customers c ON c.id = ak.customer_id
       WHERE ak.key_hash = '00acc2fde4649de4a5017c74cb893bf03581e9160dae24ac90a6b8e9dbee29af'`
    );
    if (keyResult.rows.length === 0) {
      console.warn('  ⚠️  Dev API key not found. Migration 009 may not have run.');
    } else {
      console.log(`  ✅ Dev API key found: pk_dev_bogota2026 (${keyResult.rows[0].name})`);
    }

    // 2. Seed POIs
    let inserted = 0;
    let skipped = 0;
    for (const poi of SAMPLE_POIS) {
      try {
        await query(
          `INSERT INTO pois (source, source_id, source_dataset, category, subcategory,
                             name, name_es, location, address, confidence, source_tags, synced_at, is_canonical)
           VALUES ($1, $2, $3, $4, $5, $6, $7,
                   ST_MakePoint($8, $9)::geography,
                   $10, $11, $12, NOW(), TRUE)
           ON CONFLICT (source, source_id) DO UPDATE SET
             name = EXCLUDED.name,
             location = EXCLUDED.location,
             confidence = EXCLUDED.confidence,
             synced_at = NOW(),
             is_canonical = TRUE`,
          [
            poi.source,
            poi.sourceId,
            poi.sourceDataset,
            poi.category,
            poi.subcategory,
            poi.name,
            poi.nameEs,
            poi.lng,
            poi.lat,
            poi.address,
            poi.confidence,
            JSON.stringify(poi.sourceTags),
          ],
        );
        inserted++;
      } catch (err) {
        skipped++;
        if (skipped <= 3) {
          console.warn(`  ⚠️  Skipped ${poi.name}: ${(err as Error).message}`);
        }
      }
    }

    console.log(`  ✅ POIs: ${inserted} inserted/updated, ${skipped} skipped`);

    console.log('\n🎉 Seed complete!');
    console.log(`   API Key: pk_dev_bogota2026`);
    console.log(`   Use: curl http://localhost:3000/v1/insights?lat=4.67&lng=-74.055 -H "X-API-Key: pk_dev_bogota2026"`);
  } catch (err) {
    console.error('\n❌ Seed failed:', (err as Error).message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
