const http = require('http');
const fs = require('fs');

function uploadFile() {
    return new Promise((resolve, reject) => {
        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
        const fileContent = 'This is a test file content';

        let body = '';
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n`;
        body += `Content-Type: text/plain\r\n\r\n`;
        body += `${fileContent}\r\n`;
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="expiry"\r\n\r\n`;
        body += `5\r\n`;
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="printLimit"\r\n\r\n`;
        body += `1\r\n`;
        body += `--${boundary}--\r\n`;

        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/upload',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Upload failed: ${res.statusCode} ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(body);
        req.end();
    });
}

function verify(code) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:5000/api/document/verify/${code}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else { // 410 is also valid "fail" response for test
                    resolve({ error: true, status: res.statusCode, data: data });
                }
            });
        }).on('error', (e) => reject(e));
    });
}

function print(code) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: `/api/document/printed/${code}`,
            method: 'POST'
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    success: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    data: data ? JSON.parse(data) : {}
                });
            });
        });
        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function run() {
    try {
        console.log("1. Uploading...");
        const uploadRes = await uploadFile();
        console.log("Upload Success:", uploadRes);
        const code = uploadRes.code;

        console.log(`2. Verifying ${code}...`);
        const verify1 = await verify(code);
        console.log("Verify 1:", verify1);
        if (verify1.printLimit !== 1) console.error("❌ Print limit wrong!");

        console.log("3. Printing 1st time...");
        const print1 = await print(code);
        console.log("Print 1 Result:", print1);
        if (!print1.success) console.error("❌ Print 1 failed!");

        console.log("4. Printing 2nd time (should fail)...");
        const print2 = await print(code);
        console.log("Print 2 Result:", print2);

        if (!print2.success && (print2.status === 410 || print2.status === 400)) {
            console.log("✅ Print 2 correctly failed.");
        } else {
            console.error("❌ Print 2 succeeded unexpectedly or wrong error!");
        }

    } catch (e) {
        console.error("Test Failed:", e);
    }
}

run();
