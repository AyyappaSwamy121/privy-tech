import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Clock, Printer, Loader2, FileText, X, AlertTriangle, Shield, Lock, QrCode, CheckCircle2, ArrowDown, Zap, Eye, KeyRound, Download } from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { API_BASE } from '../config';
import ExtendExpiryModal from '../components/ExtendExpiryModal';
import AnimatedSection from '../components/motion/AnimatedSection';
import MotionCard from '../components/motion/MotionCard';
import GlowButton from '../components/motion/GlowButton';
import AnimatedTimeline from '../components/motion/AnimatedTimeline';
import SecurityVisualizer from '../components/motion/SecurityVisualizer';
import FloatingParticles from '../components/motion/FloatingParticles';

const Home = () => {
    const [files, setFiles] = useState([]);
    const [expiryType, setExpiryType] = useState('preset');
    const [presetExpiry, setPresetExpiry] = useState(15);
    const [customExpiry, setCustomExpiry] = useState('');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState(JSON.parse(localStorage.getItem('privy_history') || '[]'));
    const [extendModalOpen, setExtendModalOpen] = useState(false);
    const [selectedCode, setSelectedCode] = useState(null);
    const [selectedExpiresAt, setSelectedExpiresAt] = useState(null);
    const [expireConfirmOpen, setExpireConfirmOpen] = useState(false);
    const [codeToExpire, setCodeToExpire] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [printLockEnabled, setPrintLockEnabled] = useState(false);
    const [printLimit, setPrintLimit] = useState(1);
    const [downloadLockEnabled, setDownloadLockEnabled] = useState(false);
    const [fileLimits, setFileLimits] = useState({});
    const [accessMode, setAccessMode] = useState('PRINT'); // Default to PRINT
    const [typingText, setTypingText] = useState('');
    const [typingIndex, setTypingIndex] = useState(0);
    const navigate = useNavigate();
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll();
    const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
    const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -100]);

    const keywords = ['Time-Limited', 'Print-Locked', 'Fully Auditable'];
    const [currentKeywordIndex, setCurrentKeywordIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentKeywordIndex((prev) => (prev + 1) % keywords.length);
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const currentKeyword = keywords[currentKeywordIndex];
        let timeout;
        let charIndex = 0;

        const type = () => {
            if (charIndex < currentKeyword.length) {
                setTypingText(currentKeyword.slice(0, charIndex + 1));
                charIndex++;
                timeout = setTimeout(type, 100);
            } else {
                timeout = setTimeout(() => {
                    setTypingText('');
                    charIndex = 0;
                }, 2000);
            }
        };

        setTypingText('');
        type();

        return () => clearTimeout(timeout);
    }, [currentKeywordIndex]);

    const handleFileChange = (e) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            const newFiles = Array.from(e.dataTransfer.files);
            setFiles(prev => [...prev, ...newFiles]);
        }
    }, []);

    const removeFile = (index, e) => {
        e.stopPropagation();
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setLoading(true);
        const formData = new FormData();
        files.forEach(file => formData.append('file', file));

        const finalExpiry = expiryType === 'preset' ? presetExpiry : parseInt(customExpiry);
        formData.append('expiry', finalExpiry);
        formData.append('accessMode', accessMode);

        if (accessMode === 'PRINT' && printLockEnabled && printLimit >= 1 && printLimit <= 10) {
            formData.append('printLimit', printLimit);
        }

        if (accessMode === 'SHARE' && downloadLockEnabled) {
            // Only send limits for files that actually have a limit selected > 0
            const activeLimits = {};
            Object.keys(fileLimits).forEach(key => {
                if (fileLimits[key] >= 1) activeLimits[key] = fileLimits[key];
            });
            formData.append('fileLimits', JSON.stringify(activeLimits));
        }

        try {
            const response = await axios.post(`${API_BASE}/api/upload`, formData);
            const { code, expiresAt } = response.data;

            const newHistory = [{
                code,
                fileName: files.length === 1 ? files[0].name : `${files.length} Files Batch`,
                expiresAt,
                status: 'active'
            }, ...history];
            const slicedHistory = newHistory.slice(0, 10);
            setHistory(slicedHistory);
            localStorage.setItem('privy_history', JSON.stringify(slicedHistory));

            navigate(`/success/${code}/${encodeURIComponent(expiresAt)}`);
        } catch (error) {
            console.error('Upload failed', error);
            alert('Upload failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleExpireNowClick = (code, e) => {
        e.stopPropagation();
        setCodeToExpire(code);
        setExpireConfirmOpen(true);
    };

    const handleExpireConfirm = async () => {
        if (!codeToExpire) return;

        try {
            await axios.post(`${API_BASE}/api/document/expire/${codeToExpire}`);
            const updatedHistory = history.map(item =>
                item.code === codeToExpire ? { ...item, expiresAt: new Date(Date.now() - 1000).toISOString() } : item
            );
            setHistory(updatedHistory);
            localStorage.setItem('privy_history', JSON.stringify(updatedHistory));
            setExpireConfirmOpen(false);
            setCodeToExpire(null);
        } catch (err) {
            console.error('Failed to expire', err);
            alert('Failed to expire document. Please try again.');
        }
    };

    const handleExtendClick = (code, expiresAt, e) => {
        e.stopPropagation();
        setSelectedCode(code);
        setSelectedExpiresAt(expiresAt);
        setExtendModalOpen(true);
    };

    const handleExtendSuccess = (code, newExpiresAt) => {
        const updatedHistory = history.map(item =>
            item.code === code ? { ...item, expiresAt: newExpiresAt } : item
        );
        setHistory(updatedHistory);
        localStorage.setItem('privy_history', JSON.stringify(updatedHistory));
        setExtendModalOpen(false);
        setSelectedCode(null);
        setSelectedExpiresAt(null);
    };

    const scrollToUpload = () => {
        document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div style={{ width: '100%', overflowX: 'hidden' }}>
            {/* Hero Section */}
            <motion.section
                ref={heroRef}
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    padding: '4rem 2rem',
                    overflow: 'hidden',
                    opacity: heroOpacity,
                    y: heroY,
                }}
            >
                {/* Animated Gradient Background */}
                <motion.div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.1) 0%, rgba(0, 255, 150, 0.1) 50%, rgba(121, 40, 202, 0.1) 100%)',
                        zIndex: 0,
                    }}
                    animate={{
                        backgroundPosition: ['0% 0%', '100% 100%'],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        repeatType: 'reverse',
                    }}
                />

                {/* Floating Particles */}
                <FloatingParticles count={15} />

                {/* Floating Shield Icon */}
                <motion.div
                    style={{
                        position: 'absolute',
                        top: '15%',
                        right: '10%',
                        zIndex: 1,
                    }}
                    animate={{
                        y: [0, -20, 0],
                        rotate: [0, 5, 0],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                >
                    <Shield size={80} color="var(--neon-green)" style={{ filter: 'drop-shadow(0 0 20px var(--neon-green))' }} />
                </motion.div>

                {/* Hero Content */}
                <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: '900px' }}>
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        style={{
                            fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                            fontWeight: 800,
                            marginBottom: '1.5rem',
                            background: 'linear-gradient(135deg, var(--neon-blue), var(--neon-green))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            textTransform: 'uppercase',
                            letterSpacing: '3px',
                        }}
                    >
                        PRIVY PRINT
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        style={{
                            fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
                            color: 'var(--text-secondary)',
                            marginBottom: '2rem',
                            fontWeight: 300,
                        }}
                    >
                        Enterprise-Grade Secure Document Platform
                    </motion.p>

                    {/* Typing Effect Keywords */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        style={{
                            minHeight: '3rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '3rem',
                        }}
                    >
                        <span style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', color: 'var(--neon-blue)', fontWeight: 700 }}>
                            {typingText}
                            <motion.span
                                animate={{ opacity: [1, 0] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                                style={{ marginLeft: '0.2rem' }}
                            >
                                |
                            </motion.span>
                        </span>
                    </motion.div>

                    {/* Scroll Indicator */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 1 }}
                        style={{ marginTop: '3rem' }}
                    >
                        <motion.button
                            onClick={scrollToUpload}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--neon-blue)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.5rem',
                            }}
                            animate={{ y: [0, 10, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
                                Get Started
                            </span>
                            <ArrowDown size={24} />
                        </motion.button>
                    </motion.div>
                </div>
            </motion.section>

            {/* Upload Section */}
            <AnimatedSection id="upload-section" delay={0.2}>
                <div style={{ maxWidth: '900px', margin: '0 auto', padding: '4rem 2rem', position: 'relative', zIndex: 1 }}>
                    <motion.div
                        className="glass-panel"
                        style={{
                            padding: '3rem',
                            textAlign: 'center',
                            position: 'relative',
                        }}
                        initial={{ scale: 0.95 }}
                        whileInView={{ scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <AnimatedSection delay={0.1}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                                <h2 className="glow-text" style={{ margin: 0, fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
                                    Secure Document Drop
                                </h2>
                            </div>
                        </AnimatedSection>

                        {/* Enhanced Upload Box */}
                        <AnimatedSection delay={0.3}>
                            <motion.div
                                style={{
                                    border: `2px dashed ${isDragging ? 'var(--neon-blue)' : 'var(--glass-border)'}`,
                                    borderRadius: '16px',
                                    padding: '3rem',
                                    marginBottom: '2rem',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    background: isDragging ? 'rgba(0, 240, 255, 0.05)' : 'transparent',
                                    transition: 'all 0.3s ease',
                                }}
                                onClick={() => document.getElementById('file-upload').click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                whileHover={{
                                    borderColor: 'var(--neon-blue)',
                                    boxShadow: '0 0 30px rgba(0, 240, 255, 0.3)',
                                }}
                                animate={{
                                    boxShadow: isDragging
                                        ? ['0 0 20px rgba(0, 240, 255, 0.5)', '0 0 40px rgba(0, 240, 255, 0.7)', '0 0 20px rgba(0, 240, 255, 0.5)']
                                        : '0 0 0px rgba(0, 240, 255, 0)',
                                }}
                                transition={{ duration: 1.5, repeat: isDragging ? Infinity : 0 }}
                            >
                                <motion.div
                                    animate={{ scale: files.length > 0 ? [1, 1.1, 1] : 1 }}
                                    transition={{ duration: 0.5 }}
                                >
                                    <Upload size={48} color="var(--neon-blue)" style={{ marginBottom: '1rem' }} />
                                </motion.div>
                                <p style={{ color: 'var(--text-secondary)', fontWeight: '500', fontSize: '1.1rem' }}>
                                    {files.length > 0 ? `${files.length} files selected` : 'Drop Secure Files (PDF, Images, etc.)'}
                                </p>

                                {files.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        style={{
                                            marginTop: '1.5rem',
                                            textAlign: 'left',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            background: 'rgba(0,0,0,0.3)',
                                            borderRadius: '12px',
                                            padding: '1rem',
                                            border: '1px solid var(--glass-border)'
                                        }}
                                    >
                                        <p style={{ fontSize: '0.75rem', color: 'var(--neon-blue)', marginBottom: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            Selected Files ({files.length})
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                            {files.map((f, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20 }}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        fontSize: '0.8rem',
                                                        padding: '0.5rem',
                                                        background: 'rgba(255,255,255,0.03)',
                                                        borderRadius: '6px'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', overflow: 'hidden' }}>
                                                        <FileText size={16} color="var(--text-secondary)" />
                                                        <div style={{ overflow: 'hidden' }}>
                                                            <div style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                                                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>{f.type || 'Unknown Type'}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <div style={{ color: 'var(--neon-blue)', fontWeight: '500', fontSize: '0.7rem' }}>
                                                            {(f.size / 1024).toFixed(1)} KB
                                                        </div>
                                                        <motion.button
                                                            onClick={(e) => removeFile(i, e)}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: 'rgba(255,255,255,0.3)',
                                                                cursor: 'pointer',
                                                                padding: '4px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                borderRadius: '4px',
                                                            }}
                                                            whileHover={{ color: 'var(--neon-pink)', scale: 1.2 }}
                                                        >
                                                            <X size={14} />
                                                        </motion.button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                                <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.5rem' }}>
                                    Multiple files supported (any type)
                                </p>
                                <input
                                    id="file-upload"
                                    type="file"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={handleFileChange}
                                />
                            </motion.div>
                        </AnimatedSection>

                        {/* Expiry Configuration */}
                        <AnimatedSection delay={0.4}>
                            <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                    <Clock size={14} /> EXPIRY CONFIGURATION
                                </label>

                                <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
                                    <motion.label
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
                                        whileHover={{ scale: 1.05 }}
                                    >
                                        <input
                                            type="radio"
                                            name="expiryType"
                                            checked={expiryType === 'preset'}
                                            onChange={() => setExpiryType('preset')}
                                            style={{ accentColor: 'var(--neon-blue)' }}
                                        />
                                        Preset
                                    </motion.label>
                                    <motion.label
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
                                        whileHover={{ scale: 1.05 }}
                                    >
                                        <input
                                            type="radio"
                                            name="expiryType"
                                            checked={expiryType === 'custom'}
                                            onChange={() => setExpiryType('custom')}
                                            style={{ accentColor: 'var(--neon-blue)' }}
                                        />
                                        Custom
                                    </motion.label>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', minHeight: '50px' }}>
                                    {expiryType === 'preset' ? (
                                        <select
                                            value={presetExpiry}
                                            onChange={(e) => setPresetExpiry(parseInt(e.target.value))}
                                            style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: '#fff', fontSize: '0.9rem' }}
                                        >
                                            <option value="5" style={{ background: '#000' }}>5 Minutes</option>
                                            <option value="10" style={{ background: '#000' }}>10 Minutes</option>
                                            <option value="15" style={{ background: '#000' }}>15 Minutes</option>
                                            <option value="30" style={{ background: '#000' }}>30 Minutes</option>
                                            <option value="60" style={{ background: '#000' }}>60 Minutes (1 Hour)</option>
                                        </select>
                                    ) : (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <input
                                                type="number"
                                                min="1"
                                                placeholder="Enter minutes (e.g. 120)"
                                                value={customExpiry}
                                                onChange={(e) => setCustomExpiry(e.target.value)}
                                                style={{
                                                    flex: 1,
                                                    padding: '0.8rem',
                                                    borderRadius: '8px',
                                                    background: 'rgba(0,0,0,0.2)',
                                                    border: (customExpiry && parseInt(customExpiry) <= 0) ? '1px solid var(--neon-pink)' : '1px solid var(--neon-blue)',
                                                    color: '#fff',
                                                    fontSize: '0.9rem'
                                                }}
                                            />
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Minutes</span>
                                        </div>
                                    )}
                                </div>
                                {expiryType === 'custom' && customExpiry && parseInt(customExpiry) <= 0 && (
                                    <p style={{ color: 'var(--neon-pink)', fontSize: '0.7rem', marginTop: '0.5rem' }}>* Expiry must be at least 1 minute</p>
                                )}
                                <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.8rem' }}>* Files are permanently wiped from the secure buffer after this window.</p>
                            </div>
                        </AnimatedSection>

                        {/* MODE CONFIGURATION */}
                        <AnimatedSection delay={0.42}>
                            <div style={{ marginBottom: '2rem', textAlign: 'left', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                    <Shield size={14} /> ACCESS MODE
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                                    <motion.div
                                        onClick={() => { setAccessMode('PRINT'); setPrintLockEnabled(true); }}
                                        style={{
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            border: `1px solid ${accessMode === 'PRINT' ? 'var(--neon-green)' : 'var(--glass-border)'}`,
                                            background: accessMode === 'PRINT' ? 'rgba(0, 255, 150, 0.05)' : 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.5rem'
                                        }}
                                        whileHover={{ borderColor: 'var(--neon-green)' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: accessMode === 'PRINT' ? 'var(--neon-green)' : '#fff' }}>
                                            <input type="radio" checked={accessMode === 'PRINT'} onChange={() => { }} style={{ accentColor: 'var(--neon-green)' }} />
                                            <span style={{ fontWeight: 'bold' }}>Secure Print Only</span>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, paddingLeft: '1.5rem' }}>
                                            View in secure frame. No downloads allowed. Right-click disabled.
                                        </p>
                                    </motion.div>

                                    <motion.div
                                        onClick={() => { setAccessMode('SHARE'); setPrintLockEnabled(false); }}
                                        style={{
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            border: `1px solid ${accessMode === 'SHARE' ? 'var(--neon-blue)' : 'var(--glass-border)'}`,
                                            background: accessMode === 'SHARE' ? 'rgba(0, 240, 255, 0.05)' : 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.5rem'
                                        }}
                                        whileHover={{ borderColor: 'var(--neon-blue)' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: accessMode === 'SHARE' ? 'var(--neon-blue)' : '#fff' }}>
                                            <input type="radio" checked={accessMode === 'SHARE'} onChange={() => { }} style={{ accentColor: 'var(--neon-blue)' }} />
                                            <span style={{ fontWeight: 'bold' }}>Share File</span>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, paddingLeft: '1.5rem' }}>
                                            Standard sharing. Allows file download. Secure prints disabled.
                                        </p>
                                    </motion.div>

                                </div>
                            </div>
                        </AnimatedSection>

                        {/* Print Lock Configuration (Only show in PRINT mode) */}
                        <AnimatePresence>
                            {accessMode === 'PRINT' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <AnimatedSection delay={0.45}>
                                        <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                <Printer size={14} /> PRINT LOCK
                                            </label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                                <motion.label
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' }}
                                                    whileHover={{ scale: 1.02 }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={printLockEnabled}
                                                        onChange={(e) => setPrintLockEnabled(e.target.checked)}
                                                        style={{ accentColor: 'var(--neon-green)' }}
                                                    />
                                                    Enable Print Limit
                                                </motion.label>

                                                {printLockEnabled && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="10"
                                                            value={printLimit}
                                                            onChange={(e) => setPrintLimit(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                                                            style={{
                                                                background: 'rgba(255,255,255,0.05)',
                                                                border: '1px solid var(--glass-border)',
                                                                color: 'white',
                                                                padding: '0.25rem 0.5rem',
                                                                borderRadius: '4px',
                                                                width: '60px',
                                                                textAlign: 'center'
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>prints maximum</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                                * When enabled, document access is blocked after the set number of prints. Default: unlimited.
                                            </p>
                                        </div>
                                    </AnimatedSection>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Download Lock Configuration (Only show in SHARE mode) */}
                        <AnimatePresence>
                            {accessMode === 'SHARE' && files.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <AnimatedSection delay={0.45}>
                                        <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                <Download size={14} /> DOWNLOAD LIMITS (PER FILE)
                                            </label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <motion.label
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' }}
                                                    whileHover={{ scale: 1.02 }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={downloadLockEnabled}
                                                        onChange={(e) => {
                                                            setDownloadLockEnabled(e.target.checked);
                                                            if (e.target.checked) {
                                                                // Initialize all to 1
                                                                const initial = {};
                                                                files.forEach(f => initial[f.name] = 1);
                                                                setFileLimits(initial);
                                                            }
                                                        }}
                                                        style={{ accentColor: 'var(--neon-blue)' }}
                                                    />
                                                    Enable Max Downloads
                                                </motion.label>

                                                {downloadLockEnabled && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', paddingLeft: '1.5rem', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                                                        {files.map((file, idx) => (
                                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                                                                    {file.name}
                                                                </span>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        max="50"
                                                                        value={fileLimits[file.name] || 1}
                                                                        onChange={(e) => {
                                                                            setFileLimits(prev => ({
                                                                                ...prev,
                                                                                [file.name]: Math.max(1, Math.min(50, parseInt(e.target.value) || 1))
                                                                            }));
                                                                        }}
                                                                        style={{
                                                                            background: 'rgba(255,255,255,0.05)',
                                                                            border: '1px solid var(--glass-border)',
                                                                            color: 'white',
                                                                            padding: '0.25rem 0.5rem',
                                                                            borderRadius: '4px',
                                                                            width: '60px',
                                                                            textAlign: 'center'
                                                                        }}
                                                                    />
                                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>downloads</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
                                                * When enabled, each file automatically expires after its set number of downloads.
                                            </p>
                                        </div>
                                    </AnimatedSection>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Upload Button */}
                        <AnimatedSection delay={0.5}>
                            <GlowButton
                                onClick={handleUpload}
                                disabled={files.length === 0 || loading || (expiryType === 'custom' && (!customExpiry || parseInt(customExpiry) <= 0))}
                                style={{
                                    width: '100%',
                                    padding: '1.2rem',
                                    fontSize: '1.1rem',
                                    fontWeight: 'bold',
                                    opacity: (files.length === 0 || loading || (expiryType === 'custom' && (!customExpiry || parseInt(customExpiry) <= 0))) ? 0.5 : 1,
                                    cursor: (files.length === 0 || loading || (expiryType === 'custom' && (!customExpiry || parseInt(customExpiry) <= 0))) ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                }}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                                        <span>Generating Secure Code...</span>
                                    </>
                                ) : (
                                    <>
                                        <Lock size={20} />
                                        <span>GENERATE SECURE ACCESS CODE</span>
                                    </>
                                )}
                            </GlowButton>
                        </AnimatedSection >

                        {/* History Section */}
                        < AnimatedSection delay={0.6} >
                            <div style={{ marginTop: '3rem', textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>Sender History (This Session)</h3>
                                    <motion.button
                                        onClick={() => { setHistory([]); localStorage.removeItem('privy_history'); }}
                                        style={{ fontSize: '0.7rem', background: 'transparent', border: 'none', color: 'var(--neon-pink)', cursor: 'pointer' }}
                                        whileHover={{ scale: 1.1 }}
                                    >
                                        CLEAR ALL
                                    </motion.button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    {history.length === 0 ? (
                                        <p style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem' }}>No recent uploads found</p>
                                    ) : (
                                        history.map((item, index) => (
                                            <HistoryItem
                                                key={index}
                                                item={item}
                                                onExtendClick={handleExtendClick}
                                                onExpireNow={handleExpireNowClick}
                                                onNavigate={navigate}
                                                onExtendSuccess={(newExpiresAt) => handleExtendSuccess(item.code, newExpiresAt)}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        </AnimatedSection >
                    </motion.div >
                </div >
            </AnimatedSection >

            {/* How It Works Section */}
            < AnimatedSection delay={0.2} >
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '6rem 2rem', position: 'relative', zIndex: 1 }}>
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        style={{
                            textAlign: 'center',
                            fontSize: 'clamp(2rem, 5vw, 3rem)',
                            marginBottom: '4rem',
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                        }}
                        className="glow-text"
                    >
                        How It Works
                    </motion.h2>

                    <AnimatedTimeline
                        steps={[
                            <MotionCard key="step1" delay={0} className="glass-panel" style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'start', gap: '1.5rem' }}>
                                    <motion.div
                                        style={{
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, var(--neon-blue), var(--neon-green))',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                        whileHover={{ rotate: 360 }}
                                        transition={{ duration: 0.6 }}
                                    >
                                        <Upload size={28} color="#000" />
                                    </motion.div>
                                    <div>
                                        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', color: 'var(--neon-blue)' }}>1. Upload Documents</h3>
                                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                            Securely upload your sensitive documents. Our platform supports PDFs, images, and all file types.
                                        </p>
                                    </div>
                                </div>
                            </MotionCard>,
                            <MotionCard key="step2" delay={0.2} className="glass-panel" style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'start', gap: '1.5rem' }}>
                                    <motion.div
                                        style={{
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, var(--neon-green), var(--neon-purple))',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                        whileHover={{ rotate: 360 }}
                                        transition={{ duration: 0.6 }}
                                    >
                                        <KeyRound size={28} color="#000" />
                                    </motion.div>
                                    <div>
                                        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', color: 'var(--neon-green)' }}>2. Generate Secure Code</h3>
                                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                            Receive a unique access code with customizable expiry time. Set print limits and security parameters.
                                        </p>
                                    </div>
                                </div>
                            </MotionCard>,
                            <MotionCard key="step3" delay={0.4} className="glass-panel" style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'start', gap: '1.5rem' }}>
                                    <motion.div
                                        style={{
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-pink))',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                        whileHover={{ rotate: 360 }}
                                        transition={{ duration: 0.6 }}
                                    >
                                        <QrCode size={28} color="#000" />
                                    </motion.div>
                                    <div>
                                        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', color: 'var(--neon-purple)' }}>3. Share & Access</h3>
                                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                            Share the code or QR code with authorized recipients. Documents are print-locked and time-limited.
                                        </p>
                                    </div>
                                </div>
                            </MotionCard>,
                            <MotionCard key="step4" delay={0.6} className="glass-panel" style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'start', gap: '1.5rem' }}>
                                    <motion.div
                                        style={{
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, var(--neon-pink), var(--neon-blue))',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                        whileHover={{ rotate: 360 }}
                                        transition={{ duration: 0.6 }}
                                    >
                                        <Eye size={28} color="#000" />
                                    </motion.div>
                                    <div>
                                        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', color: 'var(--neon-pink)' }}>4. Full Audit Trail</h3>
                                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                            Track every access, print attempt, and expiry event. Complete transparency and security compliance.
                                        </p>
                                    </div>
                                </div>
                            </MotionCard>,
                        ]}
                    />
                </div>
            </AnimatedSection >

            {/* Security Features Grid */}
            < AnimatedSection delay={0.2} >
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '6rem 2rem', position: 'relative', zIndex: 1 }}>
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        style={{
                            textAlign: 'center',
                            fontSize: 'clamp(2rem, 5vw, 3rem)',
                            marginBottom: '4rem',
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                        }}
                        className="glow-text"
                    >
                        Security Features
                    </motion.h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                        {[
                            { icon: Clock, title: 'Time-Limited Access', desc: 'Automatic expiry ensures documents are inaccessible after set time', color: 'var(--neon-blue)' },
                            { icon: Lock, title: 'Print Lock Protection', desc: 'Prevent unauthorized printing with configurable print limits', color: 'var(--neon-green)' },
                            { icon: Shield, title: 'End-to-End Encryption', desc: 'Military-grade encryption protects your documents at rest and in transit', color: 'var(--neon-purple)' },
                            { icon: Eye, title: 'Complete Audit Trail', desc: 'Track every access, print attempt, and security event', color: 'var(--neon-pink)' },
                            { icon: QrCode, title: 'QR Code Access', desc: 'Secure QR codes for easy, contactless document sharing', color: 'var(--neon-blue)' },
                            { icon: Zap, title: 'Instant Expiry', desc: 'Manually expire documents immediately when needed', color: 'var(--neon-green)' },
                        ].map((feature, index) => (
                            <MotionCard key={index} delay={index * 0.1} hover={true}>
                                <motion.div
                                    className="glass-panel"
                                    style={{
                                        padding: '2rem',
                                        height: '100%',
                                        border: `1px solid var(--glass-border)`,
                                        position: 'relative',
                                        overflow: 'hidden',
                                    }}
                                    whileHover={{
                                        borderColor: feature.color,
                                        boxShadow: `0 0 30px ${feature.color}40`,
                                        y: -8,
                                    }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <motion.div
                                        style={{
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '12px',
                                            background: `${feature.color}20`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: '1.5rem',
                                        }}
                                        whileHover={{
                                            scale: 1.1,
                                            boxShadow: `0 0 20px ${feature.color}`,
                                        }}
                                    >
                                        <feature.icon size={28} color={feature.color} />
                                    </motion.div>
                                    <h3 style={{ fontSize: '1.2rem', marginBottom: '0.8rem', color: feature.color }}>
                                        {feature.title}
                                    </h3>
                                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                                        {feature.desc}
                                    </p>
                                </motion.div>
                            </MotionCard>
                        ))}
                    </div>
                </div>
            </AnimatedSection >

            {/* Live Security Visualization */}
            < AnimatedSection delay={0.2} >
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '6rem 2rem', position: 'relative', zIndex: 1 }}>
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        style={{
                            textAlign: 'center',
                            fontSize: 'clamp(2rem, 5vw, 3rem)',
                            marginBottom: '4rem',
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                        }}
                        className="glow-text"
                    >
                        See It In Action
                    </motion.h2>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <SecurityVisualizer />
                    </div>
                </div>
            </AnimatedSection >

            {/* Modals */}
            < ExtendExpiryModal
                isOpen={extendModalOpen}
                onClose={() => {
                    setExtendModalOpen(false);
                    setSelectedCode(null);
                    setSelectedExpiresAt(null);
                }}
                code={selectedCode}
                currentExpiresAt={selectedExpiresAt}
                onSuccess={(newExpiresAt) => handleExtendSuccess(selectedCode, newExpiresAt)}
            />

            < AnimatePresence >
                {expireConfirmOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
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
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setExpireConfirmOpen(false);
                                setCodeToExpire(null);
                            }
                        }}
                    >
                        <motion.div
                            className="glass-panel"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            style={{
                                padding: '2rem',
                                maxWidth: '400px',
                                width: '90%',
                                position: 'relative',
                                border: '1px solid var(--glass-border)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                <AlertTriangle size={24} color="var(--neon-pink)" />
                                <h2 style={{ margin: 0, color: 'var(--neon-pink)' }}>Confirm Expiry</h2>
                            </div>

                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                Are you sure you want to expire this document? This action cannot be undone and the document will be immediately inaccessible.
                            </p>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <motion.button
                                    onClick={() => {
                                        setExpireConfirmOpen(false);
                                        setCodeToExpire(null);
                                    }}
                                    style={{
                                        padding: '0.8rem 1.5rem',
                                        background: 'transparent',
                                        border: '1px solid var(--glass-border)',
                                        color: 'var(--text-secondary)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem'
                                    }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Cancel
                                </motion.button>
                                <motion.button
                                    onClick={handleExpireConfirm}
                                    style={{
                                        padding: '0.8rem 1.5rem',
                                        background: 'rgba(255, 77, 77, 0.2)',
                                        border: '1px solid rgba(255, 77, 77, 0.5)',
                                        color: '#ff4d4d',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        fontWeight: 'bold',
                                    }}
                                    whileHover={{ scale: 1.05, background: 'rgba(255, 77, 77, 0.3)' }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    Expire Now
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence >
        </div >
    );
};

// History Item Component with Timer
const HistoryItem = ({ item, onExtendClick, onExpireNow, onNavigate, onExtendSuccess }) => {
    const [timeLeft, setTimeLeft] = useState('');
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        let isMounted = true;

        if (isExpired) return;

        const checkServerStatus = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/document/verify/${item.code}`);
                if (isMounted) {
                    if (res.data.status === 'EXPIRED') {
                        setIsExpired(true);
                        setTimeLeft('EXPIRED');
                    } else {
                        // Update local expiry if extended elsewhere
                        if (res.data.expiresAt && new Date(res.data.expiresAt).getTime() !== new Date(item.expiresAt).getTime()) {
                            item.expiresAt = res.data.expiresAt;
                        }
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

            const expiresAt = new Date(item.expiresAt).getTime();
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

        // Initial check immediately, then timer
        checkServerStatus();
        updateTimer();

        const timer = setInterval(updateTimer, 1000);
        const poll = setInterval(checkServerStatus, 5000);

        return () => {
            isMounted = false;
            clearInterval(timer);
            clearInterval(poll);
        };
    }, [item.code, item.expiresAt, isExpired]);

    return (
        <motion.div
            className="glass-panel"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            style={{
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.85rem',
                cursor: 'pointer',
                borderLeft: isExpired ? '4px solid var(--neon-pink)' : '4px solid var(--neon-green)'
            }}
            onClick={() => !isExpired && onNavigate(`/success/${item.code}/${encodeURIComponent(item.expiresAt)}`)}
            whileHover={{ scale: 1.02, x: 5 }}
        >
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {item.fileName}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>Code: <span style={{ color: 'var(--neon-blue)', fontWeight: 'bold', fontSize: '1rem', marginLeft: '0.2rem' }}>{item.code}</span></span>
                    {!isExpired && (
                        <motion.div
                            key={timeLeft}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.7rem',
                                color: 'var(--neon-green)',
                                fontWeight: '600',
                                padding: '0.2rem 0.5rem',
                                background: 'rgba(0, 255, 150, 0.1)',
                                borderRadius: '4px',
                                border: '1px solid rgba(0, 255, 150, 0.3)'
                            }}
                        >
                            <Clock size={12} />
                            <span>{timeLeft}</span>
                        </motion.div>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{
                    color: isExpired ? 'var(--neon-pink)' : 'var(--neon-green)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                }}>
                    {isExpired ? 'EXPIRED' : 'ACTIVE'}
                </div>
                {!isExpired && (
                    <>
                        <motion.button
                            onClick={(e) => onExtendClick(item.code, item.expiresAt, e)}
                            style={{
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.65rem',
                                background: 'rgba(100, 200, 255, 0.1)',
                                border: '1px solid rgba(100, 200, 255, 0.3)',
                                color: 'var(--neon-blue)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                            whileHover={{ scale: 1.1, background: 'rgba(100, 200, 255, 0.2)' }}
                            whileTap={{ scale: 0.95 }}
                        >
                            EXTEND EXPIRY
                        </motion.button>
                        <motion.button
                            onClick={(e) => onExpireNow(item.code, e)}
                            style={{
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.65rem',
                                background: 'rgba(255, 77, 77, 0.1)',
                                border: '1px solid rgba(255, 77, 77, 0.3)',
                                color: '#ff4d4d',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                            whileHover={{ scale: 1.1, background: 'rgba(255, 77, 77, 0.2)' }}
                            whileTap={{ scale: 0.95 }}
                        >
                            EXPIRE NOW
                        </motion.button>
                    </>
                )}
            </div>
        </motion.div>
    );
};

export default Home;
