/**
 * LocationPermissionModal - Asks user for geolocation permission
 * Isolated component - no global state
 */

import React from 'react';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

const LocationPermissionModal = ({ onGrant, onDeny, loading, error }) => {
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }}
        >
            <div
                className="glass-panel"
                style={{
                    padding: '2rem',
                    maxWidth: '400px',
                    textAlign: 'center',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px'
                }}
            >
                <MapPin size={48} color="var(--neon-blue)" style={{ marginBottom: '1rem' }} />
                <h3 style={{ marginBottom: '0.5rem', color: 'white' }}>
                    Find Nearby Print Centers
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    We need your location to show print shops near you. Your location is not stored.
                </p>
                {error && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: 'var(--neon-pink)',
                            marginBottom: '1rem',
                            fontSize: '0.9rem'
                        }}
                    >
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        className="neon-border"
                        onClick={onGrant}
                        disabled={loading}
                        style={{
                            background: 'var(--neon-green)',
                            color: '#000',
                            padding: '0.75rem 1.5rem',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            margin: '0 auto'
                        }}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="spinner" />
                                Getting location...
                            </>
                        ) : (
                            <>
                                <MapPin size={18} />
                                Allow location
                            </>
                        )}
                    </button>
                    <button
                        className="neon-border"
                        onClick={onDeny}
                        disabled={loading}
                        style={{
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            padding: '0.75rem 1.5rem',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LocationPermissionModal;
