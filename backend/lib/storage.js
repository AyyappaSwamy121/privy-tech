const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const isMock = !process.env.GCP_PROJECT_ID || process.env.GCP_PROJECT_ID === 'your-project-id';

let storage;
let bucket;
const mockUploadsPath = path.join(__dirname, '../data/uploads');

if (!isMock) {
    storage = new Storage({
        projectId: process.env.GCP_PROJECT_ID,
    });
    const bucketName = process.env.GCS_BUCKET_NAME || 'privy-print-uploads';
    bucket = storage.bucket(bucketName);
} else {
    console.log('Using Mock GCS (Local Filesystem)');
    if (!fs.existsSync(mockUploadsPath)) {
        fs.mkdirSync(mockUploadsPath, { recursive: true });
    }
}

const uploadFile = async (filePath, destination, mimeType) => {
    if (!isMock) {
        await bucket.upload(filePath, {
            destination,
            metadata: {
                contentType: mimeType,
            },
        });
    } else {
        const destPath = path.join(mockUploadsPath, destination);
        fs.copyFileSync(filePath, destPath);
    }
};

const downloadStream = (fileName) => {
    if (!isMock) {
        return bucket.file(fileName).createReadStream();
    } else {
        const filePath = path.join(mockUploadsPath, fileName);
        return fs.createReadStream(filePath);
    }
};

const deleteFile = async (fileName) => {
    if (!isMock) {
        await bucket.file(fileName).delete();
    } else {
        const filePath = path.join(mockUploadsPath, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
};

module.exports = {
    uploadFile,
    downloadStream,
    deleteFile,
    isMock
};
