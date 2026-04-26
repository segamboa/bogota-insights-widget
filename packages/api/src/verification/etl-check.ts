#!/usr/bin/env node
/**
 * ETL Verification Script
 * Implements SPEC-005: Post-ETL Verification Checks
 * 
 * Usage: npm run verify:etl
 *        npx tsx src/verification/etl-check.ts [--strict]
 */

import { config } from 'dotenv';
config();

import { pool, query } from '../db/connection.js';
import {
  ETL_THRESHOLDS,
  ETL_CATEGORY_RANGES,
  ETL_SUBCATEGORY_MIN,
  ETL_DATA_FRESHNESS_DAYS,
  GEO_BOUNDS,
} from '../config.js';

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: Record<string, any>;
}

interface Thresholds {
  min: number;
  optimal: number;
  critical: number;
}

// Thresholds loaded from config.ts (env-overridable, defaults from SPEC-005)

// ============================================================================
// CHECK FUNCTIONS
// ============================================================================

/**
 * CHK-001: Verify counts by source
 */
async function checkSourceCounts(): Promise<CheckResult> {
  const result = await query(`
    SELECT source, COUNT(*) as count 
    FROM pois 
    WHERE is_canonical = TRUE 
    GROUP BY source 
    ORDER BY source
  `);

  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    counts[row.source] = parseInt(row.count, 10);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const issues: string[] = [];

  // Check individual sources
  for (const [source, threshold] of Object.entries(ETL_THRESHOLDS)) {
    if (source === 'total_pois') continue;
    const count = counts[source] || 0;
    if (count < threshold.critical) {
      issues.push(`${source}: ${count} (critical: < ${threshold.critical})`);
    } else if (count < threshold.min) {
      issues.push(`${source}: ${count} (low: < ${threshold.min})`);
    }
  }

  // Check total
  if (total < ETL_THRESHOLDS.total_pois.critical) {
    issues.push(`Total: ${total} (critical: < ${ETL_THRESHOLDS.total_pois.critical})`);
  } else if (total < ETL_THRESHOLDS.total_pois.min) {
    issues.push(`Total: ${total} (low: < ${ETL_THRESHOLDS.total_pois.min})`);
  }

  const status = issues.length === 0 ? 'PASS' : issues.some(i => i.includes('critical')) ? 'FAIL' : 'WARN';
  const message = issues.length === 0 
    ? `Total: ${total.toLocaleString()} POIs (optimal: ${ETL_THRESHOLDS.total_pois.optimal})`
    : issues.join(', ');

  return {
    name: 'CHK-001: Source Counts',
    status,
    message,
    details: counts,
  };
}

/**
 * CHK-002: Verify distribution by category
 */
async function checkCategoryDistribution(): Promise<CheckResult> {
  const result = await query(`
    SELECT category, COUNT(*) as count 
    FROM pois 
    WHERE is_canonical = TRUE 
    GROUP BY category 
    ORDER BY count DESC
  `);

  const expected = ETL_CATEGORY_RANGES;

  const counts: Record<string, number> = {};
  const issues: string[] = [];

  for (const row of result.rows) {
    counts[row.category] = parseInt(row.count, 10);
  }

  for (const [cat, range] of Object.entries(expected)) {
    const count = counts[cat] || 0;
    if (count < range.min || count > range.max * 1.5) {
      issues.push(`${cat}: ${count} (expected: ${range.min}-${range.max})`);
    }
  }

  return {
    name: 'CHK-002: Category Distribution',
    status: issues.length === 0 ? 'PASS' : 'WARN',
    message: issues.length === 0 ? 'All categories within expected ranges' : issues.join(', '),
    details: counts,
  };
}

/**
 * CHK-003: Verify no duplicates
 */
async function checkNoDuplicates(): Promise<CheckResult> {
  const result = await query(`
    SELECT source, source_id, COUNT(*) as count
    FROM pois
    GROUP BY source, source_id
    HAVING COUNT(*) > 1
    LIMIT 10
  `);

  const duplicates = result.rows.length;

  return {
    name: 'CHK-003: No Duplicates',
    status: duplicates === 0 ? 'PASS' : 'FAIL',
    message: duplicates === 0 ? 'No duplicates found' : `${duplicates} duplicate(s) found (showing first 10)`,
    details: duplicates > 0 ? { duplicates: result.rows } : undefined,
  };
}

/**
 * CHK-004: Verify valid coordinates
 */
async function checkValidCoordinates(): Promise<CheckResult> {
  const result = await query(`
    SELECT COUNT(*) as count
    FROM pois
    WHERE location IS NULL
       OR ST_Y(location::geometry) < $1
       OR ST_Y(location::geometry) > $2
       OR ST_X(location::geometry) < $3
       OR ST_X(location::geometry) > $4
  `, [GEO_BOUNDS.south, GEO_BOUNDS.north, GEO_BOUNDS.west, GEO_BOUNDS.east]);

  const invalid = parseInt(result.rows[0].count, 10);

  return {
    name: 'CHK-004: Valid Coordinates',
    status: invalid === 0 ? 'PASS' : 'FAIL',
    message: invalid === 0 ? 'All POIs have valid coordinates within configured bounds' : `${invalid} POI(s) with invalid coordinates`,
  };
}

/**
 * CHK-005: Verify confidence score range
 */
async function checkConfidenceRange(): Promise<CheckResult> {
  const result = await query(`
    SELECT COUNT(*) as count
    FROM pois
    WHERE confidence < 0 OR confidence > 100
  `);

  const invalid = parseInt(result.rows[0].count, 10);

  // Also check distribution
  const distribution = await query(`
    SELECT 
      CASE 
        WHEN confidence >= 90 THEN '90-100'
        WHEN confidence >= 70 THEN '70-89'
        WHEN confidence >= 50 THEN '50-69'
        ELSE '0-49'
      END as range,
      COUNT(*) as count
    FROM pois
    WHERE is_canonical = TRUE
    GROUP BY 1
    ORDER BY 1 DESC
  `);

  return {
    name: 'CHK-005: Confidence Score Range',
    status: invalid === 0 ? 'PASS' : 'FAIL',
    message: invalid === 0 ? 'All confidence scores in valid range (0-100)' : `${invalid} POI(s) with invalid confidence`,
    details: { distribution: distribution.rows },
  };
}

/**
 * CHK-006: Verify recent sync runs
 */
async function checkRecentSyncRuns(): Promise<CheckResult> {
  const result = await query(`
    SELECT 
      source,
      status,
      records_created,
      records_updated,
      started_at,
      EXTRACT(EPOCH FROM (completed_at - started_at)) / 60 as duration_min
    FROM sync_runs
    WHERE started_at > NOW() - INTERVAL '24 hours'
    ORDER BY started_at DESC
  `);

  const runs = result.rows;
  const sources = new Set(runs.map(r => r.source));
  const expectedSources = ['ideca', 'osm', 'transmilenio'];
  const missingSources = expectedSources.filter(s => !sources.has(s));

  const failedRuns = runs.filter(r => r.status === 'failed');

  let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  let message = `Found ${runs.length} sync run(s) in last 24h`;

  if (failedRuns.length > 0) {
    status = 'FAIL';
    message += `, ${failedRuns.length} failed`;
  }
  if (missingSources.length > 0) {
    status = status === 'PASS' ? 'WARN' : status;
    message += `, missing: ${missingSources.join(', ')}`;
  }

  return {
    name: 'CHK-006: Recent Sync Runs',
    status,
    message,
    details: { runs: runs.slice(0, 5) }, // Show last 5
  };
}

/**
 * CHK-007: Verify subcategory diversity
 */
async function checkSubcategoryDiversity(): Promise<CheckResult> {
  const result = await query(`
    SELECT 
      category,
      COUNT(DISTINCT subcategory) as unique_subcategories,
      COUNT(*) as total_pois
    FROM pois
    WHERE is_canonical = TRUE
    GROUP BY category
    ORDER BY category
  `);

  const diversity: Record<string, { unique: number; total: number }> = {};
  for (const row of result.rows) {
    diversity[row.category] = {
      unique: parseInt(row.unique_subcategories, 10),
      total: parseInt(row.total_pois, 10),
    };
  }

  // Expected minimum diversity from config
  const expected = ETL_SUBCATEGORY_MIN;

  const issues: string[] = [];
  for (const [cat, minUnique] of Object.entries(expected)) {
    const actual = diversity[cat]?.unique || 0;
    if (actual < minUnique) {
      issues.push(`${cat}: ${actual} subcategories (expected >= ${minUnique})`);
    }
  }

  return {
    name: 'CHK-007: Subcategory Diversity',
    status: issues.length === 0 ? 'PASS' : 'WARN',
    message: issues.length === 0 ? 'Good diversity across all categories' : issues.join(', '),
    details: diversity,
  };
}

/**
 * CHK-008: Verify data freshness
 */
async function checkDataFreshness(): Promise<CheckResult> {
  const result = await query(`
    SELECT 
      source,
      MAX(synced_at) as last_sync
    FROM pois
    WHERE is_canonical = TRUE
    GROUP BY source
    ORDER BY source
  `);

  const now = new Date();
  const issues: string[] = [];
  const details: Record<string, string> = {};

  for (const row of result.rows) {
    const lastSync = new Date(row.last_sync);
    const daysAgo = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24));
    details[row.source] = `${daysAgo} days ago`;

    if (daysAgo > ETL_DATA_FRESHNESS_DAYS) {
      issues.push(`${row.source}: ${daysAgo} days old (max: ${ETL_DATA_FRESHNESS_DAYS})`);
    }
  }

  return {
    name: 'CHK-008: Data Freshness',
    status: issues.length === 0 ? 'PASS' : 'WARN',
    message: issues.length === 0 ? `All data synced within last ${ETL_DATA_FRESHNESS_DAYS} days` : issues.join(', '),
    details,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function runVerification(): Promise<void> {
  const startTime = Date.now();
  const isStrict = process.argv.includes('--strict');

  console.log(`${colors.bold}${colors.blue}`);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           BOGOTÁ INSIGHTS - ETL VERIFICATION                 ║');
  console.log('║              Spec-Driven Development (SDD)                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);

  const checks = [
    checkSourceCounts,
    checkCategoryDistribution,
    checkNoDuplicates,
    checkValidCoordinates,
    checkConfidenceRange,
    checkRecentSyncRuns,
    checkSubcategoryDiversity,
    checkDataFreshness,
  ];

  const results: CheckResult[] = [];

  for (const check of checks) {
    try {
      const result = await check();
      results.push(result);

      // Print result
      const statusColor = result.status === 'PASS' ? colors.green 
                        : result.status === 'WARN' ? colors.yellow 
                        : colors.red;
      
      console.log(`${statusColor}[${result.status}]${colors.reset} ${result.name}`);
      console.log(`      ${result.message}`);
      
      if (result.details && Object.keys(result.details).length > 0) {
        console.log(`      Details:`, JSON.stringify(result.details, null, 2).split('\n').join('\n      '));
      }
      console.log();
    } catch (err) {
      results.push({
        name: check.name,
        status: 'FAIL',
        message: `Check failed with error: ${err instanceof Error ? err.message : String(err)}`,
      });
      console.log(`${colors.red}[FAIL]${colors.reset} ${check.name}`);
      console.log(`      Error: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  // Summary
  const passCount = results.filter(r => r.status === 'PASS').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`Results: ${colors.green}${passCount} PASS${colors.reset}, ${colors.yellow}${warnCount} WARN${colors.reset}, ${colors.red}${failCount} FAIL${colors.reset}`);
  console.log(`Duration: ${duration}s`);
  console.log(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  // Exit code
  if (failCount > 0) {
    console.log(`${colors.red}✗ VERIFICATION FAILED${colors.reset}`);
    console.log('Please review the failed checks above.\n');
    process.exit(1);
  } else if (warnCount > 0 && isStrict) {
    console.log(`${colors.yellow}⚠ VERIFICATION PASSED WITH WARNINGS (strict mode)${colors.reset}\n`);
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(`${colors.yellow}⚠ VERIFICATION PASSED WITH WARNINGS${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.green}✓ ALL CHECKS PASSED${colors.reset}`);
    console.log('ETL is healthy and ready for production.\n');
    process.exit(0);
  }
}

// Run verification
runVerification().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
}).finally(async () => {
  await pool.end();
});
