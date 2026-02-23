/**
 * LocationToggle - Toggle between "Use My Location" and "Search by City"
 */

import React from 'react';
import { MapPin, Search } from 'lucide-react';

const LocationToggle = ({ mode, onModeChange, disabled }) => {
    return (
        <div
            style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                background: 'rgba(255,255,255,0.03)',
                padding: '0.5rem',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)'
            }}
        >
            <button
                type="button"
                onClick={() => onModeChange('location')}
                disabled={disabled}
                style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    background: mode === 'location' ? 'var(--neon-blue)' : 'transparent',
                    color: mode === 'location' ? '#000' : 'var(--text-secondary)',
                    border: mode === 'location' ? 'none' : '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    fontWeight: mode === 'location' ? '600' : '400',
                    opacity: disabled ? 0.5 : 1,
                    transition: 'all 0.2s ease'
                }}
            >
                <MapPin size={18} />
                Use My Location
            </button>
            <button
                type="button"
                onClick={() => onModeChange('city')}
                disabled={disabled}
                style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    background: mode === 'city' ? 'var(--neon-blue)' : 'transparent',
                    color: mode === 'city' ? '#000' : 'var(--text-secondary)',
                    border: mode === 'city' ? 'none' : '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    fontWeight: mode === 'city' ? '600' : '400',
                    opacity: disabled ? 0.5 : 1,
                    transition: 'all 0.2s ease'
                }}
            >
                <Search size={18} />
                Search by City
            </button>
        </div>
    );
};

export default LocationToggle;
