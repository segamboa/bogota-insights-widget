/**
 * Grid generation utilities for heatmap calibration
 * Creates a grid of points across Bogota metro area
 */

import ngeohash from 'ngeohash';
import { BOGOTA_BOUNDS } from '@bogota-insights/shared';

export interface GridCell {
  lat: number;
  lng: number;
  geohash: string;
}

/**
 * Generate a grid of points within Bogota bounds
 * @param spacingMeters - Distance between grid points in meters (default: 1000m = 1km)
 * @returns Array of grid cells
 */
export function generateBogotaGrid(spacingMeters: number = 1000): GridCell[] {
  const cells: GridCell[] = [];
  
  // Convert spacing to approximate degrees
  // 1 degree lat ~ 111km, 1 degree lng ~ 111km * cos(lat)
  // At Bogota latitude (~4.65°N), cos(4.65°) ≈ 0.997
  const latStep = spacingMeters / 111000; // degrees
  const avgLat = (BOGOTA_BOUNDS.north + BOGOTA_BOUNDS.south) / 2;
  const lngStep = spacingMeters / (111000 * Math.cos(avgLat * Math.PI / 180));
  
  // Generate grid
  for (let lat = BOGOTA_BOUNDS.south; lat <= BOGOTA_BOUNDS.north; lat += latStep) {
    for (let lng = BOGOTA_BOUNDS.west; lng <= BOGOTA_BOUNDS.east; lng += lngStep) {
      // Round to avoid floating point issues
      const roundedLat = Math.round(lat * 1000000) / 1000000;
      const roundedLng = Math.round(lng * 1000000) / 1000000;
      
      cells.push({
        lat: roundedLat,
        lng: roundedLng,
        geohash: ngeohash.encode(roundedLat, roundedLng, 6),
      });
    }
  }
  
  // Remove duplicates by geohash
  const uniqueCells = Array.from(
    new Map(cells.map(c => [c.geohash, c])).values()
  );
  
  console.log(`Generated ${uniqueCells.length} grid cells with ${spacingMeters}m spacing`);
  return uniqueCells;
}

/**
 * Generate grid with custom bounds (for testing smaller areas)
 */
export function generateCustomGrid(
  bounds: { north: number; south: number; east: number; west: number },
  spacingMeters: number = 1000
): GridCell[] {
  const cells: GridCell[] = [];
  
  const latStep = spacingMeters / 111000;
  const avgLat = (bounds.north + bounds.south) / 2;
  const lngStep = spacingMeters / (111000 * Math.cos(avgLat * Math.PI / 180));
  
  for (let lat = bounds.south; lat <= bounds.north; lat += latStep) {
    for (let lng = bounds.west; lng <= bounds.east; lng += lngStep) {
      const roundedLat = Math.round(lat * 1000000) / 1000000;
      const roundedLng = Math.round(lng * 1000000) / 1000000;
      
      cells.push({
        lat: roundedLat,
        lng: roundedLng,
        geohash: ngeohash.encode(roundedLat, roundedLng, 6),
      });
    }
  }
  
  return Array.from(new Map(cells.map(c => [c.geohash, c])).values());
}

/**
 * Get grid statistics
 */
export function getGridStats(cells: GridCell[]): {
  totalCells: number;
  latRange: number;
  lngRange: number;
  estimatedCoverage: string;
} {
  const lats = cells.map(c => c.lat);
  const lngs = cells.map(c => c.lng);
  
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  // Rough area calculation (km²)
  const latRangeKm = (maxLat - minLat) * 111;
  const lngRangeKm = (maxLng - minLng) * 111 * Math.cos(minLat * Math.PI / 180);
  const areaKm2 = latRangeKm * lngRangeKm;
  
  return {
    totalCells: cells.length,
    latRange: maxLat - minLat,
    lngRange: maxLng - minLng,
    estimatedCoverage: `~${Math.round(areaKm2)} km²`,
  };
}

// CLI test
if (process.argv[1] && process.argv[1].includes('grid-generator')) {
  const spacing = parseInt(process.argv[2] || '1000', 10);
  const grid = generateBogotaGrid(spacing);
  const stats = getGridStats(grid);
  
  console.log('\nGrid Generation Results:');
  console.log('========================');
  console.log(`Spacing: ${spacing}m`);
  console.log(`Total cells: ${stats.totalCells}`);
  console.log(`Lat range: ${stats.latRange.toFixed(4)}°`);
  console.log(`Lng range: ${stats.lngRange.toFixed(4)}°`);
  console.log(`Coverage: ${stats.estimatedCoverage}`);
  console.log('\nFirst 5 cells:');
  grid.slice(0, 5).forEach(c => {
    console.log(`  ${c.geohash}: ${c.lat}, ${c.lng}`);
  });
}
