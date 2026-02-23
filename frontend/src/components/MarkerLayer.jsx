import React, { useEffect, useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

const MarkerLayer = ({ shops, userLocation, selectedShopId }) => {
    const map = useMap();
    const lastShopsRef = useRef(null);

    // Filter valid shops once
    const validShops = shops.filter(s => s && typeof s.lat === 'number' && typeof s.lng === 'number');

    useEffect(() => {
        if (validShops.length === 0) return;

        // Simple check to see if shops changed (by ID or length)
        const currentShopsKey = validShops.map(s => s.id || `${s.lat}-${s.lng}`).join('|');
        if (lastShopsRef.current === currentShopsKey) return;

        lastShopsRef.current = currentShopsKey;

        const bounds = L.latLngBounds();

        // Add user location if available
        if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number') {
            bounds.extend([userLocation.lat, userLocation.lng]);
        }

        // Add all valid shops to bounds
        validShops.forEach(shop => {
            bounds.extend([shop.lat, shop.lng]);
        });

        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    }, [map, validShops, userLocation]);

    useEffect(() => {
        if (selectedShopId) {
            const selectedShop = validShops.find(s => s.id === selectedShopId || `${s.lat}-${s.lng}` === selectedShopId);
            if (selectedShop) {
                map.setView([selectedShop.lat, selectedShop.lng], 16, { animate: true });
            }
        }
    }, [map, selectedShopId, validShops]);

    return (
        <>
            {/* User Location Marker */}
            {userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number' && (
                <Marker
                    position={[userLocation.lat, userLocation.lng]}
                    icon={L.divIcon({
                        className: 'user-location-marker',
                        html: `<div style="background-color: #3b82f6; width: 15px; height: 15px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
                        iconSize: [15, 15],
                        iconAnchor: [7.5, 7.5]
                    })}
                >
                    <Popup>Your Location</Popup>
                </Marker>
            )}

            {/* Shop Markers */}
            {validShops.map((shop, i) => {
                const shopId = shop.id || `${shop.lat}-${shop.lng}`;
                const isSelected = selectedShopId === shopId || selectedShopId === `${shop.lat}-${shop.lng}`;

                const mapsLink = `https://www.google.com/maps?q=${shop.lat},${shop.lng}`;

                return (
                    <Marker
                        key={`${shopId}-${i}`}
                        position={[shop.lat, shop.lng]}
                        icon={L.divIcon({
                            className: 'shop-marker',
                            html: `<div style="background-color: ${isSelected ? '#10b981' : '#ff0055'}; width: 20px; height: 20px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
                            iconSize: [20, 20],
                            iconAnchor: [10, 20]
                        })}
                    >
                        <Popup>
                            <div style={{ color: '#333', minWidth: '150px' }}>
                                <b style={{ fontSize: '1.1rem' }}>{shop.name || 'Unnamed Shop'}</b><br />
                                <span style={{ color: '#666' }}>{shop.distance_km || '?'} km away</span><br />
                                <div style={{ marginTop: '8px' }}>
                                    <a
                                        href={mapsLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            color: '#3b82f6',
                                            textDecoration: 'none',
                                            fontWeight: 'bold',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        Open in Maps
                                    </a>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </>
    );
};

export default MarkerLayer;
