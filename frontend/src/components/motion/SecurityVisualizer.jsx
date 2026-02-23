import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, QrCode, Clock, Printer } from 'lucide-react';

const SecurityVisualizer = () => {
    const [countdown, setCountdown] = useState(15);
    const [printLimit, setPrintLimit] = useState(3);
    const [showQR, setShowQR] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setCountdown((prev) => (prev > 0 ? prev - 1 : 15));
            if (Math.random() > 0.7 && printLimit > 0) {
                setPrintLimit((prev) => Math.max(0, prev - 1));
            }
        }, 1000);

        const qrInterval = setInterval(() => {
            setShowQR((prev) => !prev);
        }, 3000);

        return () => {
            clearInterval(interval);
            clearInterval(qrInterval);
        };
    }, [printLimit]);

    return (
        <motion.div
            className="glass-panel"
            style={{
                padding: '2rem',
                borderRadius: '16px',
                border: '1px solid var(--glass-border)',
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
        >
            <h3 style={{ 
                fontSize: '0.9rem', 
                color: 'var(--text-secondary)', 
                marginBottom: '1.5rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
            }}>
                Live Security Dashboard
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                {/* Countdown Timer */}
                <motion.div
                    style={{
                        padding: '1rem',
                        background: 'rgba(0, 240, 255, 0.1)',
                        borderRadius: '8px',
                        border: '1px solid rgba(0, 240, 255, 0.3)',
                    }}
                    whileHover={{ scale: 1.05 }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Clock size={16} color="var(--neon-blue)" />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Expires In</span>
                    </div>
                    <motion.div
                        key={countdown}
                        initial={{ scale: 1.2, color: 'var(--neon-blue)' }}
                        animate={{ scale: 1, color: '#fff' }}
                        style={{
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            color: 'var(--neon-blue)',
                        }}
                    >
                        {countdown}m
                    </motion.div>
                </motion.div>

                {/* Print Limit */}
                <motion.div
                    style={{
                        padding: '1rem',
                        background: 'rgba(0, 255, 150, 0.1)',
                        borderRadius: '8px',
                        border: '1px solid rgba(0, 255, 150, 0.3)',
                    }}
                    whileHover={{ scale: 1.05 }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Printer size={16} color="var(--neon-green)" />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Prints Left</span>
                    </div>
                    <motion.div
                        key={printLimit}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        style={{
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            color: 'var(--neon-green)',
                        }}
                    >
                        {printLimit}
                    </motion.div>
                </motion.div>
            </div>

            {/* QR Code Preview */}
            <motion.div
                style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '120px',
                }}
            >
                <AnimatePresence mode="wait">
                    {showQR ? (
                        <motion.div
                            key="qr"
                            initial={{ opacity: 0, rotateY: -90 }}
                            animate={{ opacity: 1, rotateY: 0 }}
                            exit={{ opacity: 0, rotateY: 90 }}
                            transition={{ duration: 0.5 }}
                            style={{ textAlign: 'center' }}
                        >
                            <QrCode size={64} color="var(--neon-blue)" />
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                Secure QR Code
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="lock"
                            initial={{ opacity: 0, rotateY: -90 }}
                            animate={{ opacity: 1, rotateY: 0 }}
                            exit={{ opacity: 0, rotateY: 90 }}
                            transition={{ duration: 0.5 }}
                            style={{ textAlign: 'center' }}
                        >
                            <Lock size={64} color="var(--neon-green)" />
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                Print Locked
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

export default SecurityVisualizer;
