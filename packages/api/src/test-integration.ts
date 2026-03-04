/**
 * Integration test script for the Bogota Insights API.
 * Tests 5 neighborhoods and validates scores.
 */

const BASE_URL = 'http://localhost:3000';

interface TestLocation {
  name: string;
  estrato: string;
  lat: number;
  lng: number;
}

const TEST_LOCATIONS: TestLocation[] = [
  { name: 'Kennedy', estrato: '2-3', lat: 4.6280, lng: -74.1500 },
  { name: 'Chapinero', estrato: '4-5', lat: 4.6534, lng: -74.0551 },
  { name: 'Usaquen', estrato: '5-6', lat: 4.7060, lng: -74.0335 },
  { name: 'Centro (La Candelaria)', estrato: '2-4', lat: 4.5981, lng: -74.0758 },
  { name: 'Suba', estrato: '3-4', lat: 4.7416, lng: -74.0927 },
];

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.log(`  FAIL: ${message}`);
  }
}

async function testHealth() {
  console.log('\n=== Health Check ===');
  const res = await fetch(`${BASE_URL}/health`);
  const data = await res.json() as any;
  assert(res.status === 200, 'Health returns 200');
  assert(data.status === 'ok', 'Status is ok');
  assert(data.services.database === 'up', 'Database is up');
  assert(data.services.redis === 'up', 'Redis is up');
}

async function testInsightsEndpoint(loc: TestLocation) {
  console.log(`\n=== ${loc.name} (Estrato ${loc.estrato}) ===`);
  const url = `${BASE_URL}/v1/insights?lat=${loc.lat}&lng=${loc.lng}&radius=1000`;
  const res = await fetch(url);
  const data = await res.json() as any;

  assert(res.status === 200, `${loc.name}: Returns 200`);
  assert(data.scores !== undefined, `${loc.name}: Has scores`);
  assert(data.scores.overall >= 0 && data.scores.overall <= 100, `${loc.name}: Overall score in range (${data.scores.overall})`);
  assert(data.scores.transport >= 0 && data.scores.transport <= 100, `${loc.name}: Transport score in range (${data.scores.transport})`);
  assert(data.scores.education >= 0 && data.scores.education <= 100, `${loc.name}: Education score in range (${data.scores.education})`);
  assert(data.scores.health >= 0 && data.scores.health <= 100, `${loc.name}: Health score in range (${data.scores.health})`);
  assert(data.scores.commerce >= 0 && data.scores.commerce <= 100, `${loc.name}: Commerce score in range (${data.scores.commerce})`);

  // At least some categories should have data
  const hasData = data.scores.transport > 0 || data.scores.education > 0 || data.scores.health > 0 || data.scores.commerce > 0;
  assert(hasData, `${loc.name}: At least one category has data`);

  // Check metadata
  assert(data.meta !== undefined, `${loc.name}: Has metadata`);
  assert(data.meta.radius_m === 1000, `${loc.name}: Radius is 1000`);

  // Check location (geohash-6 cache key may shift coordinates within ~0.01 degree)
  assert(Math.abs(data.location.lat - loc.lat) < 0.01, `${loc.name}: Location lat matches (${data.location.lat} vs ${loc.lat})`);
  assert(Math.abs(data.location.lng - loc.lng) < 0.01, `${loc.name}: Location lng matches (${data.location.lng} vs ${loc.lng})`);

  console.log(`  Scores: overall=${data.scores.overall}, transport=${data.scores.transport}, commerce=${data.scores.commerce}, education=${data.scores.education}, health=${data.scores.health}, recreation=${data.scores.recreation}`);
  console.log(`  Cache hit: ${data.meta.cache_hit}`);
}

async function testCaching(loc: TestLocation) {
  console.log('\n=== Cache Behavior ===');
  const url = `${BASE_URL}/v1/scores?lat=${loc.lat}&lng=${loc.lng}&radius=1000`;

  // First request (might be cached from previous test)
  const res1 = await fetch(url);
  const data1 = await res1.json() as any;

  // Second request should be cached
  const start = Date.now();
  const res2 = await fetch(url);
  const data2 = await res2.json() as any;
  const elapsed = Date.now() - start;

  assert(data2.meta.cache_hit === true, `Cache hit on second request`);
  assert(elapsed < 50, `Cached response < 50ms (was ${elapsed}ms)`);
  assert(data1.scores.overall === data2.scores.overall, 'Cached score matches original');
}

async function testErrorHandling() {
  console.log('\n=== Error Handling ===');

  // Outside coverage
  const res1 = await fetch(`${BASE_URL}/v1/insights?lat=40.7128&lng=-74.0060&radius=1000`);
  const data1 = await res1.json() as any;
  assert(res1.status === 400, 'Outside coverage returns 400');
  assert(data1.error.code === 'OUTSIDE_COVERAGE', 'Error code is OUTSIDE_COVERAGE');

  // Missing params
  const res2 = await fetch(`${BASE_URL}/v1/insights`);
  assert(res2.status === 400, 'Missing params returns 400');

  // Invalid lat
  const res3 = await fetch(`${BASE_URL}/v1/insights?lat=abc&lng=-74.05&radius=1000`);
  assert(res3.status === 400, 'Invalid lat returns 400');
}

async function testPoisEndpoint() {
  console.log('\n=== POIs Endpoint ===');
  const url = `${BASE_URL}/v1/pois?lat=4.6534&lng=-74.0551&radius=1000&categories=education`;
  const res = await fetch(url);
  const data = await res.json() as any;
  assert(res.status === 200, 'POIs returns 200');
  assert(Array.isArray(data.pois), 'Returns pois array');
  assert(data.total > 0, `Has POIs (${data.total})`);
  if (data.pois.length > 0) {
    assert(data.pois[0].name !== undefined, 'POI has name');
    assert(data.pois[0].distance_m !== undefined, 'POI has distance');
    assert(data.pois[0].category === 'education', 'POI category matches filter');
  }
}

async function main() {
  console.log('Bogota Insights API - Integration Tests');
  console.log('========================================');

  try {
    await testHealth();
    for (const loc of TEST_LOCATIONS) {
      await testInsightsEndpoint(loc);
    }
    await testCaching(TEST_LOCATIONS[0]);
    await testErrorHandling();
    await testPoisEndpoint();

    console.log('\n========================================');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`Status: ${failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

main();
