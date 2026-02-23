/**
 * City Shops Controller
 * Handles GET /api/shops-by-city with validation and rate limiting
 */

const { getShopsByCity, CITY_RADIUS_M, MAX_RADIUS_M } = require('../services/locationService');

/**
 * Validate city name input
 */
function validateCityName(city) {
    if (!city || typeof city !== 'string') {
        return { error: 'City name is required.' };
    }
    const trimmed = city.trim();
    if (trimmed.length < 2) {
        return { error: 'City name must be at least 2 characters long.' };
    }
    if (trimmed.length > 100) {
        return { error: 'City name must be less than 100 characters.' };
    }
    // Basic sanitization - remove potentially dangerous characters
    const sanitized = trimmed.replace(/[<>\"']/g, '');
    if (sanitized.length === 0) {
        return { error: 'Invalid city name.' };
    }
    return { city: sanitized };
}

/**
 * Validate and parse radius parameter
 */
function validateRadius(radius) {
    let radiusM = CITY_RADIUS_M;
    if (radius != null && radius !== '') {
        const r = parseInt(radius, 10);
        if (!isNaN(r) && r > 0) {
            radiusM = Math.min(Math.max(r, 100), MAX_RADIUS_M);
        }
    }
    return radiusM;
}

/**
 * GET /api/shops-by-city?city=...&radius=5000
 */
async function getShopsByCityHandler(req, res) {
    const { city, radius } = req.query;

    if (!city) {
        return res.status(400).json({
            error: 'Missing required parameter: city'
        });
    }

    const validated = validateCityName(city);
    if (validated.error) {
        return res.status(400).json({ error: validated.error });
    }

    const radiusM = validateRadius(radius);

    try {
        const shops = await getShopsByCity(validated.city, radiusM);
        // Always return an array, even if empty
        res.json(Array.isArray(shops) ? shops : []);
    } catch (err) {
        console.error('[cityShops] Error:', err.message, err.stack);

        // Handle specific error types
        if (err.message?.includes('not found') || err.message?.includes('City')) {
            return res.status(404).json({
                error: err.message || 'City not found. Please check the spelling and try again.'
            });
        }

        if (err.message?.includes('Rate limit') || err.message?.includes('rate limit')) {
            return res.status(429).json({
                error: err.message || 'Rate limit exceeded. Please try again later.'
            });
        }

        if (err.message?.includes('timed out') || err.message?.includes('timeout') ||
            err.message?.toLowerCase().includes('aborted') ||
            err.message?.includes('504') || err.message?.includes('502') ||
            err.message?.includes('temporarily unavailable') || err.message?.includes('Gateway') ||
            err.message?.includes('buy') || err.message?.includes('busy') ||
            err.message?.includes('fetch failed') || err.message?.includes('ECONN') || err.message?.includes('network')) {
            return res.status(503).json({
                error: 'The map service is temporarily busy. Please try again in a moment.'
            });
        }

        // Generic error
        res.status(500).json({
            error: err.message || 'Failed to fetch shops. Please try again.'
        });
    }
}

module.exports = {
    getShopsByCityHandler
};
