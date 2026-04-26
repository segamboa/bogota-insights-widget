/**
 * Property database queries.
 */
import { query } from './connection.js';
import type { PropertyType, PropertyStatus } from './types.js';

export interface PropertyRow {
  id: number;
  source: string;
  source_id: string;
  source_url: string | null;
  property_type: PropertyType;
  business_type: string;
  status: PropertyStatus;
  lat: number;
  lng: number;
  address: string | null;
  neighborhood: string | null;
  locality: string | null;
  city: string;
  stratum: number | null;
  built_area_m2: number | null;
  land_area_m2: number | null;
  rooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  floor: number | null;
  antiquity_years: number | null;
  price_cop: number;
  price_per_m2: number | null;
  admin_fee_cop: number | null;
  features: string[];
  title: string | null;
  description: string | null;
  agency_name: string | null;
  contact_phone: string | null;
  published_at: Date | null;
  scraped_at: Date;
}

export interface PropertyFilter {
  locality?: string;
  neighborhood?: string;
  propertyType?: PropertyType;
  businessType?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  stratum?: number;
  minRooms?: number;
}

/**
 * Upsert a property from a data source.
 */
export async function upsertProperty(
  source: string,
  sourceId: string,
  property: {
    sourceUrl?: string;
    propertyType: PropertyType;
    businessType: string;
    status?: PropertyStatus;
    lat: number;
    lng: number;
    address?: string;
    neighborhood?: string;
    locality?: string;
    city?: string;
    stratum?: number;
    builtAreaM2?: number;
    landAreaM2?: number;
    rooms?: number;
    bathrooms?: number;
    garages?: number;
    floor?: number;
    antiquityYears?: number;
    priceCop: number;
    adminFeeCop?: number;
    features?: string[];
    title?: string;
    description?: string;
    agencyName?: string;
    contactPhone?: string;
    sourceRawData?: Record<string, unknown>;
    publishedAt?: Date;
  }
): Promise<{ id: number; isNew: boolean }> {
  // Calculate price per m2
  const pricePerM2 = property.builtAreaM2 && property.builtAreaM2 > 0
    ? Math.round(property.priceCop / property.builtAreaM2)
    : null;

  const result = await query(
    `INSERT INTO properties (
      source, source_id, source_url, property_type, business_type, status,
      location, address, neighborhood, locality, city, stratum,
      built_area_m2, land_area_m2, rooms, bathrooms, garages, floor, antiquity_years,
      price_cop, price_per_m2, admin_fee_cop, features,
      title, description, agency_name, contact_phone,
      source_raw_data, published_at, scraped_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      ST_MakePoint($7, $8)::geography, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24,
      $25, $26, $27, $28,
      $29, $30, NOW()
    )
    ON CONFLICT (source, source_id)
    DO UPDATE SET
      source_url = EXCLUDED.source_url,
      property_type = EXCLUDED.property_type,
      business_type = EXCLUDED.business_type,
      status = EXCLUDED.status,
      location = EXCLUDED.location,
      address = EXCLUDED.address,
      neighborhood = EXCLUDED.neighborhood,
      locality = EXCLUDED.locality,
      city = EXCLUDED.city,
      stratum = EXCLUDED.stratum,
      built_area_m2 = EXCLUDED.built_area_m2,
      land_area_m2 = EXCLUDED.land_area_m2,
      rooms = EXCLUDED.rooms,
      bathrooms = EXCLUDED.bathrooms,
      garages = EXCLUDED.garages,
      floor = EXCLUDED.floor,
      antiquity_years = EXCLUDED.antiquity_years,
      price_cop = EXCLUDED.price_cop,
      price_per_m2 = EXCLUDED.price_per_m2,
      admin_fee_cop = EXCLUDED.admin_fee_cop,
      features = EXCLUDED.features,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      agency_name = EXCLUDED.agency_name,
      contact_phone = EXCLUDED.contact_phone,
      source_raw_data = EXCLUDED.source_raw_data,
      published_at = EXCLUDED.published_at,
      scraped_at = NOW()
    RETURNING id, (xmax = 0) AS is_new`,
    [
      source,
      sourceId,
      property.sourceUrl ?? null,
      property.propertyType,
      property.businessType,
      property.status ?? 'activo',
      property.lng,
      property.lat,
      property.address ?? null,
      property.neighborhood ?? null,
      property.locality ?? null,
      property.city ?? 'Bogotá',
      property.stratum ?? null,
      property.builtAreaM2 ?? null,
      property.landAreaM2 ?? null,
      property.rooms ?? null,
      property.bathrooms ?? null,
      property.garages ?? null,
      property.floor ?? null,
      property.antiquityYears ?? null,
      property.priceCop,
      pricePerM2,
      property.adminFeeCop ?? null,
      property.features ?? [],
      property.title ?? null,
      property.description ?? null,
      property.agencyName ?? null,
      property.contactPhone ?? null,
      property.sourceRawData ? JSON.stringify(property.sourceRawData) : null,
      property.publishedAt ?? null,
    ]
  );

  return {
    id: result.rows[0].id,
    isNew: result.rows[0].is_new,
  };
}

/**
 * Find properties within a radius.
 */
export async function findPropertiesWithinRadius(
  lng: number,
  lat: number,
  radiusM: number,
  filter?: PropertyFilter
): Promise<PropertyRow[]> {
  const conditions: string[] = ['ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)'];
  const params: any[] = [lng, lat, radiusM];
  let paramIdx = 3;

  if (filter?.locality) {
    conditions.push(`locality = $${++paramIdx}`);
    params.push(filter.locality);
  }
  if (filter?.neighborhood) {
    conditions.push(`neighborhood = $${++paramIdx}`);
    params.push(filter.neighborhood);
  }
  if (filter?.propertyType) {
    conditions.push(`property_type = $${++paramIdx}`);
    params.push(filter.propertyType);
  }
  if (filter?.businessType) {
    conditions.push(`business_type = $${++paramIdx}`);
    params.push(filter.businessType);
  }
  if (filter?.minPrice) {
    conditions.push(`price_cop >= $${++paramIdx}`);
    params.push(filter.minPrice);
  }
  if (filter?.maxPrice) {
    conditions.push(`price_cop <= $${++paramIdx}`);
    params.push(filter.maxPrice);
  }
  if (filter?.minArea) {
    conditions.push(`built_area_m2 >= $${++paramIdx}`);
    params.push(filter.minArea);
  }
  if (filter?.maxArea) {
    conditions.push(`built_area_m2 <= $${++paramIdx}`);
    params.push(filter.maxArea);
  }
  if (filter?.stratum) {
    conditions.push(`stratum = $${++paramIdx}`);
    params.push(filter.stratum);
  }
  if (filter?.minRooms) {
    conditions.push(`rooms >= $${++paramIdx}`);
    params.push(filter.minRooms);
  }

  const result = await query<PropertyRow>(
    `SELECT
      id, source, source_id, source_url, property_type, business_type, status,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      address, neighborhood, locality, city, stratum,
      built_area_m2, land_area_m2, rooms, bathrooms, garages, floor, antiquity_years,
      price_cop, price_per_m2, admin_fee_cop, features,
      title, description, agency_name, contact_phone,
      published_at, scraped_at
    FROM properties
    WHERE ${conditions.join(' AND ')}
      AND is_duplicate = FALSE
    ORDER BY ST_Distance(location, ST_MakePoint($1, $2)::geography) ASC
    LIMIT 500`,
    params
  );

  return result.rows;
}

/**
 * Get price statistics by locality and property type.
 */
export async function getPriceStats(
  locality?: string,
  propertyType?: PropertyType
): Promise<{
  count: number;
  avgPrice: number;
  medianPrice: number | null;
  minPrice: number;
  maxPrice: number;
  avgPricePerM2: number | null;
}> {
  const conditions: string[] = ['is_duplicate = FALSE'];
  const params: any[] = [];
  let paramIdx = 0;

  if (locality) {
    conditions.push(`locality = $${++paramIdx}`);
    params.push(locality);
  }
  if (propertyType) {
    conditions.push(`property_type = $${++paramIdx}`);
    params.push(propertyType);
  }

  const result = await query(
    `SELECT
      COUNT(*) as count,
      AVG(price_cop) as avg_price,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_cop) as median_price,
      MIN(price_cop) as min_price,
      MAX(price_cop) as max_price,
      AVG(price_per_m2) as avg_price_per_m2
    FROM properties
    WHERE ${conditions.join(' AND ')}`,
    params
  );

  const row = result.rows[0];
  return {
    count: parseInt(row.count, 10),
    avgPrice: Math.round(parseFloat(row.avg_price) || 0),
    medianPrice: row.median_price ? Math.round(parseFloat(row.median_price)) : null,
    minPrice: parseInt(row.min_price, 10) || 0,
    maxPrice: parseInt(row.max_price, 10) || 0,
    avgPricePerM2: row.avg_price_per_m2 ? Math.round(parseFloat(row.avg_price_per_m2)) : null,
  };
}

/**
 * Mark duplicate properties based on criteria.
 */
export async function markDuplicates(
  neighborhood: string,
  propertyType: PropertyType,
  rooms: number,
  areaThreshold: number = 5
): Promise<number> {
  const result = await query(
    `WITH duplicates AS (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY neighborhood, property_type, rooms, 
            ROUND(built_area_m2::numeric / $3) * $3
          ORDER BY scraped_at DESC
        ) as rn
      FROM properties
      WHERE neighborhood = $1
        AND property_type = $2
        AND rooms = $4
        AND built_area_m2 IS NOT NULL
    )
    UPDATE properties p
    SET is_duplicate = TRUE
    FROM duplicates d
    WHERE p.id = d.id AND d.rn > 1
    RETURNING p.id`,
    [neighborhood, propertyType, areaThreshold, rooms]
  );

  return result.rowCount || 0;
}

/**
 * Get property count by source.
 */
export async function getPropertyCountsBySource(): Promise<Record<string, number>> {
  const result = await query(
    `SELECT source, COUNT(*) as count 
     FROM properties 
     WHERE is_duplicate = FALSE 
     GROUP BY source`
  );

  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    counts[row.source] = parseInt(row.count, 10);
  }
  return counts;
}

/**
 * Get sample properties for ML training.
 */
export async function getPropertiesForML(
  limit: number = 10000,
  offset: number = 0
): Promise<PropertyRow[]> {
  const result = await query<PropertyRow>(
    `SELECT
      id, source, source_id, source_url, property_type, business_type, status,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      address, neighborhood, locality, city, stratum,
      built_area_m2, land_area_m2, rooms, bathrooms, garages, floor, antiquity_years,
      price_cop, price_per_m2, admin_fee_cop, features,
      title, description, agency_name, contact_phone,
      published_at, scraped_at
    FROM properties
    WHERE has_coordinates = TRUE
      AND is_duplicate = FALSE
      AND price_cop > 0
      AND built_area_m2 > 0
    ORDER BY scraped_at DESC
    LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows;
}
