#!/usr/bin/env node
/**
 * Test script for Metrocuadrado scraper.
 * Run: npx tsx src/services/scrapers/test-metrocuadrado.ts
 */
import { searchMetrocuadrado, ingestMetrocuadrado } from './metrocuadrado.js';
import { pool } from '../../db/connection.js';

async function testSearch() {
  console.log('=== Testing Metrocuadrado Search ===\n');
  
  try {
    const listings = await searchMetrocuadrado({
      businessType: 'venta',
      propertyType: 'apartamento',
      offset: 0,
      limit: 5,
    });

    console.log(`Found ${listings.length} listings\n`);

    if (listings.length > 0) {
      console.log('First listing sample:');
      console.log(JSON.stringify(listings[0], null, 2));
    }

    return listings.length > 0;
  } catch (err) {
    console.error('Search test failed:', err);
    return false;
  }
}

async function testIngest() {
  console.log('\n=== Testing Metrocuadrado Ingest ===\n');
  
  try {
    const result = await ingestMetrocuadrado({
      businessType: 'venta',
      propertyTypes: ['apartamento'],
      maxResults: 10, // Solo 10 para prueba
    });

    console.log('\nIngest result:', result);
    return result.created > 0 || result.updated > 0;
  } catch (err) {
    console.error('Ingest test failed:', err);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'both';

  let searchOk = true;
  let ingestOk = true;

  if (testType === 'search' || testType === 'both') {
    searchOk = await testSearch();
  }

  if (testType === 'ingest' || testType === 'both') {
    ingestOk = await testIngest();
  }

  await pool.end();

  console.log('\n=== Test Summary ===');
  console.log(`Search: ${searchOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Ingest: ${ingestOk ? '✅ PASS' : '❌ FAIL'}`);

  process.exit(searchOk && ingestOk ? 0 : 1);
}

main();
