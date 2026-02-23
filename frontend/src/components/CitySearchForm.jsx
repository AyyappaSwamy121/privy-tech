/**
 * CitySearchForm - City search input with debouncing
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';

const CitySearchForm = ({ onSearch, loading, disabled }) => {
    const [city, setCity] = useState('');
    const [debouncedCity, setDebouncedCity] = useState('');
    const debounceTimerRef = useRef(null);

    // Debounce city input (500ms)
    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            setDebouncedCity(city.trim());
        }, 500);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [city]);

    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        const trimmedCity = city.trim();
        if (trimmedCity.length >= 2 && !loading && !disabled) {
            onSearch(trimmedCity);
        }
    }, [city, onSearch, loading, disabled]);

    const isValid = city.trim().length >= 2 && city.trim().length <= 100;

    return (
        <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                <div style={{ position: 'relative' }}>
                    <Search
                        size={20}
                        color="var(--text-secondary)"
                        style={{
                            position: 'absolute',
                            left: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none'
                        }}
                    />
                    <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Enter city name (e.g., Vijayawada)"
                        disabled={disabled || loading}
                        style={{
                            width: '100%',
                            padding: '0.875rem 1rem 0.875rem 3rem',
                            background: 'rgba(255,255,255,0.05)',
                            border: `1px solid ${isValid ? 'var(--glass-border)' : 'var(--neon-pink)'}`,
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '1rem',
                            outline: 'none',
                            transition: 'all 0.2s ease',
                            opacity: disabled || loading ? 0.6 : 1,
                            cursor: disabled || loading ? 'not-allowed' : 'text'
                        }}
                        maxLength={100}
                    />
                </div>
                {city.trim().length > 0 && city.trim().length < 2 && (
                    <p style={{ margin: 0, color: 'var(--neon-pink)', fontSize: '0.85rem', paddingLeft: '0.5rem' }}>
                        City name must be at least 2 characters
                    </p>
                )}
                <button
                    type="submit"
                    disabled={!isValid || loading || disabled}
                    style={{
                        width: '100%',
                        padding: '0.875rem 1.5rem',
                        background: isValid && !loading && !disabled ? 'var(--neon-green)' : 'rgba(255,255,255,0.1)',
                        color: isValid && !loading && !disabled ? '#000' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: isValid && !loading && !disabled ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        opacity: isValid && !loading && !disabled ? 1 : 0.5,
                        transition: 'all 0.2s ease'
                    }}
                >
                    {loading ? (
                        <>
                            <Loader2 size={18} className="spinner" />
                            Searching...
                        </>
                    ) : (
                        <>
                            <Search size={18} />
                            Search Shops
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

export default CitySearchForm;
