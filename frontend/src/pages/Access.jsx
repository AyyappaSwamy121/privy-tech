import React, { useState, useRef } from 'react';
import { Search, Loader2, FileText, AlertCircle, Printer, Info, Download, Shield } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../config';

const Access = () => {
    const [code, setCode] = useState('');
    const [verified, setVerified] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileUrl, setFileUrl] = useState(null);
    const [isBlurred, setIsBlurred] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [timestamp, setTimestamp] = useState('');
    const [securityAlert, setSecurityAlert] = useState(null);
    const [printsRemaining, setPrintsRemaining] = useState(null);
    const [printLimitReached, setPrintLimitReached] = useState(false);
    const [accessMode, setAccessMode] = useState('PRINT');
    const iframeRef = useRef(null);
    const printIframeRef = useRef(null);
    const isPrintingRef = useRef(false); // Execution lock to prevent multiple prints
    const activePrintIframeRef = useRef(null); // Track active print iframe for cleanup

    const showSecurityAlert = (msg) => {
        setSecurityAlert(msg);
        setTimeout(() => setSecurityAlert(null), 3000);
    };

    // Prevent Interactions & Shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            const isCmdOrCtrl = e.ctrlKey || e.metaKey;

            // Block Save, View Source, Inspect, Print (outside button), Select All
            if (
                (isCmdOrCtrl && ['s', 'u', 'i', 'j', 'c', 'a', 'p'].includes(e.key.toLowerCase())) ||
                (e.key === 'F12') ||
                (isCmdOrCtrl && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) ||
                (isCmdOrCtrl && e.altKey && e.key.toLowerCase() === 'u')
            ) {
                e.preventDefault();
                showSecurityAlert('Security Policy: Action restricted.');
                return false;
            }
        };

        const handleContextMenu = (e) => {
            e.preventDefault();
            showSecurityAlert('Right-click is disabled for security reasons.');
            return false;
        };

        const handleBlur = () => {
            if (!isPrinting) setIsBlurred(true);
        };
        const handleFocus = () => setIsBlurred(false);

        // Print event handlers - hide watermark during print
        const handleBeforePrint = () => {
            setIsPrinting(true);
            // Add print class to body to trigger CSS
            document.body.classList.add('printing');
        };

        const handleAfterPrint = () => {
            setIsPrinting(false);
            document.body.classList.remove('printing');
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, [isPrinting]);

    const handleSearch = async () => {
        if (code.length !== 6) {
            setError('Please enter 6-digit code');
            return;
        }

        setLoading(true);
        setError(null);
        setVerified(false);
        setPrintLimitReached(false);

        try {
            const verifyRes = await axios.get(`${API_BASE}/api/document/verify/${code}`);
            if (verifyRes.data.success) {
                const fetchedFiles = verifyRes.data.files;
                setFiles(fetchedFiles);
                setVerified(true);
                setTimestamp(new Date().toLocaleString());
                setPrintsRemaining(verifyRes.data.printsRemaining);
                setPrintLimitReached(false);
                setAccessMode(verifyRes.data.accessMode || 'PRINT');

                // Auto-select first file for instant preview
                if (fetchedFiles.length > 0) {
                    loadFile(fetchedFiles[0]);
                }
            }
        } catch (err) {
            console.error('Access denied', err);
            const errMsg = err.response?.data?.error || 'Verification failed.';
            setError(errMsg);
            if (errMsg === 'Print limit reached') setPrintLimitReached(true);
        } finally {
            setLoading(false);
        }
    };

    const isOfficeFile = (fileName) => {
        return /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(fileName);
    };

    const loadFile = async (file) => {
        setLoading(true);
        try {
            if (fileUrl && fileUrl.startsWith('blob:')) URL.revokeObjectURL(fileUrl);

            if (isOfficeFile(file.fileName)) {
                // For Office files, we use a direct URL for Microsoft's Office Viewer
                let baseUrl = API_BASE;
                if (baseUrl.startsWith('/')) {
                    baseUrl = window.location.origin + baseUrl;
                } else if (!baseUrl.startsWith('http')) {
                    baseUrl = window.location.origin;
                }
                const directUrl = `${baseUrl}/api/document/${code}/${file.id}`;
                setFileUrl(directUrl);
                setSelectedFile(file);
            } else {
                // For PDF and Images, download as blob for secure local preview
                const docRes = await axios.get(`${API_BASE}/api/document/${code}/${file.id}`, {
                    responseType: 'blob'
                });
                const blobUrl = URL.createObjectURL(docRes.data);
                setFileUrl(blobUrl);
                setSelectedFile(file);
            }
        } catch (err) {
            setError('Failed to load file.');
        } finally {
            setLoading(false);
        }
    };

    const handleSecurePrint = async () => {
        // 🔍 CRITICAL DEBUG: Log every single click
        console.log("🖱️ SECURE PRINT CLICKED!", {
            timestamp: new Date().toISOString(),
            isPrintingRef: isPrintingRef.current,
            hasSelectedFile: !!selectedFile
        });

        // 🚨 EXECUTION LOCK: Prevent multiple simultaneous prints
        if (isPrintingRef.current || !selectedFile) {
            console.warn("🚫 PRINT BLOCKED: Execution locked or no file selected", {
                isPrinting: isPrintingRef.current,
                hasFile: !!selectedFile
            });
            return;
        }

        // 🔒 LOCK IMMEDIATELY
        isPrintingRef.current = true;
        setIsPrinting(true);

        console.log("🔓 PRINT LOCK ACQUIRED - Starting print process");

        try {
            // 🔍 DEBUG: Log API call start
            console.log("📡 CALLING PRINT API...", {
                code,
                timestamp: new Date().toISOString()
            });

            // Reserve print slot FIRST (server-side atomic increment)
            let printedRes;
            try {
                printedRes = await axios.post(`${API_BASE}/api/document/printed/${code}`);
                console.log("✅ PRINT API SUCCESS:", printedRes.data);
            } catch (e) {
                console.log("❌ PRINT API ERROR:", e.response?.data);
                if (e.response?.status === 410) {
                    setPrintLimitReached(true);
                    setVerified(false);
                    // Match the backend error or provide the requested message fallback
                    setError(e.response?.data?.error === 'Document expired' && e.response?.config?.url?.includes('printed')
                        ? 'Print limit reached. Document has been expired.'
                        : e.response?.data?.error || 'Print limit reached. Document has been expired.');
                    return;
                }
                throw e;
            }

            // 🔧 FIX: Immediately update printsRemaining, but strictly DO NOT unmount the UI yet.
            if (printedRes?.data?.success) {
                setPrintsRemaining(printedRes.data.printsRemaining);
                if (printedRes.data.status === 'EXPIRED' || printedRes.data.status === 'PRINT_LIMIT_REACHED') {
                    console.log("Final print slot consumed - UI will lock after printing completes.");
                }
            }

            if (selectedFile.mimeType.startsWith('image/')) {
                // SECURE PRINT: Use hidden iframe to prevent visible exposure
                await new Promise((resolve) => {
                    (async () => {
                        try {
                            // Cleanup any existing print iframe first
                            if (activePrintIframeRef.current && document.body.contains(activePrintIframeRef.current)) {
                                document.body.removeChild(activePrintIframeRef.current);
                                activePrintIframeRef.current = null;
                            }

                            // Convert blob URL to data URL
                            const response = await fetch(fileUrl);
                            if (!response.ok) {
                                throw new Error('Failed to fetch image');
                            }

                            const blob = await response.blob();
                            const dataUrl = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.onerror = () => reject(new Error('Failed to convert to data URL'));
                                reader.readAsDataURL(blob);
                            });

                            // Create hidden iframe for secure printing
                            const printIframe = document.createElement('iframe');
                            printIframe.style.position = 'fixed';
                            printIframe.style.top = '-9999px';
                            printIframe.style.left = '-9999px';
                            printIframe.style.width = '1px';
                            printIframe.style.height = '1px';
                            printIframe.style.border = 'none';
                            printIframe.style.visibility = 'hidden';
                            printIframe.style.opacity = '0';
                            printIframe.style.pointerEvents = 'none';
                            document.body.appendChild(printIframe);
                            activePrintIframeRef.current = printIframe;

                            // Track if print has been triggered to prevent duplicates
                            let printTriggered = false;

                            const cleanup = () => {
                                if (activePrintIframeRef.current && document.body.contains(activePrintIframeRef.current)) {
                                    document.body.removeChild(activePrintIframeRef.current);
                                    activePrintIframeRef.current = null;
                                }
                                resolve(); // Resolve on cleanup
                            };

                            const triggerPrint = () => {
                                // Guard: Only trigger once
                                if (printTriggered) return;
                                printTriggered = true;

                                try {
                                    const iframeWindow = printIframe.contentWindow || printIframe.contentDocument?.defaultView;
                                    if (iframeWindow) {
                                        iframeWindow.focus();
                                        iframeWindow.print();

                                        // Cleanup after print dialog closes
                                        setTimeout(cleanup, 1000);
                                    } else {
                                        throw new Error('Cannot access iframe window');
                                    }
                                } catch (e) {
                                    console.error('Print error:', e);
                                    cleanup();
                                }
                            };

                            // Write print document to iframe
                            const printDoc = printIframe.contentDocument || printIframe.contentWindow.document;
                            printDoc.open();
                            printDoc.write(`
                        <!DOCTYPE html>
                        <html>
                            <head>
                                <title>Print</title>
                                <style>
                                    * { margin: 0; padding: 0; box-sizing: border-box; }
                                    html, body { width: 100%; height: auto; margin: 0; padding: 0; background: white; overflow: visible; }
                                    body { display: flex; align-items: center; justify-content: center; min-height: auto; padding: 0.5cm; }
                                    img { display: block; max-width: 100%; max-height: calc(100vh - 1cm); width: auto; height: auto; margin: 0 auto; page-break-inside: avoid; page-break-after: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
                                    @media print {
                                        html, body { width: 100%; height: auto; margin: 0; padding: 0; overflow: visible; }
                                        body { display: flex; align-items: center; justify-content: center; padding: 0.5cm; min-height: auto; }
                                        img { max-width: 100%; max-height: calc(100vh - 1cm); width: auto; height: auto; page-break-inside: avoid; page-break-after: avoid; display: block !important; visibility: visible !important; opacity: 1 !important; }
                                        @page { margin: 0.5cm; size: auto; }
                                    }
                                </style>
                            </head>
                            <body>
                                <img src="${dataUrl}" alt="${selectedFile.fileName}" />
                                <script>
                                    (function() {
                                        const img = document.querySelector('img');
                                        let scriptPrintTriggered = false;
                                        
                                        function triggerScriptPrint() {
                                            if (scriptPrintTriggered) return;
                                            if (img.complete && img.naturalWidth > 0) {
                                                scriptPrintTriggered = true;
                                                return;
                                            }
                                            img.onload = function() {
                                                if (!scriptPrintTriggered) {
                                                    scriptPrintTriggered = true;
                                                }
                                            };
                                        }
                                        triggerScriptPrint();
                                    })();
                                </script>
                            </body>
                        </html>
                    `);
                            printDoc.close();

                            // Fallback timeout: Only trigger if onload doesn't fire
                            let fallbackTimeout = setTimeout(() => {
                                if (!printTriggered && document.body.contains(printIframe)) {
                                    triggerPrint();
                                }
                            }, 2000);

                            // Single trigger point: Wait for iframe to load, then trigger print once
                            printIframe.onload = () => {
                                // Clear fallback since onload fired
                                clearTimeout(fallbackTimeout);
                                // Small delay to ensure image is loaded in iframe
                                setTimeout(() => {
                                    triggerPrint();
                                }, 300);
                            };

                            // Print count already reserved at start of handleSecurePrint
                        } catch (e) {
                            console.error('Print error:', e);
                            if (activePrintIframeRef.current && document.body.contains(activePrintIframeRef.current)) {
                                document.body.removeChild(activePrintIframeRef.current);
                                activePrintIframeRef.current = null;
                            }
                            resolve(); // Resolve on error to allow lock release
                        }
                    })();
                });
            } else {
                // For PDFs, trigger print from the iframe
                await new Promise((resolve) => {
                    if (iframeRef.current && iframeRef.current.contentWindow) {
                        try {
                            // Try to trigger print from iframe's window
                            iframeRef.current.contentWindow.focus();
                            setTimeout(() => {
                                iframeRef.current.contentWindow.print();
                                resolve();
                            }, 500);
                        } catch (e) {
                            // If cross-origin, fallback to main window print
                            console.log('Cross-origin, using main window print');
                            setTimeout(() => {
                                window.print();
                                resolve();
                            }, 500);
                        }
                    } else {
                        // Fallback: print main window
                        setTimeout(() => {
                            window.print();
                            resolve();
                        }, 500);
                    }
                });

                // Print count already reserved at start of handleSecurePrint
            }
        } catch (e) {
            console.error('Print error:', e);
        } finally {
            // 🔓 LOCK RELEASE: Delayed release to prevent double-clicks
            setTimeout(() => {
                isPrintingRef.current = false;
                setIsPrinting(false);

                // 🔧 FIX: ONLY enforce limit reached *after* the browser print dialog has fully closed
                // and the event loop continues.
                if (printedRes?.data?.status === 'EXPIRED' || printedRes?.data?.status === 'PRINT_LIMIT_REACHED') {
                    setPrintLimitReached(true);
                    setVerified(false);
                    setError('Print limit reached. Document has been expired.');
                }

                console.log("🔓 PRINT LOCK RELEASED");
            }, 1500); // 1.5s delay to assure the print dialog has been acknowledged
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '2rem auto', position: 'relative' }}>
            {securityAlert && (
                <div className="animate-fade-in" style={{
                    position: 'fixed',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(255, 0, 85, 0.9)',
                    color: 'white',
                    padding: '1rem 2rem',
                    borderRadius: '50px',
                    zIndex: 9999,
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 0 20px rgba(255, 0, 85, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 'bold'
                }}>
                    <AlertCircle size={20} />
                    {securityAlert}
                </div>
            )}
            <div className="glass-panel no-print" style={{ padding: '2rem', transition: 'filter 0.3s ease', filter: isBlurred ? 'blur(25px)' : 'none' }}>
                <div className="no-print" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h2 className="glow-text no-print">Secure Batch Portal</h2>
                    <p className="no-print" style={{ color: 'var(--text-secondary)' }}>View and Print Secured Batch Files</p>
                </div>

                {!verified ? (
                    <div style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center' }}>
                            <div style={{ position: 'relative', width: '300px' }}>
                                <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={20} />
                                <input
                                    type="text"
                                    placeholder="Enter 6-digit code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    style={{ paddingLeft: '3rem', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '4px' }}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                />
                            </div>
                            <button className="neon-border" onClick={handleSearch} disabled={code.length !== 6 || loading}>
                                {loading ? <Loader2 className="spinner" /> : 'VERIFY CODE'}
                            </button>
                        </div>
                        {error && <p style={{ color: 'var(--neon-pink)', textAlign: 'center' }}>{error}</p>}
                    </div>
                ) : (
                    <div className="no-print" style={{ display: 'grid', gridTemplateColumns: files.length > 1 ? '300px 1fr' : '1fr', gap: '2rem' }}>
                        {files.length > 1 && accessMode === 'PRINT' && (
                            <div className="no-print" style={{ borderRight: '1px solid var(--glass-border)', paddingRight: '1.5rem' }}>
                                <h3 className="no-print" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>FILES IN BATCH</h3>
                                <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {files.map((f, i) => (
                                        <button
                                            key={i}
                                            className="no-print"
                                            onClick={() => loadFile(f)}
                                            style={{
                                                textAlign: 'left',
                                                padding: '1rem',
                                                background: selectedFile?.id === f.id ? 'rgba(0, 240, 255, 0.1)' : 'rgba(255,255,255,0.02)',
                                                border: selectedFile?.id === f.id ? '1px solid var(--neon-blue)' : '1px solid transparent',
                                                borderRadius: '8px',
                                                fontSize: '0.8rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            <FileText size={16} color={selectedFile?.id === f.id ? 'var(--neon-blue)' : 'gray'} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            {accessMode === 'SHARE' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                        <Shield size={48} color="var(--neon-blue)" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
                                        <h3 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Secure Code Verified</h3>
                                        <p style={{ color: 'var(--text-secondary)' }}>This batch is securely protected. Download individual files below.</p>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
                                        {files.map((file, idx) => (
                                            <div key={idx} style={{ flex: '1 1 300px', maxWidth: '400px', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
                                                    <FileText size={32} color="var(--neon-blue)" />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.fileName}>{file.fileName}</h4>
                                                        {file.downloadsRemaining !== null && (
                                                            <span style={{ fontSize: '0.85rem', color: file.downloadsRemaining === 0 ? 'var(--neon-pink)' : 'var(--neon-blue)', fontWeight: 'bold' }}>
                                                                {file.downloadsRemaining === 0 ? 'Download Limit Reached' : `${file.downloadsRemaining} Download(s) Remaining`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: 'auto' }}>
                                                    {file.downloadsRemaining !== 0 ? (
                                                        <a
                                                            href={`${API_BASE}/api/document/${code}/${file.id}?download=true`}
                                                            download
                                                            onClick={() => {
                                                                if (file.downloadsRemaining !== null) {
                                                                    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, downloadsRemaining: Math.max(0, f.downloadsRemaining - 1) } : f));
                                                                }
                                                            }}
                                                            className="neon-border"
                                                            style={{
                                                                background: 'var(--neon-blue)',
                                                                color: '#000',
                                                                padding: '0.75rem 1.5rem',
                                                                cursor: 'pointer',
                                                                textDecoration: 'none',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '0.5rem',
                                                                fontWeight: 'bold',
                                                                borderRadius: '8px',
                                                                width: '100%',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                        >
                                                            <Download size={18} /> DOWNLOAD
                                                        </a>
                                                    ) : (
                                                        <div style={{
                                                            padding: '0.75rem 1.5rem',
                                                            background: 'rgba(255,0,0,0.1)',
                                                            color: 'var(--neon-pink)',
                                                            border: '1px solid var(--neon-pink)',
                                                            borderRadius: '8px',
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            width: '100%'
                                                        }}>
                                                            Access Expired
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : selectedFile ? (
                                <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <span style={{ fontWeight: 'bold' }}>{selectedFile.fileName}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            {accessMode === 'PRINT' && printsRemaining !== null && (
                                                <span style={{
                                                    fontSize: '0.85rem',
                                                    color: printsRemaining === 0 ? 'var(--neon-pink)' : 'var(--neon-green)',
                                                    fontWeight: '600'
                                                }}>
                                                    {printsRemaining === 0 ? 'Print Limit Reached' : `Prints Remaining: ${printsRemaining}`}
                                                </span>
                                            )}
                                            <button
                                                className="neon-border no-print"
                                                onClick={handleSecurePrint}
                                                disabled={isPrinting || isPrintingRef.current || printsRemaining === 0}
                                                style={{
                                                    background: isPrinting ? 'var(--text-secondary)' : 'var(--neon-green)',
                                                    color: '#000',
                                                    padding: '0.5rem 1.5rem',
                                                    cursor: isPrinting ? 'not-allowed' : 'pointer',
                                                    opacity: isPrinting ? 0.6 : 1
                                                }}
                                            >
                                                <Printer size={18} /> {isPrinting ? 'PRINTING...' : 'SECURE PRINT'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="print-viewer-container" style={{ height: '600px', background: '#000', borderRadius: '12px', overflowY: 'auto', overflowX: 'hidden', touchAction: 'auto', position: 'relative', border: '1px solid var(--neon-blue)' }}>
                                        {selectedFile.mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(selectedFile.fileName) ? (
                                            <img
                                                className="print-image"
                                                id="print-image-element"
                                                src={fileUrl}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'contain',
                                                    filter: 'contrast(1.1)',
                                                    display: 'block'
                                                }}
                                                alt="Secure View"
                                                onContextMenu={(e) => e.preventDefault()}
                                                onLoad={() => {
                                                    console.log('Image loaded for print');
                                                }}
                                            />
                                        ) : isOfficeFile(selectedFile.fileName) ? (
                                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                                {fileUrl && (fileUrl.includes('localhost') || fileUrl.includes('127.0.0.1')) ? (
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
                                                        <AlertCircle size={48} color="var(--neon-pink)" style={{ marginBottom: '1rem' }} />
                                                        <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Local Network Detected</h3>
                                                        <p>Microsoft Office Online Viewer requires a publicly accessible URL to generate a preview. It cannot read files directly from <code>localhost</code>.</p>
                                                        {accessMode === 'SHARE' ? (
                                                            <p style={{ marginTop: '1rem', color: 'var(--neon-blue)' }}>Please use the Download button above to view this file.</p>
                                                        ) : (
                                                            <p style={{ marginTop: '1rem', color: 'var(--neon-pink)' }}>Secure Print unavailable for Office files on Localhost.</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <iframe
                                                        src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`}
                                                        style={{ width: "100%", height: "100%", border: "none" }}
                                                        title="Office Viewer"
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            <iframe
                                                ref={iframeRef}
                                                className="print-pdf-iframe"
                                                src={`${fileUrl}#toolbar=0&navpanes=0`}
                                                width="100%"
                                                height="100%"
                                                frameBorder="0"
                                                title="Viewer"
                                                onLoad={(e) => {
                                                    try {
                                                        const doc = e.target.contentWindow.document;
                                                        const win = e.target.contentWindow;

                                                        // Inject print styles into iframe
                                                        const printStyle = doc.createElement('style');
                                                        printStyle.textContent = `
                                                            @media print {
                                                                body {
                                                    margin: 0;
                                                    padding: 0;
                                                    width: 100%;
                                                    height: auto;
                                                    overflow: visible !important;
                                                }
                                                embed, object {
                                                    width: 100% !important;
                                                    height: auto !important;
                                                    page-break-inside: auto !important;
                                                    page-break-after: auto !important;
                                                }
                                                @page {
                                                    margin: 0;
                                                    size: auto;
                                                }
                                            }
                                                        `;
                                                        doc.head.appendChild(printStyle);

                                                        // Inject styles to hide scrollbars/selection if needed
                                                        const style = doc.createElement('style');
                                                        style.textContent = `
                                                            body { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
                                                        `;
                                                        doc.head.appendChild(style);

                                                        // Forward security events (Backup for overlay)
                                                        win.addEventListener('contextmenu', (evt) => {
                                                            evt.preventDefault();
                                                            showSecurityAlert('Right-click disabled in viewer.');
                                                        });
                                                        win.addEventListener('keydown', (evt) => {
                                                            const isCmdOrCtrl = evt.ctrlKey || evt.metaKey;
                                                            if (
                                                                (isCmdOrCtrl && ['s', 'p', 'a', 'c'].includes(evt.key.toLowerCase())) ||
                                                                evt.key === 'F12'
                                                            ) {
                                                                evt.preventDefault();
                                                                showSecurityAlert('Restricted action in viewer.');
                                                            }
                                                        });
                                                    } catch (err) {
                                                        console.log('Secure viewer isolation active.');
                                                    }
                                                }}
                                            />
                                        )}
                                        {/* Active Security Overlay - View Only (Hidden in Print) */}
                                        <div
                                            className="view-watermark"
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                pointerEvents: 'none', // Allow scroll events to pass through
                                                background: 'repeating-linear-gradient(45deg, transparent, transparent 100px, rgba(255,255,255,0.02) 100px, rgba(255,255,255,0.02) 101px)',
                                                zIndex: 10
                                            }}
                                        />

                                        {/* PRIVY PRINT Watermark with Code - Anti-Capture Protection */}
                                        <div
                                            className="view-watermark"
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                pointerEvents: 'none', // Don't block interactions, just overlay
                                                zIndex: 11,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                userSelect: 'none',
                                                WebkitUserSelect: 'none',
                                                MozUserSelect: 'none',
                                                msUserSelect: 'none'
                                            }}
                                        >
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    transform: 'translate(-50%, -50%) rotate(-45deg)',
                                                    fontSize: 'clamp(24px, 4vw, 48px)',
                                                    fontWeight: 'bold',
                                                    color: 'rgba(0, 255, 0, 0.15)',
                                                    whiteSpace: 'nowrap',
                                                    textShadow: '0 0 10px rgba(0, 255, 0, 0.3)',
                                                    letterSpacing: '4px',
                                                    fontFamily: 'monospace',
                                                    pointerEvents: 'none',
                                                    zIndex: 12
                                                }}
                                            >
                                                PRIVY PRINT - {code}
                                            </div>

                                            {/* Multiple watermark layers for better coverage */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: '20%',
                                                    left: '10%',
                                                    transform: 'rotate(-45deg)',
                                                    fontSize: 'clamp(18px, 3vw, 36px)',
                                                    fontWeight: 'bold',
                                                    color: 'rgba(0, 240, 255, 0.12)',
                                                    whiteSpace: 'nowrap',
                                                    letterSpacing: '3px',
                                                    fontFamily: 'monospace',
                                                    pointerEvents: 'none',
                                                    zIndex: 12
                                                }}
                                            >
                                                PRIVY PRINT
                                            </div>

                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '20%',
                                                    right: '10%',
                                                    transform: 'rotate(-45deg)',
                                                    fontSize: 'clamp(18px, 3vw, 36px)',
                                                    fontWeight: 'bold',
                                                    color: 'rgba(0, 240, 255, 0.12)',
                                                    whiteSpace: 'nowrap',
                                                    letterSpacing: '3px',
                                                    fontFamily: 'monospace',
                                                    pointerEvents: 'none',
                                                    zIndex: 12
                                                }}
                                            >
                                                CODE: {code}
                                            </div>

                                            {/* Corner watermarks */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: '10%',
                                                    left: '5%',
                                                    fontSize: 'clamp(14px, 2vw, 24px)',
                                                    fontWeight: 'bold',
                                                    color: 'rgba(0, 255, 0, 0.1)',
                                                    fontFamily: 'monospace',
                                                    pointerEvents: 'none',
                                                    zIndex: 12
                                                }}
                                            >
                                                {code}
                                            </div>

                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '10%',
                                                    right: '5%',
                                                    fontSize: 'clamp(14px, 2vw, 24px)',
                                                    fontWeight: 'bold',
                                                    color: 'rgba(0, 255, 0, 0.1)',
                                                    fontFamily: 'monospace',
                                                    pointerEvents: 'none',
                                                    zIndex: 12
                                                }}
                                            >
                                                PRIVY PRINT
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="no-print" style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--glass-border)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                                    Select a file to preview securely
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Access;
