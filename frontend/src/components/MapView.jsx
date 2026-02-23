import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import MarkerLayer from './MarkerLayer';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default icon path issue
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    iconRetinaUrl: iconRetina,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const MapView = ({ shops, userLocation, selectedShopId, loading }) => {
    // Default center (India) or user location
    const isValidLocation = userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number';
    const center = isValidLocation ? [userLocation.lat, userLocation.lng] : [20.5937, 78.9629];
    const zoom = isValidLocation ? 14 : 5;

    return (
        <div style={{
            height: '400px',
            width: '100%',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '2rem',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            position: 'relative',
            zIndex: 1
        }}>
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    borderRadius: '12px'
                }}>
                    <div className="loading-spinner"></div>
                </div>
            )}

            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MarkerLayer
                    shops={shops}
                    userLocation={userLocation}
                    selectedShopId={selectedShopId}
                />
            </MapContainer>
        </div>
    );
};

export default MapView;
