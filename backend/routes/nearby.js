/**
 * Nearby Shops Routes
 * Isolated module - no interference with document flow
 */

const express = require('express');
const { getNearbyShopsHandler } = require('../controllers/nearbyShops');

const router = express.Router();

// Rate limiting for nearby-shops (in-memory, per IP)
const nearbyRateLimit = new Map();
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_MAX_REQUESTS = 10;

function nearbyRateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'localhost';
    const now = Date.now();
    if (!nearbyRateLimit.has(ip)) {
        nearbyRateLimit.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return next();
    }
    const limit = nearbyRateLimit.get(ip);
    if (now > limit.resetAt) {
        nearbyRateLimit.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return next();
    }
    if (limit.count >= RATE_MAX_REQUESTS) {
        return res.status(429).json({
            error: 'Too many requests. Please wait before searching again.'
        });
    }
    limit.count++;
    next();
}

router.get('/', nearbyRateLimitMiddleware, getNearbyShopsHandler);

module.exports = router;
