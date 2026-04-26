#!/bin/bash
# ETL Verification Script
# Usage: ./scripts/verify-etl.sh [--strict]

set -e

cd "$(dirname "$0")/.."

echo "🔍 Bogotá Insights - ETL Verification"
echo "======================================"
echo ""

# Check if database is running
echo "Checking database connection..."
if ! npx tsx -e "
import { pool } from './src/db/connection.js';
async function check() {
  try {
    await pool.query('SELECT 1');
    console.log('✓ Database connected');
    await pool.end();
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
    process.exit(1);
  }
}
check();
" 2>/dev/null; then
    echo ""
    echo "❌ Database connection failed!"
    echo "Make sure PostgreSQL is running and DATABASE_URL is configured."
    exit 1
fi

echo ""
echo "Running verification checks..."
echo ""

# Run verification script
npx tsx src/verification/etl-check.ts "$@"
