import { point, lineString } from '@turf/helpers'
import distance from '@turf/distance'
import centroid from '@turf/centroid'
import pointToLineDistance from '@turf/point-to-line-distance'

// --- Constants ---
const WALK_RADIUS_KM = 0.5
const DRIVE_RADIUS_KM = 3.0
const PRIMARY_ROAD_RADIUS_KM = 1.5
const SECONDARY_ROAD_RADIUS_KM = 1.0

const WALKING_CATEGORIES = {
  transport: { multiplier: 0.7, targetFor10: 15 },
  education: { multiplier: 2, targetFor10: 5 },
  daily: { multiplier: 0.7, targetFor10: 15 },
  lifestyle: { multiplier: 0.5, targetFor10: 20 },
}

const DRIVING_CATEGORIES = {
  health: { multiplier: 2, targetFor10: 5 },
  university: { multiplier: 2.5, targetFor10: 4 },
  entertainment: { multiplier: 0.7, targetFor10: 15 },
}

const HIGHWAY_BUS_STOP = 'bus_stop'
const PUBLIC_TRANSPORT_PLATFORM = 'platform'
const PUBLIC_TRANSPORT_STOP_POSITION = 'stop_position'
const EDUCATION_MATCHES = ['school', 'library', 'kindergarten']
const HEALTH_MATCHES = ['hospital', 'clinic', 'doctors']
const UNIVERSITY_MATCHES = ['university', 'college']
const ENTERTAINMENT_AMENITY_MATCHES = ['cinema', 'theatre', 'nightclub', 'arts_centre', 'planetarium', 'casino']
const ENTERTAINMENT_SHOP_MATCHES = ['mall', 'department_store']
const ENTERTAINMENT_LEISURE_MATCHES = ['park', 'stadium', 'water_park', 'amusement_arcade', 'dance']

const DAILY_SHOP_MATCHES = ['supermarket', 'convenience', 'greengrocer', 'butcher', 'seafood', 'deli', 'bakery']
const DAILY_AMENITY_MATCHES = ['bakery', 'pharmacy', 'bank', 'atm', 'post_office', 'bicycle_repair_station']
const DAILY_SERVICE_SHOP_MATCHES = ['medical_supply', 'hairdresser', 'beauty', 'laundry', 'tailor']
const DAILY_RETAIL_SHOP_MATCHES = ['clothes', 'shoes', 'electronics', 'hardware', 'stationery', 'books']

const LIFESTYLE_FOOD_AMENITY_MATCHES = ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream', 'biergarten', 'food_court']
const LIFESTYLE_FITNESS_AMENITY_MATCHES = ['gym', 'dojo', 'dance']
const LIFESTYLE_FITNESS_LEISURE_MATCHES = ['fitness_centre', 'pitch', 'sports_centre', 'playground']

// --- Helpers ---

/**
 * Get a coordinate point regardless of geometry type.
 * @param {Object} f - GeoJSON feature
 * @returns {Object|null} - Turf point feature or null
 */
export const getPoint = (f) => {
  try {
    if (!f.geometry || !f.geometry.coordinates || f.geometry.coordinates.length === 0) return null
    if (f.geometry.type === 'Point') {
      return point(f.geometry.coordinates)
    }
    // For Polygons/MultiPolygons, use centroid
    return centroid(f)
  } catch {
    return null
  }
}

const getLineDistance = (center, feature) => {
  try {
    const { type, coordinates } = feature.geometry
    if (type === 'LineString') {
      return pointToLineDistance(center, lineString(coordinates), { units: 'kilometers' })
    }
    if (type === 'MultiLineString') {
      // Use the minimum distance across all line segments
      return Math.min(
        ...coordinates.map((lineCoords) =>
          pointToLineDistance(center, lineString(lineCoords), { units: 'kilometers' })
        )
      )
    }
    return Infinity
  } catch {
    return Infinity
  }
}

const calculatePrimaryRoadScore = (center, primaryRoads) => {
  if (!primaryRoads || !primaryRoads.features) return { score: 0, uniqueRoads: 0 }

  const roadOptions = new Set()
  primaryRoads.features.forEach((f) => {
    const dist = getLineDistance(center, f)
    if (dist <= PRIMARY_ROAD_RADIUS_KM) {
      const name = f.properties?.name || f.properties?.ref
      if (name) roadOptions.add(name)
    }
  })

  const uniqueRoads = roadOptions.size
  let score = 1
  if (uniqueRoads >= 3) score = 10
  else if (uniqueRoads === 2) score = 7
  else if (uniqueRoads === 1) score = 4

  return { score, uniqueRoads }
}

const calculateSecondaryRoadScore = (center, secondaryRoads) => {
  if (!secondaryRoads || !secondaryRoads.features) return { score: 0, count: 0 }

  let count = 0
  secondaryRoads.features.forEach((f) => {
    const dist = getLineDistance(center, f)
    if (dist <= SECONDARY_ROAD_RADIUS_KM) {
      count++
    }
  })

  let score = 2
  if (count >= 40) score = 10
  else if (count >= 25) score = 8
  else if (count >= 15) score = 6
  else if (count >= 5) score = 4

  return { score, count }
}

const calculateTransportScore = (center, data) => {
  const primary = calculatePrimaryRoadScore(center, data.primaryRoads)
  const secondary = calculateSecondaryRoadScore(center, data.secondaryRoads)
  const total = Math.round(primary.score * 0.6 + secondary.score * 0.4)

  return {
    score: total,
    uniqueRoads: primary.uniqueRoads,
    secondaryCount: secondary.count,
  }
}

const countPublicTransport = (center, publicTransport) => {
  if (!publicTransport || !publicTransport.features) return 0

  let count = 0
  publicTransport.features.forEach((f) => {
    const fPoint = getPoint(f)
    if (!fPoint) return

    const dist = distance(center, fPoint, { units: 'kilometers' })
    if (dist > WALK_RADIUS_KM) return

    const props = f.properties || {}
    const publicTransportValue = props.public_transport || ''
    const highwayValue = props.highway || ''

    if (
      highwayValue === HIGHWAY_BUS_STOP ||
      publicTransportValue === PUBLIC_TRANSPORT_PLATFORM ||
      publicTransportValue === PUBLIC_TRANSPORT_STOP_POSITION
    ) {
      count++
    }
  })

  return count
}

const countHospEscEntret = (center, hospEscEntret) => {
  if (!hospEscEntret || !hospEscEntret.features) {
    return { education: 0, health: 0, university: 0, entertainment: 0 }
  }

  const counts = { education: 0, health: 0, university: 0, entertainment: 0 }

  hospEscEntret.features.forEach((f) => {
    const fPoint = getPoint(f)
    if (!fPoint) return

    const dist = distance(center, fPoint, { units: 'kilometers' })
    const props = f.properties || {}
    const amenity = props.amenity || ''
    const shop = props.shop || ''
    const leisure = props.leisure || ''

    if (dist <= WALK_RADIUS_KM && EDUCATION_MATCHES.includes(amenity)) {
      counts.education++
    }

    if (dist <= DRIVE_RADIUS_KM) {
      if (HEALTH_MATCHES.includes(amenity)) counts.health++
      if (UNIVERSITY_MATCHES.includes(amenity)) counts.university++
      if (ENTERTAINMENT_AMENITY_MATCHES.includes(amenity)) counts.entertainment++
      if (ENTERTAINMENT_SHOP_MATCHES.includes(shop)) counts.entertainment++
      if (ENTERTAINMENT_LEISURE_MATCHES.includes(leisure)) counts.entertainment++
    }
  })

  return counts
}

const countGenericPois = (center, pois) => {
  if (!pois || !pois.features) return { daily: 0, lifestyle: 0 }

  const counts = { daily: 0, lifestyle: 0 }

  pois.features.forEach((f) => {
    const fPoint = getPoint(f)
    if (!fPoint) return

    const dist = distance(center, fPoint, { units: 'kilometers' })
    if (dist > WALK_RADIUS_KM) return

    const props = f.properties || {}
    const amenity = props.amenity || ''
    const shop = props.shop || ''
    const leisure = props.leisure || ''

    if (
      DAILY_SHOP_MATCHES.includes(shop) ||
      DAILY_AMENITY_MATCHES.includes(amenity) ||
      DAILY_SERVICE_SHOP_MATCHES.includes(shop) ||
      DAILY_RETAIL_SHOP_MATCHES.includes(shop)
    ) {
      counts.daily++
    }

    if (
      LIFESTYLE_FOOD_AMENITY_MATCHES.includes(amenity) ||
      LIFESTYLE_FITNESS_AMENITY_MATCHES.includes(amenity) ||
      LIFESTYLE_FITNESS_LEISURE_MATCHES.includes(leisure)
    ) {
      counts.lifestyle++
    }
  })

  return counts
}

const countAmenities = (center, data) => ({
  walk: {
    transport: countPublicTransport(center, data.publicTransport),
    education: countHospEscEntret(center, data.hospEscEntret).education,
    daily: countGenericPois(center, data.pois).daily,
    lifestyle: countGenericPois(center, data.pois).lifestyle,
  },
  drive: {
    health: countHospEscEntret(center, data.hospEscEntret).health,
    university: countHospEscEntret(center, data.hospEscEntret).university,
    entertainment: countHospEscEntret(center, data.hospEscEntret).entertainment,
  },
})

const calculateCategoryScore = (count, { multiplier }) =>
  Math.min(10, Math.floor(count * multiplier))

const calculateWalkingScore = (counts) => {
  const details = {
    transport: calculateCategoryScore(counts.walk.transport, WALKING_CATEGORIES.transport),
    education: calculateCategoryScore(counts.walk.education, WALKING_CATEGORIES.education),
    daily: calculateCategoryScore(counts.walk.daily, WALKING_CATEGORIES.daily),
    lifestyle: calculateCategoryScore(counts.walk.lifestyle, WALKING_CATEGORIES.lifestyle),
  }

  const values = Object.values(details)
  const total = Math.round(values.reduce((a, b) => a + b, 0) / values.length)

  return { total, details }
}

const calculateDrivingScore = (counts) => {
  const details = {
    health: calculateCategoryScore(counts.drive.health, DRIVING_CATEGORIES.health),
    university: calculateCategoryScore(counts.drive.university, DRIVING_CATEGORIES.university),
    entertainment: calculateCategoryScore(counts.drive.entertainment, DRIVING_CATEGORIES.entertainment),
  }

  const values = Object.values(details)
  const total = Math.round(values.reduce((a, b) => a + b, 0) / values.length)

  return { total, details }
}

const buildInsights = (counts, transportInfo) => {
  const insights = [
    {
      category: 'Conectividad Vial',
      type: 'drive',
      text: `Acceso a ${transportInfo.uniqueRoads} vías arterias y red secundaria (${transportInfo.secondaryCount} tramos) con puntaje ${transportInfo.score}/10`,
    },
  ]

  if (counts.walk.transport > 0) {
    insights.push({
      category: 'Transporte',
      type: 'walk',
      text: `${counts.walk.transport} paradas de SITP/Zonal cercanas`,
    })
  } else {
    insights.push({
      category: 'Transporte',
      type: 'walk',
      text: 'Sin paradas de bus detectadas inmediatamente',
    })
  }

  if (counts.walk.education > 0) {
    insights.push({
      category: 'Educación',
      type: 'walk',
      text: `${counts.walk.education} colegios/bibliotecas caminando`,
    })
  }

  if (counts.walk.daily > 0) {
    insights.push({
      category: 'Necesidades',
      type: 'walk',
      text: `${counts.walk.daily} comercios cotidianos cerca`,
    })
  }

  if (counts.walk.lifestyle > 0) {
    insights.push({
      category: 'Estilo de vida',
      type: 'walk',
      text: `${counts.walk.lifestyle} restaurantes/sitios cerca`,
    })
  }

  if (counts.drive.health > 0) {
    insights.push({
      category: 'Salud',
      type: 'drive',
      text: `${counts.drive.health} hospitales a < 3km`,
    })
  }

  if (counts.drive.university > 0) {
    insights.push({
      category: 'Universidades',
      type: 'drive',
      text: `${counts.drive.university} universidades en la zona`,
    })
  }

  if (counts.drive.entertainment > 0) {
    insights.push({
      category: 'Entretenimiento',
      type: 'drive',
      text: `${counts.drive.entertainment} sitios de cultura/ocio/CC`,
    })
  }

  return insights
}

// --- Public API ---

/**
 * Calculate scores based on location and geojson data
 * @param {Object} location - { lat, lng }
 * @param {Object} data - { pois, primaryRoads, secondaryRoads, hospEscEntret, publicTransport }
 */
export const calculateScores = (location, data) => {
  const center = point([location.lng, location.lat])

  const transportInfo = calculateTransportScore(center, data)
  const counts = countAmenities(center, data)
  const walking = calculateWalkingScore(counts)
  const driving = calculateDrivingScore(counts)

  const scores = {
    walking,
    driving,
    transport: transportInfo.score,
  }

  const insights = buildInsights(counts, transportInfo)

  return { scores, insights, counts }
}
