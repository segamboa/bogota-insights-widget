import fs from 'fs';
import * as turf from '@turf/turf';

// Mock the getPoint helper
const getPoint = (f) => {
    try {
        if (!f.geometry || !f.geometry.coordinates || f.geometry.coordinates.length === 0) return null;
        if (f.geometry.type === 'Point') {
            return turf.point(f.geometry.coordinates);
        }
        return turf.centroid(f);
    } catch (e) {
        return null;
    }
};

const runDebug = () => {
    console.log("Loading data...");
    const pois = JSON.parse(fs.readFileSync('widget/public/data/pois.geojson', 'utf8'));
    const hospitalsSchools = JSON.parse(fs.readFileSync('widget/public/data/hospitales_escuelas.geojson', 'utf8'));

    // Test Location (from App.jsx)
    // lat: 4.656, lng: -74.056 (Near Virrey/Andino)
    const point = turf.point([-74.056, 4.656]);
    const driveRadius = 4.0; // km

    const matches = {
        health: [],
        university: [],
        entertainment: []
    };

    console.log("Analyzing Health and Universities in hospitals_escuelas...");
    if (hospitalsSchools && hospitalsSchools.features) {
        hospitalsSchools.features.forEach(f => {
            const fPoint = getPoint(f);
            if (!fPoint) return;

            const distance = turf.distance(point, fPoint, { units: 'kilometers' });
            const props = f.properties;
            const amenity = props.amenity || '';
            const name = props.name || 'Unknown';

            if (distance <= driveRadius) {
                if (['hospital', 'clinic', 'doctors'].includes(amenity)) {
                    matches.health.push(`${name} (${amenity})`);
                }
                if (['university', 'college'].includes(amenity)) {
                    matches.university.push(`${name} (${amenity})`);
                }
            }
        });
    }

    console.log("Analyzing Entertainment in pois...");
    if (pois && pois.features) {
        pois.features.forEach(f => {
            const fPoint = getPoint(f);
            if (!fPoint) return;

            const distance = turf.distance(point, fPoint, { units: 'kilometers' });
            const props = f.properties;
            const amenity = props.amenity || '';
            const shop = props.shop || '';

            if (distance <= driveRadius) {
                if (['cinema', 'theatre', 'casino', 'nightclub'].includes(amenity) ||
                    ['mall', 'department_store'].includes(shop)) {
                    matches.entertainment.push(`${name} (${amenity || shop})`);
                }
            }
        });
    }

    console.log("\n--- RESULTS ---");
    console.log(`Health Count: ${matches.health.length}`);
    console.log("Sample Health:", matches.health.slice(0, 10));

    console.log(`\nUniversity Count: ${matches.university.length}`);
    console.log("Sample University:", matches.university.slice(0, 10));

    console.log(`\nEntertainment Count: ${matches.entertainment.length}`);
    console.log("Sample Entertainment:", matches.entertainment.slice(0, 10));
};

runDebug();
