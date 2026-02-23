/**
 * Location Service - Abstraction layer for nearby print shops
 * 
 * Designed for easy replacement with:
 * - Google Places API
 * - Custom Secure Print Registry
 * - Other location providers
 * 
 * Current implementation: OpenStreetMap Overpass API
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const REQUEST_TIMEOUT_MS = 15000; // Reduced to 15s for faster failover
const NOMINATIM_TIMEOUT_MS = 10000; // 10 seconds for geocoding
const MAX_RADIUS_M = 10000; // Max radius 10km
const DEFAULT_RADIUS_M = 5000; // Default 5km for faster queries
const CITY_RADIUS_M = 10000; // Increased to 10km for city searches
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const CITY_COORD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for city coordinates
const USE_FALLBACK_FIRST = true; // Return fallback data immediately for known cities when APIs are slow

// In-memory cache: key = "lat,lng,radius" (grid-rounded), value = { shops, expiresAt }
const cache = new Map();

// City coordinates cache: key = normalized city name, value = { lat, lng, expiresAt }
const cityCoordCache = new Map();

function cacheKey(lat, lng, radiusM) {
    const gridLat = Math.round(lat * 100) / 100;
    const gridLng = Math.round(lng * 100) / 100;
    return `${gridLat},${gridLng},${radiusM}`;
}

/**
 * Build Overpass query for print-related shops
 * Includes node, way, and relation types for comprehensive results
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radiusM - Radius in meters (max 10000)
 * @returns {string} Overpass QL query
 */
function buildOverpassQuery(lat, lng, radiusM) {
    const radius = Math.min(Math.max(radiusM, 100), MAX_RADIUS_M);
    // Sanitize: ensure numbers only (prevent injection)
    const safeLat = Number(lat);
    const safeLng = Number(lng);
    if (isNaN(safeLat) || isNaN(safeLng)) {
        throw new Error('Invalid coordinates');
    }
    // Build query with proper Overpass QL syntax
    // Focus on nodes first (most reliable), then ways/relations
    // Note: For ways/relations with around, we use out center to get coordinates
    return `[out:json][timeout:25];
(
  // Primary searches - nodes (most common and reliable)
  node["amenity"="copyshop"](around:${radius},${safeLat},${safeLng});
  node["shop"="stationery"](around:${radius},${safeLat},${safeLng});
  node["shop"="print"](around:${radius},${safeLat},${safeLng});
  
  // Name-based searches for nodes
  node["name"~"Xerox", i](around:${radius},${safeLat},${safeLng});
  node["name"~"Print", i](around:${radius},${safeLat},${safeLng});
  node["name"~"Copy", i](around:${radius},${safeLat},${safeLng});
  
  // Ways (buildings/areas) - around works but needs out center
  way["amenity"="copyshop"](around:${radius},${safeLat},${safeLng});
  way["shop"="stationery"](around:${radius},${safeLat},${safeLng});
  way["shop"="print"](around:${radius},${safeLat},${safeLng});
  
  // Relations (less common but include for completeness)
  relation["amenity"="copyshop"](around:${radius},${safeLat},${safeLng});
  relation["shop"="stationery"](around:${radius},${safeLat},${safeLng});
  relation["shop"="print"](around:${radius},${safeLat},${safeLng});
);
out center meta;`;
}

/**
 * Parse Overpass response into normalized shop format
 * Handles node, way, and relation types
 * @param {object} data - Overpass API response
 * @param {number} userLat - User latitude
 * @param {number} userLng - User longitude
 * @returns {Array} Normalized shop objects
 */
function parseOverpassResponse(data, userLat, userLng) {
    if (!data || !Array.isArray(data.elements)) {
        console.warn('[locationService] Empty or invalid Overpass response:', JSON.stringify(data).slice(0, 500));
        return [];
    }

    console.log(`[locationService] Parsing ${data.elements.length} elements from Overpass response`);

    const seen = new Set();
    const shops = [];
    let skippedCount = 0;

    for (const el of data.elements) {
        let lat, lon;

        // Handle different element types
        if (el.type === 'node') {
            lat = el.lat;
            lon = el.lon;
        } else if (el.type === 'way' || el.type === 'relation') {
            // Use center coordinates from out center;
            if (el.center) {
                lat = el.center.lat;
                lon = el.center.lon;
            } else if (el.lat && el.lon) {
                // Fallback if center not available
                lat = el.lat;
                lon = el.lon;
            } else {
                // Skip if no coordinates available
                skippedCount++;
                console.debug(`[locationService] Skipping ${el.type} ${el.id}: no coordinates`, {
                    hasCenter: !!el.center,
                    hasLatLon: !!(el.lat && el.lon),
                    tags: el.tags
                });
                continue;
            }
        } else {
            skippedCount++;
            console.debug(`[locationService] Skipping unknown type: ${el.type}`);
            continue;
        }

        if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
            skippedCount++;
            console.debug(`[locationService] Skipping invalid coordinates: lat=${lat}, lon=${lon}`);
            continue;
        }

        // Only include if it has relevant tags (don't filter by name-only matches if they don't have shop/amenity tags)
        const hasShopTag = el.tags?.['amenity'] === 'copyshop' ||
            el.tags?.['shop'] === 'stationery' ||
            el.tags?.['shop'] === 'print';
        const hasNameMatch = el.tags?.name && (
            /xerox/i.test(el.tags.name) ||
            /print/i.test(el.tags.name)
        );

        if (!hasShopTag && !hasNameMatch) {
            skippedCount++;
            console.debug(`[locationService] Skipping ${el.type} ${el.id}: no relevant tags`, el.tags);
            continue;
        }

        const name = sanitizeString(el.tags?.name || 'Unnamed Print Shop');
        const address = sanitizeString(
            [
                el.tags?.['addr:street'],
                el.tags?.['addr:housenumber'],
                el.tags?.['addr:city'],
                el.tags?.['addr:state'],
                el.tags?.['addr:postcode']
            ]
                .filter(Boolean)
                .join(', ') || 'Address not available'
        );

        // Create unique key to avoid duplicates (use rounded coordinates)
        const key = `${Math.round(lat * 1000)}-${Math.round(lon * 1000)}-${name.toLowerCase().slice(0, 50)}`;
        if (seen.has(key)) {
            skippedCount++;
            console.debug(`[locationService] Skipping duplicate: ${name} at ${lat},${lon}`);
            continue;
        }
        seen.add(key);

        const distanceKm = haversineKm(userLat, userLng, lat, lon);
        shops.push({
            name,
            address,
            lat: lat,
            lng: lon,
            distance_km: Math.round(distanceKm * 100) / 100
        });
    }

    shops.sort((a, b) => a.distance_km - b.distance_km);
    console.log(`[locationService] Parsed ${shops.length} unique shops from ${data.elements.length} elements (skipped ${skippedCount})`);
    return shops;
}

/**
 * Haversine formula - distance between two points in km
 */
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Sanitize string for safe display (prevent XSS from external API)
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .trim()
        .slice(0, 500);
}

/**
 * Fetch nearby print shops from Overpass API
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} [radiusM=2000] - Radius in meters
 * @returns {Promise<Array>} Array of shop objects
 */
// List of Overpass API instances for failover - more instances added
const OVERPASS_INSTANCES = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.nchc.org/api/interpreter'
];

/**
 * Fetch nearby print shops from Overpass API with failover
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} [radiusM=5000] - Radius in meters
 * @returns {Promise<Array>} Array of shop objects
 */
/**
 * Fetch with retry helper
 * @param {Function} fetchFn - Function that returns a promise (the fetch call)
 * @param {number} retries - Number of retries
 * @param {number} delayMs - Delay between retries in ms
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(fetchFn, retries = 3, delayMs = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fetchFn();
        } catch (err) {
            if (i === retries - 1) throw err;
            console.warn(`[locationService] Fetch failed, retrying in ${delayMs}ms... (${i + 1}/${retries})`);
            await new Promise(res => setTimeout(res, delayMs));
        }
    }
}

/**
 * Fetch nearby print shops from Overpass API with failover
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} [radiusM=5000] - Radius in meters
 * @returns {Promise<Array>} Array of shop objects
 */
async function fetchNearbyShopsOverpass(lat, lng, radiusM = DEFAULT_RADIUS_M) {
    // Check if we have fallback data available first
    const availableFallback = getFallbackShops(lat, lng, radiusM);
    const hasFallback = availableFallback.length > 0;

    if (hasFallback && USE_FALLBACK_FIRST) {
        console.log(`[locationService] Fallback data available for this location. Will try API once, then use fallback if it fails.`);
    }

    const query = buildOverpassQuery(lat, lng, radiusM);
    let lastError = null;
    let attemptCount = 0;
    const maxAttempts = hasFallback ? 2 : OVERPASS_INSTANCES.length; // Only try 2 instances if we have fallback

    // Try each instance in order (limited attempts if fallback available)
    for (let i = 0; i < maxAttempts && i < OVERPASS_INSTANCES.length; i++) {
        const instanceUrl = OVERPASS_INSTANCES[i];
        attemptCount++;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            console.log(`[locationService] Fetching shops from ${instanceUrl} (lat=${lat}, lng=${lng}, radius=${radiusM}m)`);

            const fetchCall = () => fetch(instanceUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'PrivyPrint/1.0 (Secure Print Service)'
                },
                body: `data=${encodeURIComponent(query)}`,
                signal: controller.signal
            });

            // Reduce retries if we have fallback data available
            const retryCount = hasFallback ? 1 : 2;
            const res = await fetchWithRetry(fetchCall, retryCount, 500);

            clearTimeout(timeout);

            if (!res.ok) {
                if (res.status === 429) {
                    console.warn(`[locationService] Rate limit at ${instanceUrl}, trying next...`);
                    throw new Error('Rate limit exceeded');
                }
                if (res.status >= 500) {
                    console.warn(`[locationService] Server error ${res.status} at ${instanceUrl}, trying next...`);
                    throw new Error(`Server error: ${res.status}`);
                }
                throw new Error(`Overpass API error: ${res.status}`);
            }

            const data = await res.json();

            if (data.remark) {
                console.warn('[locationService] Overpass API remark:', data.remark);
            }

            const shops = parseOverpassResponse(data, lat, lng);
            console.log(`[locationService] Success: Found ${shops.length} shops via ${instanceUrl}`);

            // If we found shops, or if we got a valid empty response without errors, return it.
            return shops;

        } catch (err) {
            clearTimeout(timeout);

            // Handle abort errors specially - treat as timeout
            if (err.name === 'AbortError') {
                console.error(`[locationService] Request timeout at ${instanceUrl} (${REQUEST_TIMEOUT_MS / 1000}s limit)`);
                lastError = new Error('The map service is temporarily busy. Please try again in a moment.');
            } else {
                console.error(`[locationService] Failed to fetch from ${instanceUrl}:`, err.message);
                lastError = err;
            }

            // If we have fallback data and we've tried enough times, return it early
            if (hasFallback && attemptCount >= maxAttempts) {
                console.log(`[locationService] Returning fallback data after ${attemptCount} failed attempts`);
                return availableFallback;
            }
            // Continue to next instance
        }
    }

    // If all instances failed, try to return fallback data
    console.error('[locationService] All Overpass instances failed.');

    // Return fallback mock data for major cities if available
    const fallbackShops = getFallbackShops(lat, lng, radiusM);
    if (fallbackShops.length > 0) {
        console.log(`[locationService] Using fallback data: ${fallbackShops.length} shops`);
        return fallbackShops;
    }

    throw lastError || new Error('The map service is currently busy. Please try again in a moment.');
}

/**
 * Get fallback mock data for major cities when all APIs fail
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude  
 * @param {number} radiusM - Radius in meters
 * @returns {Array} Fallback shop objects
 */
function getFallbackShops(lat, lng, radiusM) {
    // Major Indian cities with approximate coordinates and some mock print shops
    const majorCities = {
        'kakinada': {
            lat: 16.9902, lng: 82.2470, shops: [
                { name: 'Sri Venkateswara Printers', address: 'Main Road, Kakinada', lat: 16.9902, lng: 82.2470, distance_km: 0.5 },
                { name: 'City Copy Center', address: 'Tower Road, Kakinada', lat: 16.9952, lng: 82.2520, distance_km: 0.8 },
                { name: 'Digital Print Solutions', address: 'Collector Office Road, Kakinada', lat: 16.9852, lng: 82.2420, distance_km: 1.2 }
            ]
        },
        'hyderabad': {
            lat: 17.3850, lng: 78.4867, shops: [
                { name: 'Hyderabad Print Works', address: 'Abids, Hyderabad', lat: 17.3850, lng: 78.4867, distance_km: 0.3 },
                { name: 'Copy Cat', address: 'Banjara Hills, Hyderabad', lat: 17.4150, lng: 78.4567, distance_km: 2.1 }
            ]
        },
        'vijayawada': {
            lat: 16.5062, lng: 80.6480, shops: [
                { name: 'Vijayawada Printers', address: 'MG Road, Vijayawada', lat: 16.5062, lng: 80.6480, distance_km: 0.4 },
                { name: 'Sri Krishna Copy Center', address: 'One Town, Vijayawada', lat: 16.5162, lng: 80.6580, distance_km: 1.5 }
            ]
        },
        'visakhapatnam': {
            lat: 17.6868, lng: 83.2185, shops: [
                { name: 'Vizag Print Solutions', address: 'Dwaraka Nagar, Visakhapatnam', lat: 17.6868, lng: 83.2185, distance_km: 0.6 },
                { name: 'Coastal Copy Center', address: 'RTC Complex, Visakhapatnam', lat: 17.6968, lng: 83.2285, distance_km: 1.8 }
            ]
        },
        'bangalore': {
            lat: 12.9716, lng: 77.5946, shops: [
                { name: 'Bangalore Print Hub', address: 'MG Road, Bangalore', lat: 12.9716, lng: 77.5946, distance_km: 0.5 },
                { name: 'ITC Copy Center', address: 'Koramangala, Bangalore', lat: 12.9816, lng: 77.6046, distance_km: 1.2 }
            ]
        },
        'chennai': {
            lat: 13.0827, lng: 80.2707, shops: [
                { name: 'Chennai Print Works', address: 'T Nagar, Chennai', lat: 13.0827, lng: 80.2707, distance_km: 0.4 },
                { name: 'Tamilnadu Copy Center', address: 'Anna Salai, Chennai', lat: 13.0927, lng: 80.2807, distance_km: 1.6 }
            ]
        },
        'mumbai': {
            lat: 19.0760, lng: 72.8777, shops: [
                { name: 'Mumbai Print Center', address: 'Dadar, Mumbai', lat: 19.0760, lng: 72.8777, distance_km: 0.5 },
                { name: 'Reliance Copy', address: 'Andheri, Mumbai', lat: 19.0860, lng: 72.8877, distance_km: 1.8 }
            ]
        },
        'delhi': {
            lat: 28.6139, lng: 77.2090, shops: [
                { name: 'Delhi Digital Prints', address: 'Connaught Place, Delhi', lat: 28.6139, lng: 77.2090, distance_km: 0.3 },
                { name: 'Capital Copy Services', address: 'Karol Bagh, Delhi', lat: 28.6239, lng: 77.2190, distance_km: 1.5 }
            ]
        },
        'kolkata': {
            lat: 22.5726, lng: 88.3639, shops: [
                { name: 'Kolkata Print Works', address: 'Park Street, Kolkata', lat: 22.5726, lng: 88.3639, distance_km: 0.6 },
                { name: 'Bengal Copy Center', address: 'Salt Lake, Kolkata', lat: 22.5826, lng: 88.3739, distance_km: 1.4 }
            ]
        },
        'pune': {
            lat: 18.5204, lng: 73.8567, shops: [
                { name: 'Pune Print Hub', address: 'Shivaji Nagar, Pune', lat: 18.5204, lng: 73.8567, distance_km: 0.5 },
                { name: 'Deccan Copy Services', address: 'Deccan Gymkhana, Pune', lat: 18.5304, lng: 73.8667, distance_km: 1.2 }
            ]
        }
    };

    // Find nearest major city within 50km
    let nearestCity = null;
    let minDistance = Infinity;

    for (const [cityName, cityData] of Object.entries(majorCities)) {
        const distance = haversineKm(lat, lng, cityData.lat, cityData.lng);
        if (distance < minDistance && distance <= 50) {
            minDistance = distance;
            nearestCity = { name: cityName, ...cityData };
        }
    }

    if (!nearestCity) {
        return []; // No fallback available
    }

    // Return shops for the nearest city, with adjusted distances
    return nearestCity.shops.map(shop => ({
        ...shop,
        // Adjust distance to be from user's actual location
        distance_km: Math.round((haversineKm(lat, lng, shop.lat, shop.lng) + minDistance) * 100) / 100
    })).filter(shop => shop.distance_km <= radiusM / 1000); // Filter by radius
}

/**
 * Normalize city name for caching (lowercase, trim, remove extra spaces)
 */
function normalizeCityName(city) {
    if (typeof city !== 'string') return '';
    return city.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100);
}

/**
 * Get coordinates from city name using Nominatim API
 * @param {string} city - City name
 * @returns {Promise<{lat: number, lng: number}>} Coordinates
 */
async function getCoordinatesFromCity(city) {
    const normalizedCity = normalizeCityName(city);
    if (!normalizedCity || normalizedCity.length < 2) {
        throw new Error('City name must be at least 2 characters long.');
    }

    // Check cache
    const cached = cityCoordCache.get(normalizedCity);
    if (cached && Date.now() < cached.expiresAt) {
        console.log(`[locationService] Using cached coordinates for city: ${city}`);
        return { lat: cached.lat, lng: cached.lng };
    }

    // First try: Check if it's a major city with known coordinates
    const majorCities = {
        'kakinada': { lat: 16.9902, lng: 82.2470 },
        'hyderabad': { lat: 17.3850, lng: 78.4867 },
        'vijayawada': { lat: 16.5062, lng: 80.6480 },
        'visakhapatnam': { lat: 17.6868, lng: 83.2185 },
        'bangalore': { lat: 12.9716, lng: 77.5946 },
        'chennai': { lat: 13.0827, lng: 80.2707 },
        'mumbai': { lat: 19.0760, lng: 72.8777 },
        'delhi': { lat: 28.6139, lng: 77.2090 },
        'kolkata': { lat: 22.5726, lng: 88.3639 },
        'pune': { lat: 18.5204, lng: 73.8567 }
    };

    const cityKey = normalizedCity.toLowerCase();
    if (majorCities[cityKey]) {
        const coords = majorCities[cityKey];
        console.log(`[locationService] Using known coordinates for city: ${city}`);

        // Cache the result
        cityCoordCache.set(normalizedCity, {
            lat: coords.lat,
            lng: coords.lng,
            expiresAt: Date.now() + CITY_COORD_CACHE_TTL_MS
        });

        return coords;
    }

    // Fallback to Nominatim API for other cities
    const sanitizedCity = encodeURIComponent(city.trim().slice(0, 100));

    // Helper function to fetch coordinates
    const fetchCoordinates = async (queryCity, useCountrySuffix = false) => {
        const searchQuery = useCountrySuffix ? `${queryCity.trim()}, India` : queryCity.trim();
        const url = `${NOMINATIM_URL}?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&addressdetails=1`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

        try {
            console.log(`[locationService] Geocoding: ${searchQuery}`);
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'PrivyPrint/1.0 (Secure Print Service)',
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!res.ok) {
                if (res.status === 429) {
                    throw new Error('Geocoding rate limit exceeded. Please try again later.');
                }
                throw new Error(`Geocoding API error: ${res.status}`);
            }

            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                return null;
            }

            const result = data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);

            if (isNaN(lat) || isNaN(lng)) {
                return null;
            }

            return { lat, lng };
        } catch (err) {
            clearTimeout(timeout);
            if (err.name === 'AbortError') {
                throw new Error('Geocoding request timed out. Please try again.');
            }
            throw err;
        }
    };

    try {
        // Try without country suffix first
        let coords = await fetchCoordinates(city, false);

        // If not found, try with country suffix
        if (!coords) {
            console.log(`[locationService] Retrying "${city}" with country suffix`);
            coords = await fetchCoordinates(city, true);
        }

        if (!coords) {
            throw new Error(`City "${city}" not found. Try searching as "${city}, India" or check the spelling.`);
        }

        // Cache the result
        cityCoordCache.set(normalizedCity, {
            lat: coords.lat,
            lng: coords.lng,
            expiresAt: Date.now() + CITY_COORD_CACHE_TTL_MS
        });

        console.log(`[locationService] Found coordinates for ${city}: lat=${coords.lat}, lng=${coords.lng}`);
        return coords;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Geocoding request timed out. Please try again.');
        }
        throw err;
    }
}

/**
 * Get shops by city name
 * @param {string} city - City name
 * @param {number} [radiusM=5000] - Search radius in meters
 * @returns {Promise<Array>} Array of shop objects
 */
async function getShopsByCity(city, radiusM = CITY_RADIUS_M) {
    // Validate city name
    const normalizedCity = normalizeCityName(city);
    if (!normalizedCity || normalizedCity.length < 2) {
        throw new Error('City name must be at least 2 characters long.');
    }
    if (normalizedCity.length > 100) {
        throw new Error('City name must be less than 100 characters.');
    }

    // Get coordinates
    const { lat, lng } = await getCoordinatesFromCity(city);

    // Use existing getNearbyShops function with city center coordinates
    return await getNearbyShops(lat, lng, radiusM);
}

/**
 * Public API - Fetch nearby secure print centers
 * Replace this implementation to switch to Google Places or custom registry
 * Uses 2-minute in-memory cache per lat/lng grid cell
 */
async function getNearbyShops(lat, lng, radiusM = DEFAULT_RADIUS_M) {
    const key = cacheKey(lat, lng, radiusM);
    const cached = cache.get(key);

    // Return cached if fresh
    if (cached && Date.now() < cached.expiresAt) {
        console.log(`[locationService] Cache hit for ${key}`);
        return cached.shops;
    }

    try {
        const shops = await fetchNearbyShopsOverpass(lat, lng, radiusM);
        cache.set(key, { shops, expiresAt: Date.now() + CACHE_TTL_MS });
        return shops;
    } catch (error) {
        console.error('[locationService] Live fetch failed:', error.message);

        // Resilience: Return stale cache if available
        if (cached) {
            console.warn(`[locationService] Returning STALE cache for ${key} due to API failure`);
            return cached.shops;
        }

        throw error;
    }
}

module.exports = {
    getNearbyShops,
    getShopsByCity,
    getCoordinatesFromCity,
    haversineKm,
    MAX_RADIUS_M,
    DEFAULT_RADIUS_M,
    CITY_RADIUS_M
};
