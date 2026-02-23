/**
 * NearbyShops - Find Nearby Secure Print Centers
 * Isolated module - no global state pollution
 * Uses OpenStreetMap Overpass API via backend proxy
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MapPin, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';
import LocationPermissionModal from '../components/LocationPermissionModal';
import LocationToggle from '../components/LocationToggle';
import CitySearchForm from '../components/CitySearchForm';
import ShopCard from '../components/ShopCard';
import MapView from '../components/MapView';
import { API_BASE } from '../config';



// Use correct Haversine formula as requested
function calculateDistance(userLat, userLng, shopLat, shopLng) {
    const R = 6371;
    const dLat = (shopLat - userLat) * Math.PI / 180;
    const dLng = (shopLng - userLng) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(userLat * Math.PI / 180) *
        Math.cos(shopLat * Math.PI / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const NearbyShops = () => {
    const [mode, setMode] = useState('location'); // 'location' or 'city'
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [geoError, setGeoError] = useState(null);
    const [geoLoading, setGeoLoading] = useState(false);
    const [searchedCity, setSearchedCity] = useState(null);
    const [userLocation, setUserLocation] = useState(null); // { lat, lng }
    const [selectedShopId, setSelectedShopId] = useState(null);
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setUserLocation({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                },
                () => {
                    console.log("Location denied or unavailable on load");
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }
    }, []);

    const fetchShopsByLocation = useCallback(async (lat, lng) => {
        setLoading(true);
        setError(null);
        setSearchedCity(null);
        setUserLocation({ lat, lng }); // Store user location for distance calculation
        try {
            const res = await axios.get(`${API_BASE}/api/nearby-shops`, {
                params: { lat, lng, radius: 5000 },
                timeout: 120000 // Increased to 120s to fully allow backend failover retries
            });
            const data = Array.isArray(res.data) ? res.data : [];
            setShops(data);
            if (data.length === 0) {
                setError(null);
            }
        } catch (err) {
            console.error('[NearbyShops] Fetch error:', err);
            let msg = 'Failed to fetch nearby shops.';
            if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout') || err.message?.toLowerCase().includes('aborted') || err.name === 'AbortError') {
                msg = 'The search took too long because the map service is busy. Please try again in a moment.';
            } else if (err.response) {
                if (err.response.status === 503) {
                    msg = 'The map service is currently busy. Please try again in a moment.';
                } else if (err.response.status === 429) {
                    msg = 'Too many requests. Please wait a moment and try again.';
                } else {
                    msg = err.response.data?.error || `Server error: ${err.response.status}`;
                }
            } else if (err.request) {
                msg = 'Unable to reach the server. Please check your connection.';
            } else {
                msg = err.message || 'An unexpected error occurred.';
            }
            setError(msg);
            setShops([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchShopsByCity = useCallback(async (city) => {
        setLoading(true);
        setError(null);
        setSearchedCity(city);
        setPermissionDenied(false);

        // Aggressively attempt to fetch exact GPS coords during the search 
        // in case the initial page load hook was missed or ignored secretly by the browser
        if (navigator.geolocation && !userLocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setUserLocation({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                },
                (err) => {
                    console.log("Could not obtain exact location during city search fallback:", err);
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        }

        try {
            const res = await axios.get(`${API_BASE}/api/shops-by-city`, {
                params: { city, radius: 10000 },
                timeout: 120000 // Increased to 120s to fully allow backend failover retries
            });
            const data = Array.isArray(res.data) ? res.data : [];
            setShops(data);
            if (data.length === 0) {
                setError(null);
            }
        } catch (err) {
            console.error('[NearbyShops] City search error:', err);
            let msg = 'Failed to search shops in this city.';
            if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout') || err.message?.toLowerCase().includes('aborted') || err.name === 'AbortError') {
                msg = 'The search took too long because the map service is busy. Please try again in a moment.';
            } else if (err.response) {
                if (err.response.status === 404) {
                    msg = err.response.data?.error || `City "${city}" not found. Please check the spelling.`;
                } else if (err.response.status === 429) {
                    msg = err.response.data?.error || 'Too many requests. Please wait a moment and try again.';
                } else if (err.response.status === 503) {
                    msg = 'The map service is currently busy. Please try again in a moment.';
                } else {
                    msg = err.response.data?.error || `Server error: ${err.response.status}`;
                }
            } else if (err.request) {
                msg = 'Unable to reach the server. Please check your connection.';
            } else {
                msg = err.message || 'An unexpected error occurred.';
            }
            setError(msg);
            setShops([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleModeChange = useCallback((newMode) => {
        setMode(newMode);
        setError(null);
        setShops([]);
        setSearchedCity(null);
        setPermissionDenied(false);
        hasFetchedRef.current = false;
        if (newMode === 'location') {
            setShowPermissionModal(false);
        }
    }, []);

    const requestLocation = useCallback(() => {
        setShowPermissionModal(true);
        setGeoError(null);
        setGeoLoading(false);
    }, []);

    const handleShopSelect = useCallback((shop) => {
        const id = shop.id || `${shop.lat}-${shop.lng}`;
        setSelectedShopId(id);
    }, []);

    const handleGrant = useCallback(() => {
        setGeoLoading(true);
        setGeoError(null);
        if (!navigator.geolocation) {
            setGeoError('Geolocation is not supported by your browser.');
            setGeoLoading(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGeoLoading(false);
                setShowPermissionModal(false);
                setPermissionDenied(false);
                hasFetchedRef.current = true;
                fetchShopsByLocation(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
                setGeoLoading(false);
                setPermissionDenied(err.code === 1);
                setGeoError(
                    err.code === 1
                        ? 'Location permission denied. You can enable it in your browser settings.'
                        : err.message || 'Failed to get location.'
                );
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }, [fetchShopsByLocation]);

    const handleDeny = useCallback(() => {
        setShowPermissionModal(false);
        setGeoError(null);
        setGeoLoading(false);
    }, []);

    const handleRetry = useCallback(() => {
        setError(null);
        setPermissionDenied(false);
        if (mode === 'location') {
            setShowPermissionModal(true);
            setGeoError(null);
            setGeoLoading(false);
        } else {
            // For city mode, just clear error - user can search again
            setShops([]);
            setSearchedCity(null);
        }
    }, [mode]);

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <MapPin size={48} color="var(--neon-blue)" style={{ marginBottom: '1rem' }} />
                    <h2 className="glow-text" style={{ marginBottom: '0.5rem' }}>
                        Find Nearby Secure Print Centers
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                        {mode === 'location'
                            ? 'Discover print shops, copyshops, and stationery stores within 2km of your location.'
                            : 'Search for print shops, copyshops, and stationery stores in any city.'}
                    </p>
                </div>

                <LocationToggle mode={mode} onModeChange={handleModeChange} disabled={loading} />

                {mode === 'city' && (
                    <CitySearchForm
                        onSearch={fetchShopsByCity}
                        loading={loading}
                        disabled={false}
                    />
                )}

                {mode === 'location' && !hasFetchedRef.current && !permissionDenied && shops.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <button
                            className="neon-border"
                            onClick={requestLocation}
                            style={{
                                background: 'var(--neon-green)',
                                color: '#000',
                                padding: '1rem 2rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                fontSize: '1rem',
                                fontWeight: '600',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            <MapPin size={22} />
                            Find Nearby Secure Print Centers
                        </button>
                    </div>
                )}

                {permissionDenied && !loading && shops.length === 0 && (
                    <div
                        style={{
                            textAlign: 'center',
                            padding: '2rem',
                            background: 'rgba(255,0,85,0.1)',
                            border: '1px solid var(--neon-pink)',
                            borderRadius: '12px',
                            marginBottom: '1rem'
                        }}
                    >
                        <AlertCircle size={32} color="var(--neon-pink)" style={{ marginBottom: '1rem' }} />
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            Location permission was denied. Enable location in your browser to find nearby shops.
                        </p>
                        <button
                            className="neon-border"
                            onClick={handleRetry}
                            style={{
                                background: 'var(--neon-green)',
                                color: '#000',
                                padding: '0.75rem 1.5rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            <RefreshCw size={18} />
                            Try again
                        </button>
                    </div>
                )}

                {loading && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        <div className="loading-spinner" style={{ marginBottom: '1rem', margin: '0 auto' }}></div>
                        <p>Searching for nearby print centers...</p>
                        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>(This may take a few seconds due to high traffic)</p>
                    </div>
                )}

                {error && !loading && (
                    <div
                        style={{
                            padding: '1.5rem',
                            background: 'rgba(255,0,85,0.1)',
                            border: '1px solid var(--neon-pink)',
                            borderRadius: '12px',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}
                    >
                        <AlertCircle size={24} color="var(--neon-pink)" />
                        <div>
                            <p style={{ margin: 0, color: 'var(--neon-pink)' }}>{error}</p>
                            <button
                                className="neon-border"
                                onClick={handleRetry}
                                style={{
                                    marginTop: '0.75rem',
                                    padding: '0.5rem 1rem',
                                    background: 'transparent',
                                    color: 'var(--neon-blue)',
                                    border: '1px solid var(--neon-blue)',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <RefreshCw size={14} />
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                {!loading && shops.length > 0 && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, color: 'white' }}>
                                {shops.length} print center{shops.length !== 1 ? 's' : ''} found
                                {searchedCity && ` in ${searchedCity}`}
                            </h3>
                            {mode === 'city' && !userLocation && (
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.4rem 0.8rem',
                                    background: 'rgba(255, 165, 0, 0.1)',
                                    border: '1px solid rgba(255, 165, 0, 0.3)',
                                    borderRadius: '6px',
                                    color: 'orange',
                                    fontSize: '0.8rem'
                                }}>
                                    <AlertCircle size={14} />
                                    Using approximate location (city center)
                                </div>
                            )}
                        </div>

                        <MapView
                            shops={shops}
                            userLocation={userLocation}
                            selectedShopId={selectedShopId}
                            loading={loading}
                        />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            {shops.map((shop, i) => {
                                // Calculate distance if userLocation is available
                                let dist = shop.distance_km;
                                let distanceType = 'city';

                                if (userLocation && typeof shop.lat === 'number' && typeof shop.lng === 'number') {
                                    const calculatedDist = calculateDistance(
                                        userLocation.lat,
                                        userLocation.lng,
                                        shop.lat,
                                        shop.lng
                                    );
                                    if (calculatedDist !== null && !isNaN(calculatedDist)) {
                                        dist = Math.round(calculatedDist * 100) / 100;
                                        distanceType = 'user';
                                    }
                                }

                                return (
                                    <ShopCard
                                        key={`${shop.lat}-${shop.lng}-${i}`}
                                        shop={{
                                            ...shop,
                                            distance_km: dist,
                                            name: shop.name || "Unnamed Print Shop"
                                        }}
                                        distanceType={distanceType}
                                        onSelect={handleShopSelect}
                                        isSelected={selectedShopId === (shop.id || `${shop.lat}-${shop.lng}`)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {!loading && (hasFetchedRef.current || searchedCity) && shops.length === 0 && !error && (
                    <div
                        style={{
                            textAlign: 'center',
                            padding: '2rem',
                            color: 'var(--text-secondary)',
                            border: '1px dashed var(--glass-border)',
                            borderRadius: '12px'
                        }}
                    >
                        <MapPin size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <p>
                            {mode === 'location'
                                ? 'No print centers found within 2km. The map service may be temporarily unavailable. Try again in a few moments.'
                                : searchedCity
                                    ? `No print centers found in ${searchedCity}. The map service may be temporarily unavailable, or there may be no shops in this area. Try again in a few moments.`
                                    : 'No print centers found. Try searching again.'}
                        </p>
                        <button
                            className="neon-border"
                            onClick={handleRetry}
                            style={{
                                marginTop: '1rem',
                                padding: '0.75rem 1.5rem',
                                background: 'var(--neon-green)',
                                color: '#000',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <RefreshCw size={18} />
                            {mode === 'location' ? 'Search again' : 'Try another city'}
                        </button>
                    </div>
                )}
            </div>

            {showPermissionModal && (
                <LocationPermissionModal
                    onGrant={handleGrant}
                    onDeny={handleDeny}
                    loading={geoLoading}
                    error={geoError}
                />
            )}
        </div>
    );
};

export default NearbyShops;
