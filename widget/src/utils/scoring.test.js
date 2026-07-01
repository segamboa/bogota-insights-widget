import { describe, it, expect } from 'vitest'
import { calculateScores, getPoint } from './scoring'

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

describe('getPoint', () => {
  it('returns null for a feature with missing geometry', () => {
    expect(getPoint({ type: 'Feature', properties: {} })).toBeNull()
  })

  it('returns a point for a Point feature', () => {
    const feature = makePointFeature(4.656, -74.056)
    const result = getPoint(feature)
    expect(result).not.toBeNull()
    expect(result.geometry.type).toBe('Point')
    expect(result.geometry.coordinates).toEqual([-74.056, 4.656])
  })

  it('returns a centroid for a Polygon feature', () => {
    const feature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-74.057, 4.655],
            [-74.055, 4.655],
            [-74.055, 4.657],
            [-74.057, 4.657],
            [-74.057, 4.655],
          ],
        ],
      },
      properties: {},
    }
    const result = getPoint(feature)
    expect(result).not.toBeNull()
    expect(result.geometry.type).toBe('Point')
  })
})

describe('calculateScores', () => {
  it('returns default low scores for empty data', () => {
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, emptyData)
    expect(result.scores.walking.total).toBe(0)
    expect(result.scores.driving.total).toBe(0)
    expect(result.scores.transport).toBeLessThanOrEqual(3)
  })

  it('handles missing data keys without crashing', () => {
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, {})
    expect(result.scores.walking.total).toBe(0)
    expect(result.scores.driving.total).toBe(0)
    expect(result.scores.transport).toBe(0)
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
          makePointFeature(4.656, -74.058, { amenity: 'gym' }),
          makePointFeature(4.7, -74.1, { amenity: 'restaurant' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.walk.lifestyle).toBe(3)
  })

  it('counts a feature just inside the walking radius and excludes one just outside', () => {
    // ~0.45 km north of center
    const inside = makePointFeature(4.6601, -74.056, { amenity: 'restaurant' })
    // ~0.55 km north of center
    const outside = makePointFeature(4.661, -74.056, { amenity: 'restaurant' })
    const data = {
      ...emptyData,
      pois: {
        type: 'FeatureCollection',
        features: [inside, outside],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    expect(result.counts.walk.lifestyle).toBe(1)
  })

  it('scores primary road connectivity with roads within 1.5 km', () => {
    const data = {
      ...emptyData,
      primaryRoads: {
        type: 'FeatureCollection',
        features: [
          makeLineFeature([[-74.057, 4.65], [-74.055, 4.66]], { name: 'Calle 100' }),
          makeLineFeature([[-74.058, 4.655], [-74.056, 4.657]], { name: 'Carrera 15' }),
          makeLineFeature([[-74.059, 4.652], [-74.057, 4.658]], { name: 'Calle 116' }),
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    // 3 unique primary roads -> primaryScore 10; no secondary roads -> secondaryScore 2
    // weighted: round(10 * 0.6 + 2 * 0.4) = round(6.8) = 7
    expect(result.scores.transport).toBe(7)
  })

  it('handles MultiLineString primary roads without crashing', () => {
    const data = {
      ...emptyData,
      primaryRoads: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'MultiLineString',
              coordinates: [
                [[-74.057, 4.65], [-74.055, 4.66]],
                [[-74.058, 4.655], [-74.056, 4.657]],
              ],
            },
            properties: { name: 'Avenida Test' },
          },
        ],
      },
    }
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, data)
    // 1 unique primary road -> primaryScore 4; no secondary roads -> secondaryScore 2
    // weighted: round(4 * 0.6 + 2 * 0.4) = round(3.2) = 3
    expect(result.scores.transport).toBe(3)
  })

  it('returns insights array', () => {
    const result = calculateScores({ lat: 4.656, lng: -74.056 }, emptyData)
    expect(result.insights.length).toBeGreaterThan(0)
    expect(result.insights.some((i) => i.category === 'Conectividad Vial')).toBe(true)
  })
})
