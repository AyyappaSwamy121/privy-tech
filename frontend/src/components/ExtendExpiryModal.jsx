import React, { useState } from 'react';
import { X, Clock, Loader2 } from 'lucide-react';
import axios from 'axios';

const ExtendExpiryModal = ({ isOpen, onClose, code, currentExpiresAt, onSuccess }) => {
    const [extensionType, setExtensionType] = useState('preset');
    const [presetMinutes, setPresetMinutes] = useState(5);
    const [customMinutes, setCustomMinutes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleExtend = async () => {
        setError('');
        
        // Ensure we have a valid number
        let extensionMinutes;
        if (extensionType === 'preset') {
            extensionMinutes = presetMinutes;
        } else {
            const parsed = parseInt(customMinutes, 10);
            if (!customMinutes || isNaN(parsed) || parsed <= 0) {
                setError('Please enter a valid number of minutes');
                return;
            }
            if (parsed > 120) {
                setError('Extension cannot exceed 120 minutes');
                return;
            }
            extensionMinutes = parsed;
        }

        // Ensure extensionMinutes is a number
        extensionMinutes = Number(extensionMinutes);
        if (isNaN(extensionMinutes) || extensionMinutes <= 0) {
            setError('Invalid extension time');
            return;
        }

        // Check if document is still active
        const now = new Date();
        const expiresAt = new Date(currentExpiresAt);
        if (isNaN(expiresAt.getTime())) {
            setError('Invalid expiry date');
            return;
        }
        
        if (now >= expiresAt) {
            setError('Document has expired. Cannot extend.');
            setTimeout(() => {
                onClose();
                window.location.reload();
            }, 2000);
            return;
        }

        setLoading(true);
        try {
            // Try PATCH first, fallback to POST if needed
            const response = await axios({
                method: 'PATCH',
                url: `http://localhost:5000/api/document/extend/${code}`,
                data: {
                    extensionMinutes: extensionMinutes
                },
                headers: {
                    'Content-Type': 'application/json'
                }
            }).catch(async (err) => {
                // If PATCH fails with 404, try POST
                if (err.response?.status === 404) {
                    console.log('PATCH not supported, trying POST...');
                    return await axios.post(`http://localhost:5000/api/document/extend/${code}`, {
                        extensionMinutes: extensionMinutes
                    }, {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                }
                throw err;
            });

            if (response.data && response.data.success) {
                // Call success callback with new expiry time
                onSuccess(response.data.expiresAt);
                onClose();
            } else {
                setError(response.data?.error || 'Failed to extend expiry');
            }
        } catch (err) {
            console.error('Extend expiry error:', err);
            const errorMessage = err.response?.data?.error || err.message || 'Failed to extend expiry. Please try again.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(4px)'
            }}
            onClick={handleBackdropClick}
        >
            <div
                className="glass-panel"
                style={{
                    padding: '2rem',
                    maxWidth: '500px',
                    width: '90%',
                    position: 'relative',
                    border: '1px solid var(--glass-border)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--neon-pink)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                    <X size={20} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <Clock size={24} color="var(--neon-blue)" />
                    <h2 style={{ margin: 0, color: 'var(--neon-blue)' }}>Extend Expiry Time</h2>
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Select how long you want to extend the document expiry time.
                </p>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                            <input
                                type="radio"
                                name="extensionType"
                                checked={extensionType === 'preset'}
                                onChange={() => {
                                    setExtensionType('preset');
                                    setError('');
                                }}
                                style={{ accentColor: 'var(--neon-blue)' }}
                            />
                            Preset
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                            <input
                                type="radio"
                                name="extensionType"
                                checked={extensionType === 'custom'}
                                onChange={() => {
                                    setExtensionType('custom');
                                    setError('');
                                }}
                                style={{ accentColor: 'var(--neon-blue)' }}
                            />
                            Custom
                        </label>
                    </div>

                    {extensionType === 'preset' ? (
                        <select
                            value={presetMinutes}
                            onChange={(e) => {
                                setPresetMinutes(parseInt(e.target.value));
                                setError('');
                            }}
                            style={{
                                width: '100%',
                                padding: '0.8rem',
                                borderRadius: '8px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--glass-border)',
                                color: '#fff',
                                fontSize: '0.9rem'
                            }}
                        >
                            <option value="5" style={{ background: '#000' }}>5 Minutes</option>
                            <option value="10" style={{ background: '#000' }}>10 Minutes</option>
                            <option value="15" style={{ background: '#000' }}>15 Minutes</option>
                            <option value="30" style={{ background: '#000' }}>30 Minutes</option>
                        </select>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <input
                                type="number"
                                min="1"
                                max="120"
                                placeholder="Enter minutes (1-120)"
                                value={customMinutes}
                                onChange={(e) => {
                                    setCustomMinutes(e.target.value);
                                    setError('');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '0.8rem',
                                    borderRadius: '8px',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: error && customMinutes ? '1px solid var(--neon-pink)' : '1px solid var(--neon-blue)',
                                    color: '#fff',
                                    fontSize: '0.9rem'
                                }}
                            />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Minutes</span>
                        </div>
                    )}
                </div>

                {error && (
                    <div style={{
                        padding: '0.8rem',
                        background: 'rgba(255, 77, 77, 0.1)',
                        border: '1px solid rgba(255, 77, 77, 0.3)',
                        borderRadius: '8px',
                        color: 'var(--neon-pink)',
                        fontSize: '0.85rem',
                        marginBottom: '1rem'
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            padding: '0.8rem 1.5rem',
                            background: 'transparent',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-secondary)',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            opacity: loading ? 0.5 : 1
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExtend}
                        disabled={loading || (extensionType === 'custom' && (!customMinutes || parseInt(customMinutes) <= 0))}
                        style={{
                            padding: '0.8rem 1.5rem',
                            background: 'var(--neon-blue)',
                            border: 'none',
                            color: '#000',
                            borderRadius: '8px',
                            cursor: (loading || (extensionType === 'custom' && (!customMinutes || parseInt(customMinutes) <= 0))) ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            opacity: (loading || (extensionType === 'custom' && (!customMinutes || parseInt(customMinutes) <= 0))) ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="spinner" size={16} />
                                Extending...
                            </>
                        ) : (
                            'Extend Expiry'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExtendExpiryModal;
