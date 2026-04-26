/**
 * Export properties to CSV/JSON for ML training.
 */
import { pool } from '../db/connection.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface MLRow {
  property_type: string;
  locality: string;
  neighborhood: string;
  stratum: number;
  built_area_m2: number;
  rooms: number;
  bathrooms: number;
  garages: number;
  antiquity_years: number;
  lat: number;
  lng: number;
  price_cop: number;
  price_per_m2: number;
}

async function exportForML(
  outputPath: string,
  format: 'json' | 'csv' = 'csv'
): Promise<void> {
  console.log('=== Exporting Properties for ML ===\n');
  
  const result = await pool.query<MLRow>(`
    SELECT 
      property_type,
      locality,
      neighborhood,
      stratum,
      built_area_m2,
      rooms,
      bathrooms,
      garages,
      antiquity_years,
      ST_Y(location::geometry) as lat,
      ST_X(location::geometry) as lng,
      price_cop,
      price_per_m2
    FROM properties
    WHERE has_coordinates = TRUE
      AND is_duplicate = FALSE
      AND price_cop > 0
      AND built_area_m2 > 0
    ORDER BY scraped_at DESC
  `);
  
  console.log(`Exported ${result.rows.length} properties`);
  
  if (format === 'csv') {
    // CSV header
    const headers = [
      'property_type', 'locality', 'neighborhood', 'stratum',
      'built_area_m2', 'rooms', 'bathrooms', 'garages', 'antiquity_years',
      'lat', 'lng', 'price_cop', 'price_per_m2'
    ];
    
    // CSV rows
    const rows = result.rows.map(row => [
      row.property_type,
      row.locality,
      row.neighborhood,
      row.stratum,
      row.built_area_m2,
      row.rooms,
      row.bathrooms,
      row.garages,
      row.antiquity_years,
      row.lat,
      row.lng,
      row.price_cop,
      row.price_per_m2,
    ].join(','));
    
    const csv = [headers.join(','), ...rows].join('\n');
    writeFileSync(outputPath, csv);
    
  } else {
    // JSON
    writeFileSync(outputPath, JSON.stringify(result.rows, null, 2));
  }
  
  console.log(`Saved to: ${outputPath}`);
  
  // Print stats
  const prices = result.rows.map(r => r.price_cop);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  console.log(`\nPrice stats:`);
  console.log(`  Average: $${(avgPrice / 1000000).toFixed(1)}M COP`);
  console.log(`  Min: $${(Math.min(...prices) / 1000000).toFixed(1)}M COP`);
  console.log(`  Max: $${(Math.max(...prices) / 1000000).toFixed(1)}M COP`);
  
  await pool.end();
}

// CLI
const format = process.argv[2] === '--json' ? 'json' : 'csv';
const filename = `properties_ml_${Date.now()}.${format}`;
const outputPath = join(process.cwd(), 'data', filename);

exportForML(outputPath, format)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Export failed:', err);
    process.exit(1);
  });
