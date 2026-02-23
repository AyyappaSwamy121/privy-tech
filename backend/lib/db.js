const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const isMock = !process.env.GCP_PROJECT_ID || process.env.GCP_PROJECT_ID === 'your-project-id';

let db;
let mockDbPath = path.join(__dirname, '../data/db.json');

if (!isMock) {
    db = new Firestore({
        projectId: process.env.GCP_PROJECT_ID,
    });
} else {
    console.log('Using Mock Firestore (Local JSON)');
    if (!fs.existsSync(path.join(__dirname, '../data'))) {
        fs.mkdirSync(path.join(__dirname, '../data'));
    }
    if (!fs.existsSync(mockDbPath)) {
        fs.writeFileSync(mockDbPath, JSON.stringify({ documents: {} }));
    }
}

const COLLECTION_NAME = 'documents';

const getMockData = () => JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
const saveMockData = (data) => fs.writeFileSync(mockDbPath, JSON.stringify(data, null, 2));

// Mock mode: async mutex for atomic read-modify-write (prevents race conditions)
let mockLockPromise = Promise.resolve();
const mockLockAcquire = () => {
    const prev = mockLockPromise;
    let releaseFn;
    mockLockPromise = new Promise((r) => { releaseFn = r; });
    return prev.then(() => releaseFn);
};

const saveMetadata = async (metadata) => {
    if (!isMock) {
        await db.collection(COLLECTION_NAME).doc(metadata.code).set(metadata);
    } else {
        const data = getMockData();
        data.documents[metadata.code] = metadata;
        saveMockData(data);
    }
};

const getMetadata = async (code) => {
    if (!isMock) {
        const doc = await db.collection(COLLECTION_NAME).doc(code).get();
        if (!doc.exists) return null;
        return doc.data();
    } else {
        const data = getMockData();
        return data.documents[code] || null;
    }
};

const deleteMetadata = async (code) => {
    if (!isMock) {
        await db.collection(COLLECTION_NAME).doc(code).delete();
    } else {
        const data = getMockData();
        delete data.documents[code];
        saveMockData(data);
    }
};

const getExpiredDocuments = async () => {
    const now = new Date();
    if (!isMock) {
        const snapshot = await db.collection(COLLECTION_NAME)
            .where('expiresAt', '<=', now)
            .get();
        return snapshot.docs.map(doc => doc.data());
    } else {
        const data = getMockData();
        return Object.values(data.documents).filter(doc => new Date(doc.expiresAt) <= now);
    }
};

/**
 * Extends the expiry time of a document by the specified minutes.
 * Uses atomic updates to prevent race conditions.
 * @param {string} code - Document access code
 * @param {number} extensionMinutes - Minutes to extend expiry by
 * @returns {Promise<{success: boolean, newExpiresAt: Date, error?: string}>}
 */
const extendExpiry = async (code, extensionMinutes) => {
    const now = new Date();

    if (!isMock) {
        // Firestore: Use transaction for atomic update
        const docRef = db.collection(COLLECTION_NAME).doc(code);

        try {
            const result = await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);

                if (!doc.exists) {
                    throw new Error('Document not found');
                }

                const data = doc.data();
                const currentExpiresAt = data.expiresAt.toDate();

                // Validate document is still active
                if (now >= currentExpiresAt) {
                    throw new Error('Document has already expired');
                }

                // Validate status
                if (data.status !== 'active') {
                    throw new Error('Document is not active');
                }

                // Calculate new expiry time
                const newExpiresAt = new Date(currentExpiresAt.getTime() + extensionMinutes * 60000);

                // Validate total lifetime cap (120 minutes from creation)
                const createdAt = data.createdAt.toDate();
                const totalLifetimeMinutes = (newExpiresAt.getTime() - createdAt.getTime()) / 60000;
                const MAX_LIFETIME_MINUTES = 120;

                if (totalLifetimeMinutes > MAX_LIFETIME_MINUTES) {
                    throw new Error(`Extension would exceed maximum lifetime of ${MAX_LIFETIME_MINUTES} minutes`);
                }

                // Atomic update
                transaction.update(docRef, {
                    expiresAt: newExpiresAt
                });

                return { success: true, newExpiresAt };
            });

            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    } else {
        // Mock mode: Read-modify-write with validation
        try {
            const data = getMockData();
            const document = data.documents[code];

            if (!document) {
                return { success: false, error: 'Document not found' };
            }

            // Handle date conversion - dates might be strings or Date objects
            let currentExpiresAt;
            if (document.expiresAt instanceof Date) {
                currentExpiresAt = document.expiresAt;
            } else if (typeof document.expiresAt === 'string') {
                currentExpiresAt = new Date(document.expiresAt);
            } else {
                return { success: false, error: 'Invalid expiresAt format' };
            }

            // Validate date is valid
            if (isNaN(currentExpiresAt.getTime())) {
                return { success: false, error: 'Invalid expiresAt date' };
            }

            // Validate document is still active
            if (now >= currentExpiresAt) {
                return { success: false, error: 'Document has already expired' };
            }

            // Validate status
            if (document.status !== 'active') {
                return { success: false, error: 'Document is not active' };
            }

            // Calculate new expiry time
            const newExpiresAt = new Date(currentExpiresAt.getTime() + extensionMinutes * 60000);

            // Validate total lifetime cap (120 minutes from creation)
            let createdAt;
            if (document.createdAt instanceof Date) {
                createdAt = document.createdAt;
            } else if (typeof document.createdAt === 'string') {
                createdAt = new Date(document.createdAt);
            } else {
                return { success: false, error: 'Invalid createdAt format' };
            }

            if (isNaN(createdAt.getTime())) {
                return { success: false, error: 'Invalid createdAt date' };
            }

            const totalLifetimeMinutes = (newExpiresAt.getTime() - createdAt.getTime()) / 60000;
            const MAX_LIFETIME_MINUTES = 120;

            if (totalLifetimeMinutes > MAX_LIFETIME_MINUTES) {
                return { success: false, error: `Extension would exceed maximum lifetime of ${MAX_LIFETIME_MINUTES} minutes` };
            }

            // Update document
            document.expiresAt = newExpiresAt.toISOString();
            data.documents[code] = document;
            saveMockData(data);

            return { success: true, newExpiresAt };
        } catch (error) {
            console.error('Error in extendExpiry (Mock mode):', error);
            return { success: false, error: error.message || 'Failed to extend expiry' };
        }
    }
};

/**
 * Atomically increment print count and enforce print limit.
 * Returns { success, printCount, printLimit, status, error }.
 * If printLimit reached: sets status=PRINT_LIMIT_REACHED, expiresAt=now, returns success=true (print was counted).
 */
const incrementPrintCount = async (code) => {
    const now = new Date();

    if (!isMock) {
        const docRef = db.collection(COLLECTION_NAME).doc(code);
        try {
            const result = await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);
                if (!doc.exists) throw new Error('Document not found');
                const data = doc.data();

                // Status check (PRINT_LIMIT_REACHED or EXPIRED)
                const status = data.status || 'active';
                if (status === 'PRINT_LIMIT_REACHED' || status === 'EXPIRED') throw new Error('Print limit reached');
                if (status !== 'active') throw new Error(`Document not accessible: ${status}`);

                // Time expiry check
                const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                if (now >= expiresAt) throw new Error('Document expired');

                // Print limit: null/undefined = unlimited (backward compat)
                const printLimit = data.printLimit ?? null;

                // 🔧 CRITICAL FIX: Normalize field names to prevent confusion
                // Always use printCount, fallback to usedPrints for backward compatibility
                const currentPrintCount = data.printCount ?? data.usedPrints ?? 0;

                // 🔍 CRITICAL DEBUG: Log state BEFORE validation
                console.log("🚨 PRINT DEBUG:", {
                    code,
                    before: currentPrintCount,
                    limit: printLimit,
                    hasPrintCount: !!data.printCount,
                    hasUsedPrints: !!data.usedPrints,
                    comparison: printLimit !== null ? `${currentPrintCount} >= ${printLimit}` : 'unlimited'
                });

                // ✅ CORRECT VALIDATION: Check current count BEFORE incrementing
                if (printLimit !== null && currentPrintCount >= printLimit) {
                    console.log("🚫 PRINT BLOCKED: Limit reached - current count already at limit");
                    throw new Error('Print limit reached');
                }

                // ✅ ALLOW PRINT: Increment count AFTER validation passes
                const newPrintCount = currentPrintCount + 1;

                // 🔍 DEBUG: Log state AFTER increment
                console.log("✅ PRINT ALLOWED:", {
                    oldCount: currentPrintCount,
                    newCount: newPrintCount,
                    limit: printLimit,
                    willLock: newPrintCount >= printLimit
                });

                // 🔧 CRITICAL FIX: Always update printCount, remove usedPrints to prevent confusion
                const updates = {
                    printCount: newPrintCount,
                    // Remove usedPrints field to prevent future confusion
                    usedPrints: null
                };

                // Set limit reached status if this was the last print
                if (printLimit !== null && newPrintCount >= printLimit) {
                    updates.status = 'EXPIRED'; // STRICT EXPIRY OVERRIDE
                    updates.expiresAt = now;
                }
                transaction.update(docRef, updates);

                return {
                    success: true,
                    printCount: newPrintCount,
                    printLimit: printLimit ?? null,
                    status: updates.status || 'active',
                };
            });
            return result;
        } catch (err) {
            return {
                success: false,
                error: err.message,
                printCount: null,
                printLimit: null,
                status: null,
            };
        }
    } else {
        const release = await mockLockAcquire();
        try {
            const data = getMockData();
            const document = data.documents[code];
            if (!document) {
                return { success: false, error: 'Document not found' };
            }

            const status = document.status || 'active';
            if (status === 'PRINT_LIMIT_REACHED' || status === 'EXPIRED') return { success: false, error: 'Print limit reached' };
            if (status !== 'active') {
                return { success: false, error: `Document not accessible: ${status}` };
            }

            const expiresAt = typeof document.expiresAt === 'string' ? new Date(document.expiresAt) : document.expiresAt;
            if (now >= expiresAt) {
                return { success: false, error: 'Document expired' };
            }

            const printLimit = document.printLimit ?? null;

            // 🔧 CRITICAL FIX: Normalize field names to prevent confusion
            // Always use printCount, fallback to usedPrints for backward compatibility
            const currentPrintCount = document.printCount ?? document.usedPrints ?? 0;

            // 🔍 CRITICAL DEBUG: Log state BEFORE validation
            console.log("🚨 PRINT DEBUG (MOCK):", {
                code,
                before: currentPrintCount,
                limit: printLimit,
                hasPrintCount: !!document.printCount,
                hasUsedPrints: !!document.usedPrints,
                comparison: printLimit !== null ? `${currentPrintCount} >= ${printLimit}` : 'unlimited'
            });

            // ✅ CORRECT VALIDATION: Check current count BEFORE incrementing
            if (printLimit !== null && currentPrintCount >= printLimit) {
                console.log("🚫 PRINT BLOCKED (MOCK): Limit reached - current count already at limit");
                return { success: false, error: 'Print limit reached' };
            }

            // ✅ ALLOW PRINT: Increment count AFTER validation passes
            const newPrintCount = currentPrintCount + 1;

            // 🔍 DEBUG: Log state AFTER increment
            console.log("✅ PRINT ALLOWED (MOCK):", {
                oldCount: currentPrintCount,
                newCount: newPrintCount,
                limit: printLimit,
                willLock: newPrintCount >= printLimit
            });

            // 🔧 CRITICAL FIX: Always update printCount, remove usedPrints to prevent confusion
            document.printCount = newPrintCount;
            document.usedPrints = null; // Remove old field

            // Set limit reached status if this was the last print
            if (printLimit !== null && newPrintCount >= printLimit) {
                document.status = 'EXPIRED'; // STRICT EXPIRY OVERRIDE
                document.expiresAt = now.toISOString();
            }
            data.documents[code] = document;
            saveMockData(data);

            return {
                success: true,
                printCount: newPrintCount,
                printLimit: printLimit ?? null,
                status: document.status || 'active',
            };
        } finally {
            release();
        }
    }
};

/**
 * Atomically increment download count per file and enforce download limit.
 * Returns { success, downloadCount, downloadLimit, status, error }.
 * If all files' download limits are reached: sets document status=EXPIRED, expiresAt=now.
 */
const incrementDownloadCount = async (code, fileId) => {
    const now = new Date();

    if (!isMock) {
        const docRef = db.collection(COLLECTION_NAME).doc(code);
        try {
            const result = await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(docRef);
                if (!doc.exists) throw new Error('Document not found');
                const data = doc.data();

                const status = data.status || 'active';
                if (status === 'EXPIRED') throw new Error('Document expired');
                if (status !== 'active') throw new Error(`Document not accessible: ${status}`);

                const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                if (now >= expiresAt) throw new Error('Document expired');

                const files = data.files || [];
                const fileIndex = files.findIndex(f => f.gcsFileName === fileId || f.id === fileId);
                if (fileIndex === -1) throw new Error('File not found in document');

                const file = files[fileIndex];
                const downloadLimit = file.downloadLimit ?? null;
                const currentDownloadCount = file.downloadCount ?? 0;

                if (downloadLimit !== null && currentDownloadCount >= downloadLimit) {
                    throw new Error('Download limit reached for this file');
                }

                const newDownloadCount = currentDownloadCount + 1;
                files[fileIndex] = { ...file, downloadCount: newDownloadCount };

                const updates = { files };

                // Check if all files with a limit have reached their limit
                // If any file has no limit, or has not reached its limit, the document is still active.
                // We only expire if AT LEAST ONE file has a limit AND ALL files have reached their limits.
                const hasLimitedFiles = files.some(f => f.downloadLimit !== null);
                const allLimitsReached = hasLimitedFiles && files.every(f =>
                    f.downloadLimit !== null && (f.downloadCount ?? 0) >= f.downloadLimit
                );

                if (allLimitsReached) {
                    updates.status = 'EXPIRED';
                    updates.expiresAt = now;
                }

                transaction.update(docRef, updates);

                return {
                    success: true,
                    downloadCount: newDownloadCount,
                    downloadLimit: downloadLimit ?? null,
                    status: updates.status || 'active',
                };
            });
            return result;
        } catch (err) {
            return {
                success: false,
                error: err.message,
                downloadCount: null,
                downloadLimit: null,
                status: null,
            };
        }
    } else {
        const release = await mockLockAcquire();
        try {
            const data = getMockData();
            const document = data.documents[code];
            if (!document) return { success: false, error: 'Document not found' };

            const status = document.status || 'active';
            if (status === 'EXPIRED') return { success: false, error: 'Document expired' };
            if (status !== 'active') return { success: false, error: `Document not accessible: ${status}` };

            const expiresAt = typeof document.expiresAt === 'string' ? new Date(document.expiresAt) : document.expiresAt;
            if (now >= expiresAt) return { success: false, error: 'Document expired' };

            const files = document.files || [];
            const fileIndex = files.findIndex(f => f.gcsFileName === fileId || f.id === fileId);
            if (fileIndex === -1) return { success: false, error: 'File not found in document' };

            const file = files[fileIndex];
            const downloadLimit = file.downloadLimit ?? null;
            const currentDownloadCount = file.downloadCount ?? 0;

            if (downloadLimit !== null && currentDownloadCount >= downloadLimit) {
                return { success: false, error: 'Download limit reached for this file' };
            }

            const newDownloadCount = currentDownloadCount + 1;
            files[fileIndex].downloadCount = newDownloadCount;

            const hasLimitedFiles = files.some(f => f.downloadLimit !== null);
            const allLimitsReached = hasLimitedFiles && files.every(f =>
                f.downloadLimit !== null && (f.downloadCount ?? 0) >= f.downloadLimit
            );

            if (allLimitsReached) {
                document.status = 'EXPIRED';
                document.expiresAt = now.toISOString();
            }

            document.files = files;
            data.documents[code] = document;
            saveMockData(data);

            return {
                success: true,
                downloadCount: newDownloadCount,
                downloadLimit: downloadLimit ?? null,
                status: document.status || 'active',
            };
        } finally {
            release();
        }
    }
};

module.exports = {
    saveMetadata,
    getMetadata,
    deleteMetadata,
    getExpiredDocuments,
    extendExpiry,
    incrementPrintCount,
    incrementDownloadCount,
    isMock
};
