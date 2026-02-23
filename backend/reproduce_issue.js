const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const API_BASE = 'http://localhost:5000';

async function runTest() {
    try {
        console.log('--- STARTING PRINT LIMIT TEST ---');

        // 1. Upload a file with printLimit = 1
        console.log('1. Uploading file with printLimit = 1...');
        const form = new FormData();
        // Create a dummy file if not exists
        if (!fs.existsSync('test.txt')) {
            fs.writeFileSync('test.txt', 'test content');
        }
        form.append('file', fs.createReadStream('test.txt'));
        form.append('expiry', '5');
        form.append('printLimit', '1');

        const uploadRes = await axios.post(`${API_BASE}/api/upload`, form, {
            headers: form.getHeaders()
        });

        const code = uploadRes.data.code;
        console.log(`✅ Upload Success. Code: ${code}, Limit: ${uploadRes.data.printLimit}`);

        // 2. Verify Document
        console.log(`2. Verifying document ${code}...`);
        const verifyRes = await axios.get(`${API_BASE}/api/document/verify/${code}`);
        console.log(`🔍 Verify Response:`, verifyRes.data);
        if (verifyRes.data.printLimit !== 1) {
            console.error('❌ Error: Print limit not set to 1');
            return;
        }

        // 3. First Print (Should Succeed)
        console.log(`3. Attempting 1st Print...`);
        try {
            const print1Res = await axios.post(`${API_BASE}/api/document/printed/${code}`);
            console.log(`✅ Print 1 Success:`, print1Res.data);
            if (print1Res.data.printCount !== 1) console.warn('⚠️ Warning: printCount is not 1');
        } catch (e) {
            console.error('❌ Print 1 Failed:', e.response ? e.response.data : e.message);
            return;
        }

        // 4. Second Print (Should Fail)
        console.log(`4. Attempting 2nd Print (Should Fail)...`);
        try {
            await axios.post(`${API_BASE}/api/document/printed/${code}`);
            console.error('❌ Error: Print 2 Succeeded but should have failed!');
        } catch (e) {
            if (e.response && (e.response.status === 410)) {
                console.log(`✅ Print 2 Correctly Failed: ${e.response.status} - ${JSON.stringify(e.response.data)}`);
                if (e.response.data.error !== 'Document expired') {
                    console.error('❌ Error: Expected "Document expired" but got', e.response.data.error);
                }
            } else {
                console.error('❌ Print 2 Failed with unexpected error:', e.message);
            }
        }

        // 5. Verify Final Status
        console.log(`5. Verifying final status...`);
        try {
            const finalVerify = await axios.get(`${API_BASE}/api/document/verify/${code}`);
            console.log('Final Verify Result:', finalVerify.data);
        } catch (e) {
            if (e.response && (e.response.status === 410)) {
                console.log(`✅ Final Verify Correctly Failed expectedly: ${e.response.status} - ${JSON.stringify(e.response.data)}`);
            } else {
                console.log('Final verify error:', e.message);
            }
        }

        console.log('--- TEST COMPLETE ---');

    } catch (error) {
        console.error('Test Failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

runTest();
