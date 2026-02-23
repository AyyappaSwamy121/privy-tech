/**
 * Nearby Shops Controller
 * Handles GET /api/nearby-shops with validation and rate limiting
 */

const { getNearbyShops, MAX_RADIUS_M } = require('../services/locationService');

/**
 * Validate and parse lat/lng from query
 */
function validateCoordinates(lat, lng, radius) {
    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || numLat < -90 || numLat > 90) {
        return { error: 'Invalid latitude. Must be between -90 and 90.' };
    }
    if (isNaN(numLng) || numLng < -180 || numLng > 180) {
        return { error: 'Invalid longitude. Must be between -180 and 180.' };
    }
    let radiusM = 5000; // Updated default to 5km
    if (radius != null && radius !== '') {
        const r = parseInt(radius, 10);
        if (!isNaN(r) && r > 0) {
            radiusM = Math.min(r, MAX_RADIUS_M);
        }
    }
    return { lat: numLat, lng: numLng, radiusM };
}

/**
 * GET /api/nearby-shops?lat=...&lng=...[&radius=2000]
 */
async function getNearbyShopsHandler(req, res) {
    const { lat, lng, radius } = req.query;
    if (lat == null || lng == null) {
        return res.status(400).json({
            error: 'Missing required parameters: lat and lng'
        });
    }
    const validated = validateCoordinates(lat, lng, radius);
    if (validated.error) {
        return res.status(400).json({ error: validated.error });
    }
    try {
        const shops = await getNearbyShops(validated.lat, validated.lng, validated.radiusM);
        // Always return an array, even if empty
        res.json(Array.isArray(shops) ? shops : []);
    } catch (err) {
        console.error('[nearbyShops] Error:', err.message, err.stack);

        // Return 503 Service Unavailable for timeout/network/gateway errors
        if (err.message?.includes('timed out') || err.message?.includes('timeout') ||
            err.message?.toLowerCase().includes('aborted') ||
            err.message?.includes('504') || err.message?.includes('502') ||
            err.message?.includes('temporarily unavailable') || err.message?.includes('Gateway') ||
            err.message?.includes('busy')) {
            return res.status(503).json({
                error: 'The map service is temporarily busy. Please try again in a moment.'
            });
        }

        const status = err.message?.includes('Rate limit') ? 429 : 500;
        res.status(status).json({
            error: err.message || 'Failed to fetch nearby shops. Please try again.'
        });
    }
}

module.exports = {
    getNearbyShopsHandler
};
