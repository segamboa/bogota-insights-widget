import { describe, it, expect } from 'vitest'
import { calculateScores } from './scoring'

const makePointFeature = (lat, lng, properties = {}) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lng, lat] },
  properties,
})

const makeLineFeature = (coordinates, properties = {}) => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates },
  properties,
})

const emptyData = {
  pois: { type: 'FeatureCollection', features: [] },
  primaryRoads: { type: 'FeatureCollection', features: [] },
  secondaryRoads: { type: 'FeatureCollection', features: [] },
  hospEscEntret: { type: 'FeatureCollection', features: [] },
  publicTransport: { type: 'FeatureCollection', features: [] },
}

describe('calculateScores', () => {
  it('returns default low scores for empty data', () => {
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, emptyData)
    expect(result.scores.walking.total).toBe(0)
    expect(result.scores.driving.total).toBe(0)
    expect(result.scores.transport).toBeLessThanOrEqual(3)
  })

  it('counts transport stops within walking radius', () => {
    const data = {
      ...emptyData,
      publicTransport: {
        type: 'FeatureCollection',
        features: [
          makePointFeature(4.656, -74.056, { highway: 'bus_stop' }),
          makePointFeature(4.656, -74.056, { public_transport: 'platform' }),
          makePointFeature(4.657, -74.057, { public_transport: 'stop_position' }),
          makePointFeature(4.7, -74.1, { highway: 'bus_stop' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.walk.transport).toBe(3)
    expect(result.scores.walking.details.transport).toBeGreaterThan(0)
  })

  it('counts education amenities within walking radius', () => {
    const data = {
      ...emptyData,
      hospEscEntret: {
        type: 'FeatureCollection',
        features: [
          makePointFeature(4.656, -74.056, { amenity: 'school' }),
          makePointFeature(4.656, -74.057, { amenity: 'library' }),
          makePointFeature(4.656, -74.058, { amenity: 'kindergarten' }),
          makePointFeature(4.7, -74.1, { amenity: 'school' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.walk.education).toBe(3)
  })

  it('counts health including clinic and doctors within drive radius', () => {
    const data = {
      ...emptyData,
      hospEscEntret: {
        type: 'FeatureCollection',
        features: [
          makePointFeature(4.656, -74.056, { amenity: 'hospital' }),
          makePointFeature(4.656, -74.057, { amenity: 'clinic' }),
          makePointFeature(4.656, -74.058, { amenity: 'doctors' }),
          makePointFeature(4.9, -74.3, { amenity: 'hospital' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.drive.health).toBe(3)
  })

  it('counts universities and colleges within drive radius', () => {
    const data = {
      ...emptyData,
      hospEscEntret: {
        type: 'FeatureCollection',
        features: [
          makePointFeature(4.656, -74.056, { amenity: 'university' }),
          makePointFeature(4.656, -74.057, { amenity: 'college' }),
          makePointFeature(4.9, -74.3, { amenity: 'university' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.drive.university).toBe(2)
  })

  it('counts daily amenities from pois', () => {
    const data = {
      ...emptyData,
      pois: {
        type: 'FeatureCollection',
        features: [
          makePointFeature(4.656, -74.056, { shop: 'supermarket' }),
          makePointFeature(4.656, -74.057, { amenity: 'pharmacy' }),
          makePointFeature(4.656, -74.058, { amenity: 'bank' }),
          makePointFeature(4.7, -74.1, { shop: 'supermarket' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.walk.daily).toBe(3)
  })

  it('counts lifestyle amenities from pois', () => {
    const data = {
      ...emptyData,
      pois: {
        type: 'FeatureCollection',
        features: [
          makePointFeature(4.656, -74.056, { amenity: 'restaurant' }),
          makePointFeature(4.656, -74.057, { amenity: 'cafe' }),
          makePointFeature(4.656, -74.058, { leisure: 'park' }),
          makePointFeature(4.7, -74.1, { amenity: 'restaurant' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.walk.lifestyle).toBe(3)
  })

  it('scores primary road connectivity', () => {
    const data = {
      ...emptyData,
      primaryRoads: {
        type: 'FeatureCollection',
        features: [
          makeLineFeature([[-74.06, 4.65], [-74.05, 4.66]], { name: 'Calle 100' }),
          makeLineFeature([[-74.07, 4.65], [-74.06, 4.66]], { name: 'Carrera 15' }),
          makeLineFeature([[-74.08, 4.65], [-74.07, 4.66]], { name: 'Calle 116' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.scores.transport).toBeGreaterThanOrEqual(6)
  })

  it('returns insights array', () => {
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, emptyData)
    expect(result.insights.length).toBeGreaterThan(0)
    expect(result.insights.some(i => i.category === 'Conectividad Vial')).toBe(true)
  })
})
