import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Copy, Check, ArrowLeft, Clock } from 'lucide-react';
import axios from 'axios';
import ExtendExpiryModal from '../components/ExtendExpiryModal';

const Success = () => {
    const { code, expiry } = useParams();
    const [timeLeft, setTimeLeft] = useState('');
    const [copied, setCopied] = useState(false);
    const [currentExpiry, setCurrentExpiry] = useState(decodeURIComponent(expiry));
    const [isExpired, setIsExpired] = useState(false);
    const [extendModalOpen, setExtendModalOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;

        if (isExpired) return;

        const checkServerStatus = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_BASE || 'http://localhost:5000'}/api/document/verify/${code}`);
                if (isMounted) {
                    if (res.data.status === 'EXPIRED') {
                        setIsExpired(true);
                        setTimeLeft('EXPIRED');
                    } else if (res.data.expiresAt && new Date(res.data.expiresAt).getTime() !== new Date(currentExpiry).getTime()) {
                        setCurrentExpiry(res.data.expiresAt);
                    }
                }
            } catch (error) {
                if (isMounted && error.response && error.response.status === 410) {
                    setIsExpired(true);
                    setTimeLeft('EXPIRED');
                }
            }
        };

        const updateTimer = () => {
            if (isExpired) return;

            const expiresAt = new Date(currentExpiry).getTime();
            const now = new Date().getTime();
            const distance = expiresAt - now;

            if (distance < 0) {
                setTimeLeft('EXPIRED');
                setIsExpired(true);
                return;
            }

            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            setTimeLeft(`${minutes}m ${seconds}s`);
        };

        checkServerStatus();
        updateTimer();

        const timer = setInterval(updateTimer, 1000);
        const poll = setInterval(checkServerStatus, 5000);

        return () => {
            isMounted = false;
            clearInterval(timer);
            clearInterval(poll);
        };
    }, [currentExpiry, code, isExpired]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleExtendSuccess = (newExpiresAt) => {
        setCurrentExpiry(newExpiresAt);
        setExtendModalOpen(false);
        // Update URL without reload
        window.history.replaceState(null, '', `/success/${code}/${encodeURIComponent(newExpiresAt)}`);
    };

    return (
        <div style={{ maxWidth: '600px', margin: '4rem auto' }}>
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: '150px',
                    height: '150px',
                    background: 'var(--neon-purple)',
                    filter: 'blur(80px)',
                    opacity: 0.3,
                    borderRadius: '50%'
                }}></div>

                <h2 style={{ color: 'var(--neon-green)', marginBottom: '0.5rem' }}>Secure Batch Ready</h2>

                <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', fontSize: '0.9rem' }}>
                    Share this unique access code. All files in this batch will be automatically wiped after expiry.
                </p>

                <div
                    className="neon-border"
                    style={{
                        padding: '2rem',
                        fontSize: '4rem',
                        fontWeight: '800',
                        letterSpacing: '8px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '12px',
                        marginBottom: '2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1rem',
                        position: 'relative'
                    }}
                >
                    <span className="glow-text">{code}</span>
                    <button
                        onClick={handleCopy}
                        style={{
                            padding: '0.5rem',
                            border: 'none',
                            background: 'transparent',
                            color: copied ? 'var(--neon-green)' : 'var(--text-secondary)',
                            cursor: 'pointer'
                        }}
                    >
                        {copied ? <Check size={24} /> : <Copy size={24} />}
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3rem', marginBottom: '2rem' }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Expires In</p>
                        <p style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--neon-purple)', margin: 0 }}>{timeLeft}</p>
                    </div>
                </div>

                {!isExpired && (
                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
                        <button
                            onClick={() => setExtendModalOpen(true)}
                            style={{
                                padding: '0.8rem 1.5rem',
                                background: 'rgba(100, 200, 255, 0.1)',
                                border: '1px solid var(--neon-blue)',
                                color: 'var(--neon-blue)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'rgba(100, 200, 255, 0.2)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'rgba(100, 200, 255, 0.1)';
                            }}
                        >
                            <Clock size={16} />
                            Extend Expiry
                        </button>
                    </div>
                )}

                <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <Link to="/" style={{ textDecoration: 'none' }}>
                        <button style={{ border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', cursor: 'pointer' }}>
                            <ArrowLeft size={16} /> New Upload
                        </button>
                    </Link>
                </div>
            </div>

            <ExtendExpiryModal
                isOpen={extendModalOpen}
                onClose={() => setExtendModalOpen(false)}
                code={code}
                currentExpiresAt={currentExpiry}
                onSuccess={handleExtendSuccess}
            />
        </div>
    );
};

export default Success;
