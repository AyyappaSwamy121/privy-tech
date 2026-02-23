const http = require('http');
const fs = require('fs');

const logFile = 'test_output.txt';
function log(msg) {
    fs.appendFileSync(logFile, typeof msg === 'object' ? JSON.stringify(msg, null, 2) + '\n' : msg + '\n');
}

log("--- STARTING TEST ---");

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const body = `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
    `Content-Type: text/plain\r\n\r\n` +
    `This is a test file content\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="expiry"\r\n\r\n` +
    `5\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="printLimit"\r\n\r\n` +
    `1\r\n` +
    `--${boundary}--\r\n`;

const postOptions = {
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/upload',
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body)
    }
};

const req = http.request(postOptions, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        log(`Upload Status: ${res.statusCode}`);
        log(`Upload Response: ${data}`);

        try {
            const json = JSON.parse(data);
            const code = json.code;
            log(`Code: ${code}`);

            // Print 1
            const printReq1 = http.request({
                hostname: '127.0.0.1',
                port: 5000,
                path: `/api/document/printed/${code}`,
                method: 'POST'
            }, (res1) => {
                let d1 = '';
                res1.on('data', c => d1 += c);
                res1.on('end', () => {
                    log(`Print 1 Status: ${res1.statusCode}`);
                    log(`Print 1 Response: ${d1}`);

                    // Print 2
                    const printReq2 = http.request({
                        hostname: '127.0.0.1',
                        port: 5000,
                        path: `/api/document/printed/${code}`,
                        method: 'POST'
                    }, (res2) => {
                        let d2 = '';
                        res2.on('data', c => d2 += c);
                        res2.on('end', () => {
                            log(`Print 2 Status: ${res2.statusCode}`);
                            log(`Print 2 Response: ${d2}`);
                        });
                    });
                    printReq2.end();
                });
            });
            printReq1.end();

        } catch (e) {
            log(`Error parsing response: ${e}`);
        }
    });
});

req.on('error', (e) => {
    log(`Request Error: ${e}`);
});

req.write(body);
req.end();
