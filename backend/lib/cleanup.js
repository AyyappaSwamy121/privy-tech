const { getExpiredDocuments, deleteMetadata } = require('./db');
const { deleteFile } = require('./storage');

/**
 * Main cleanup function to be triggered by a Cloud Scheduler cron job.
 * Iterates through expired documents in Firestore and deletes them from GCS and Firestore.
 */
const cleanupExpiredDocuments = async () => {
    console.log('Starting cleanup process...');

    try {
        const expireddocs = await getExpiredDocuments();
        console.log(`Found ${expireddocs.length} expired documents.`);

        for (const doc of expireddocs) {
            console.log(`Deleting document batch: ${doc.code}`);

            // 1. Delete all files in the batch from GCS
            const filesToDelete = doc.files || (doc.gcsFileName ? [{ gcsFileName: doc.gcsFileName }] : []);

            for (const file of filesToDelete) {
                try {
                    await deleteFile(file.gcsFileName);
                    console.log(`Deleted file ${file.gcsFileName} from GCS.`);
                } catch (err) {
                    if (err.code === 404) {
                        console.warn(`File ${file.gcsFileName} not found in GCS.`);
                    } else {
                        console.error(`Failed to delete file ${file.gcsFileName} from GCS:`, err);
                    }
                }
            }

            try {
                // 2. Delete metadata from Firestore
                await deleteMetadata(doc.code);
                console.log(`Deleted metadata for ${doc.code} from Firestore.`);
            } catch (err) {
                console.error(`Failed to delete metadata for ${doc.code}:`, err);
            }
        }

        console.log('Cleanup process completed.');
    } catch (error) {
        console.error('Error during cleanup process:', error);
    }
};

// Export for Cloud Function use
module.exports = { cleanupExpiredDocuments };

// Allow running via command line for manual testing
if (require.main === module) {
    cleanupExpiredDocuments();
}
