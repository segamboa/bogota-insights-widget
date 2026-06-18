import * as turf from '@turf/turf'

/**
 * Calculate scores based on location and geojson data
 * @param {Object} location - { lat, lng }
 * @param {Object} data - { pois, primaryRoads, secondaryRoads, hospEscEntret, publicTransport }
 */
export const calculateScores = (location, data) => {
    const point = turf.point([location.lng, location.lat]);

    // Define score categories
    const scores = {
        walking: { total: 0, details: {} },
        driving: { total: 0, details: {} },
        transport: 0 // Road connectivity
    };

    // Helper to get a coordinate point regarding of geometry type
    const getPoint = (f) => {
        try {
            if (!f.geometry || !f.geometry.coordinates || f.geometry.coordinates.length === 0) return null;
            if (f.geometry.type === 'Point') {
                return turf.point(f.geometry.coordinates);
            }
            // For Polygons/MultiPolygons, use centroid
            return turf.centroid(f);
        } catch {
            return null;
        }
    };

    const insights = [];

    // --- 1. Road Connectivity (Transport Score) ---
    // Composite Score:
    // A. Primary Roads (Diversity/Exits): 60% weight. Target: 3+ unique avenues.
    // B. Secondary Roads (Permeability): 40% weight. Target: High density of local connections (e.g., > 10 segments in 500m).

    let tScore = 0;

    // A. Primary Road Diversity (1.5km buffer)
    let primaryScore = 0;
    let uniqueRoads = 0;
    if (data.primaryRoads) {
        const roadOptions = new Set();
        data.primaryRoads.features.forEach(f => {
            const line = turf.lineString(f.geometry.coordinates);
            const dist = turf.pointToLineDistance(point, line, { units: 'kilometers' });
            if (dist <= 1.5) {
                const name = f.properties.name || f.properties.ref;
                if (name) roadOptions.add(name);
            }
        });
        uniqueRoads = roadOptions.size;

        if (uniqueRoads >= 3) primaryScore = 10;
        else if (uniqueRoads === 2) primaryScore = 7;
        else if (uniqueRoads === 1) primaryScore = 4;
        else primaryScore = 1;
    }

    // B. Secondary Road Density (1km buffer)
    // Measures "permeability" or local alternatives to main roads
    let secondaryScore = 0;
    let secondaryCount = 0;
    if (data.secondaryRoads) {
        data.secondaryRoads.features.forEach(f => {
            const line = turf.lineString(f.geometry.coordinates);
            const dist = turf.pointToLineDistance(point, line, { units: 'kilometers' });
            if (dist <= 1.0) {
                secondaryCount++;
            }
        });

        // Heuristics for secondary density
        if (secondaryCount >= 40) secondaryScore = 10; // Highly connected mesh
        else if (secondaryCount >= 25) secondaryScore = 8;
        else if (secondaryCount >= 15) secondaryScore = 6;
        else if (secondaryCount >= 5) secondaryScore = 4;
        else secondaryScore = 2;
    }

    // Weighted Total
    tScore = Math.round((primaryScore * 0.6) + (secondaryScore * 0.4));
    scores.transport = tScore;

    insights.push({
        category: 'Conectividad Vial',
        type: 'drive',
        text: `Acceso a ${uniqueRoads} vías arterias y red secundaria (${secondaryCount} tramos) con puntaje ${tScore}/10`
    });

    // --- 2. Amenities Analysis ---

    const walkRadius = 0.5; // km
    const driveRadius = 3.0; // km

    const counts = {
        walk: {
            transport: 0, // bus stops, stations
            education: 0, // schools, kindergartens
            daily: 0,     // supermarkets, pharmacy, banks
            lifestyle: 0  // cafes, restaurants, parks
        },
        drive: {
            health: 0,        // hospitals
            university: 0,    // universities
            entertainment: 0, // cinema, mall, parks, etc
        }
    };

    // --- A. Specialized Data: Public Transport ---
    if (data.publicTransport && data.publicTransport.features) {
        data.publicTransport.features.forEach(f => {
            const fPoint = getPoint(f);
            if (!fPoint) return;

            const distance = turf.distance(point, fPoint, { units: 'kilometers' });
            if (distance <= walkRadius) {
                const props = f.properties;
                // Strict check based on user query
                if (props.highway === 'bus_stop' ||
                    props.public_transport === 'platform' ||
                    props.public_transport === 'stop_position') {
                    counts.walk.transport++;
                }
            }
        });
    }

    // --- B. Specialized Data: Hospitals, Schools, Entertainment ---
    // Using hospEscEntret which consolidates these
    if (data.hospEscEntret && data.hospEscEntret.features) {
        data.hospEscEntret.features.forEach(f => {
            const fPoint = getPoint(f);
            if (!fPoint) return;

            const distance = turf.distance(point, fPoint, { units: 'kilometers' });
            const props = f.properties;
            const amenity = props.amenity || '';
            const shop = props.shop || '';
            const leisure = props.leisure || '';

            // Walk: Education (Schools, Libraries)
            if (distance <= walkRadius) {
                if (['school', 'library', 'kindergarten'].includes(amenity)) { // Added library as per query
                    counts.walk.education++;
                }
            }

            // Drive: Health, University, Entertainment
            if (distance <= driveRadius) {
                // Health: Hospital only
                if (amenity === 'hospital') {
                    counts.drive.health++;
                }

                // University
                if (amenity === 'university') {
                    counts.drive.university++;
                }

                // Entertainment (Strict Match from Query)
                // Amenities
                if (['cinema', 'theatre', 'nightclub', 'arts_centre', 'planetarium'].includes(amenity)) {
                    counts.drive.entertainment++;
                }
                // Shops
                if (shop === 'mall') {
                    counts.drive.entertainment++;
                }
                // Leisure
                if (['park', 'stadium', 'water_park', 'amusement_arcade', 'dance'].includes(leisure)) {
                    counts.drive.entertainment++;
                }
            }
        });
    }

    // --- C. Generic POIs (Amenities for Daily/Lifestyle) ---
    // Fallback for restaurants, daily needs which are NOT in the specialized file
    if (data.pois && data.pois.features) {
        data.pois.features.forEach(f => {
            const fPoint = getPoint(f);
            if (!fPoint) return;

            const distance = turf.distance(point, fPoint, { units: 'kilometers' });
            const props = f.properties;
            const amenity = props.amenity || '';
            const shop = props.shop || '';
            const leisure = props.leisure || '';

            // WALKING ZONE (< 500m) - Daily & Lifestyle
            if (distance <= walkRadius) {
                // --- Daily Needs (Groceries, Services, Financial) ---

                // Groceries (high impact)
                if (['supermarket', 'convenience', 'greengrocer', 'butcher', 'seafood', 'deli', 'bakery'].includes(shop) ||
                    ['bakery'].includes(amenity)) { // bakery can be shop or amenity
                    counts.walk.daily++;
                }

                // Services / Personal / Health retail
                if (['pharmacy', 'bank', 'atm', 'post_office', 'bicycle_repair_station'].includes(amenity) ||
                    ['medical_supply', 'hairdresser', 'beauty', 'laundry', 'tailor'].includes(shop)) {
                    counts.walk.daily++;
                }

                // Retail (General)
                if (['clothes', 'shoes', 'electronics', 'hardware', 'stationery', 'books'].includes(shop)) {
                    counts.walk.daily++; // Retail contributes to daily/convenience score
                }

                // --- Lifestyle (Food, Drink, Recreation) ---

                // Food & Drink
                if (['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream', 'biergarten', 'food_court'].includes(amenity)) {
                    counts.walk.lifestyle++;
                }

                // Recreation/Fitness (Small scale)
                if (['gym', 'dojo', 'dance'].includes(amenity) ||
                    ['fitness_centre', 'pitch', 'sports_centre', 'playground'].includes(leisure)) {
                    counts.walk.lifestyle++;
                }
            }
        });
    }

    // --- Calculate Walking Scores ---
    // Heuristics (Stricter for Bogota density):
    // Transport: 15+ stops for 10/10 (High density SITP)
    scores.walking.details.transport = Math.min(10, Math.floor(counts.walk.transport * 0.7));

    // Education: 5+ schools/kindergartens for 10/10
    scores.walking.details.education = Math.min(10, counts.walk.education * 2);

    // Daily: 15+ shops/services for 10/10
    scores.walking.details.daily = Math.min(10, Math.floor(counts.walk.daily * 0.7));

    // Lifestyle: 20+ restaurants/parks for 10/10
    scores.walking.details.lifestyle = Math.min(10, Math.floor(counts.walk.lifestyle * 0.5));

    // Average Walking Score (Weighted? For now simple average)
    const walkValues = Object.values(scores.walking.details);
    scores.walking.total = Math.round(walkValues.reduce((a, b) => a + b, 0) / walkValues.length);


    // --- Calculate Driving Scores ---
    // Health: 5+ major hospitals for 10/10
    scores.driving.details.health = Math.min(10, counts.drive.health * 2);

    // University: 4+ universities for 10/10 (University Zone)
    scores.driving.details.university = Math.min(10, Math.floor(counts.drive.university * 2.5));

    // Entertainment: 15+ places (Malls, Cinemas, Parks) for 10/10
    scores.driving.details.entertainment = Math.min(10, Math.floor(counts.drive.entertainment * 0.7));

    // Average Driving Score
    const driveValues = Object.values(scores.driving.details);
    scores.driving.total = Math.round(driveValues.reduce((a, b) => a + b, 0) / driveValues.length);

    // --- Generate Insights ---
    if (counts.walk.transport > 0) insights.push({ category: 'Transporte', type: 'walk', text: `${counts.walk.transport} paradas de SITP/Zonal cercanas` });
    else insights.push({ category: 'Transporte', type: 'walk', text: `Sin paradas de bus detectadas inmediatamente` });

    if (counts.walk.education > 0) insights.push({ category: 'Educación', type: 'walk', text: `${counts.walk.education} colegios/bibliotecas caminando` });
    if (counts.walk.daily > 0) insights.push({ category: 'Necesidades', type: 'walk', text: `${counts.walk.daily} comercios cotidianos cerca` });
    if (counts.walk.lifestyle > 0) insights.push({ category: 'Estilo de vida', type: 'walk', text: `${counts.walk.lifestyle} restaurantes/sitios cerca` });

    if (counts.drive.health > 0) insights.push({ category: 'Salud', type: 'drive', text: `${counts.drive.health} hospitales a < 3km` });
    if (counts.drive.university > 0) insights.push({ category: 'Universidades', type: 'drive', text: `${counts.drive.university} universidades en la zona` });
    if (counts.drive.entertainment > 0) insights.push({ category: 'Entretenimiento', type: 'drive', text: `${counts.drive.entertainment} sitios de cultura/ocio/CC` });

    return { scores, insights, counts };
}
