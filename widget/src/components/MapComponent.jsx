import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

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

const MapComponent = ({ lat, lng }) => {
    const position = [lat, lng];

    return (
        <MapContainer center={position} zoom={14} scrollWheelZoom={false} className="widget-map">
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <RecenterMap lat={lat} lng={lng} />

            <Marker position={position}>
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
                eventHandlers={{ click: () => { } }} // Propagate events check
            >
                <Popup>Zona Vehicular (3km)</Popup>
            </Circle>
        </MapContainer>
    );
};

MapComponent.propTypes = {
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired,
};

export default MapComponent;
