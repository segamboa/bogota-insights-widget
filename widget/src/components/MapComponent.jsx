import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { getPoint, distance } from '../utils/scoring';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

const PoiIcon = L.divIcon({
    className: 'poi-marker',
    html: '<span style="display:block;width:10px;height:10px;background:#3b82f6;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></span>',
    iconSize: [10, 10],
    iconAnchor: [5, 5]
});

// Component to handle auto-centering when props change
const RecenterMap = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lng]);
    }, [lat, lng, map]);
    return null;
};

RecenterMap.propTypes = {
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired,
};

const PoiLayer = ({ data, activeTab, center }) => {
    const radius = activeTab === 'walk' ? 0.5 : 3.0;
    if (!data || !data.pois) return null;

    const pois = data.pois.features.filter((f) => {
        const p = getPoint(f);
        if (!p) return false;
        const d = distance(center, p, { units: 'kilometers' });
        return d <= radius;
    });

    return (
        <>
            {pois.map((f, idx) => (
                <Marker
                    key={`poi-${idx}-${f.properties?.name || f.properties?.amenity || idx}`}
                    position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
                    icon={PoiIcon}
                >
                    <Popup>{f.properties?.name || f.properties?.amenity || 'POI'}</Popup>
                </Marker>
            ))}
        </>
    );
};

PoiLayer.propTypes = {
    data: PropTypes.shape({
        pois: PropTypes.shape({
            features: PropTypes.array
        })
    }),
    activeTab: PropTypes.string.isRequired,
    center: PropTypes.object.isRequired
};

const MapComponent = ({ lat, lng, data = null, activeTab = 'walk' }) => {
    const position = [lat, lng];
    const center = { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} };

    return (
        <MapContainer center={position} zoom={14} scrollWheelZoom={false} className="widget-map">
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <RecenterMap lat={lat} lng={lng} />

            <Marker position={position} icon={DefaultIcon}>
                <Popup>Ubicación del inmueble</Popup>
            </Marker>

            {/* Walking Radius (500m) */}
            <Circle
                center={position}
                pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.1, color: '#2563eb', weight: 1, dashArray: '5, 5' }}
                radius={500}
            >
                <Popup>Zona Caminable (500m)</Popup>
            </Circle>

            {/* Driving Radius (3km) */}
            <Circle
                center={position}
                pathOptions={{ fillColor: '#f59e0b', fillOpacity: 0.05, color: '#d97706', weight: 1 }}
                radius={3000}
            >
                <Popup>Zona Vehicular (3km)</Popup>
            </Circle>

            <PoiLayer data={data} activeTab={activeTab} center={center} />
        </MapContainer>
    );
};

MapComponent.propTypes = {
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired,
    data: PropTypes.shape({
        pois: PropTypes.shape({
            features: PropTypes.array
        })
    }),
    activeTab: PropTypes.string
};

export default MapComponent;
