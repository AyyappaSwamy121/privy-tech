/**
 * ShopCard - Displays a single print shop with Open in Maps action
 */

import React from 'react';
import { MapPin, ExternalLink } from 'lucide-react';

const ShopCard = ({ shop, onSelect, isSelected, distanceType }) => {
    const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`;

    return (
        <div
            onClick={() => onSelect && onSelect(shop)}
            style={{
                background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.03)',
                border: isSelected ? '1px solid var(--neon-blue)' : '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? '0 0 15px rgba(59, 130, 246, 0.3)' : 'none'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <MapPin size={18} color={isSelected ? "var(--neon-green)" : "var(--neon-blue)"} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                    <h4 style={{ margin: 0, color: 'white', fontSize: '1rem' }}>{shop.name}</h4>
                    <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {shop.address}
                    </p>
                </div>
            </div>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {shop.distance_km != null ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ color: 'var(--neon-green)', fontSize: '0.9rem', fontWeight: '600' }}>
                            {shop.distance_km < 0.1 ? "Nearby" : `${Number(shop.distance_km).toFixed(2)} km`} away
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            {distanceType === 'user' ? 'Distance from your location' : 'Distance from city center'}
                        </span>
                    </div>
                ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}></span>
                )}
                <a
                    href={mapsDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        background: 'var(--neon-blue)',
                        color: '#000',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                    }}
                >
                    <ExternalLink size={14} />
                    Open in Maps
                </a>
            </div>
        </div>
    );
};

export default ShopCard;
