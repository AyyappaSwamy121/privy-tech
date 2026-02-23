const { getNearbyShops } = require('./services/locationService');

async function test() {
    console.log('Testing Overpass API connectivity...');
    try {
        // Coordinates for a known location (e.g., Mumbai or user's likely location)
        // Using a generic lat/lng to test connectivity
        const lat = 19.0760;
        const lng = 72.8777;

        console.log(`Fetching shops for ${lat}, ${lng}...`);
        const shops = await getNearbyShops(lat, lng, 5000);
        console.log('Success!', shops);
    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

test();
