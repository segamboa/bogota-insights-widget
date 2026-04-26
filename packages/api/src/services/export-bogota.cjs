#!/usr/bin/env node
/**
 * Export Bogotá properties to CSV for ML.
 * Separate exports for VENTA (sale) and ARRIENDO (rental).
 */
const pg = require('/data/.openclaw/workspace/bogota-insights-widget/node_modules/.pnpm/pg@8.19.0/node_modules/pg');
const fs = require('fs');
const { join } = require('path');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://bogota:bogota_dev_2026@localhost:5432/bogota_insights',
});

const DATA_DIR = '/data/.openclaw/workspace/bogota-insights-widget/packages/api/data';

async function exportToCSV(filename, businessType) {
  console.log(`=== Exporting ${businessType === 'venta' ? 'SALE' : 'RENTAL'} properties ===\n`);
  
  const result = await pool.query(`
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
    WHERE business_type = $1
      AND has_coordinates = TRUE
      AND is_duplicate = FALSE
      AND price_cop > 0
      AND built_area_m2 > 0
    ORDER BY scraped_at DESC
  `, [businessType]);
  
  console.log(`Found ${result.rows.length} properties`);
  
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
  const filepath = join(DATA_DIR, filename);
  fs.writeFileSync(filepath, csv);
  
  console.log(`Saved to: ${filepath}`);
  
  // Stats
  const prices = result.rows.map(r => r.price_cop);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  console.log(`\nPrice stats (${businessType}):`);
  console.log(`  Count: ${prices.length}`);
  console.log(`  Min: $${Math.min(...prices).toLocaleString()}`);
  console.log(`  Max: $${Math.max(...prices).toLocaleString()}`);
  console.log(`  Avg: $${Math.round(avg).toLocaleString()}`);
  
  return result.rows.length;
}

async function main() {
  // Export VENTA (sale) properties
  const saleCount = await exportToCSV('bogota_venta_ml.csv', 'venta');
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Export ARRIENDO (rental) properties
  const rentalCount = await exportToCSV('bogota_arriendo_ml.csv', 'arriendo');
  
  console.log('\n' + '='.repeat(50));
  console.log('\n✅ EXPORT COMPLETE!');
  console.log(`\nFiles created:`);
  console.log(`  📊 bogota_venta_ml.csv - ${saleCount} properties (SALE)`);
  console.log(`  📊 bogota_arriendo_ml.csv - ${rentalCount} properties (RENTAL)`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
