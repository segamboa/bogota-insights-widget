/**
 * Database types for properties.
 */

export type PropertyType = 'apartamento' | 'casa' | 'oficina' | 'local' | 'bodega' | 'lote' | 'finca' | 'otro';
export type PropertyStatus = 'activo' | 'vendido' | 'arrendado' | 'inactivo' | 'desconocido';

export interface PropertyListing {
  source: string;
  sourceId: string;
  sourceUrl?: string;
  propertyType: PropertyType;
  businessType: string; // 'venta', 'arriendo'
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
