import { createRouter } from 'next-connect';
import AWS from 'aws-sdk';
import archiver from 'archiver';

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET;
const router = createRouter();

router.get(async (req, res) => {
  try {
    const userName = req.query.userName || req.body.userName || 'UnknownUser';
    if (!userName) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const prefix = `${userName}/`;
    const data = await s3
      .listObjectsV2({ Bucket: OUTPUT_BUCKET, Prefix: prefix })
      .promise();

    if (!data.Contents || data.Contents.length === 0) {
      return res.status(404).json({ error: 'No files found for the user.' });
    }

    // Set response headers for a ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="pdfs.zip"');

    // Create a zip archive and pipe it to the response
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const item of data.Contents) {
      const fileStream = s3
        .getObject({ Bucket: OUTPUT_BUCKET, Key: item.Key })
        .createReadStream();
      const fileName = item.Key.split('/').pop(); // Get the base file name
      archive.append(fileStream, { name: fileName });
    }

    // Finalize the archive (triggers the response download)
    archive.finalize();

    // Handle stream errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ error: 'Error creating ZIP archive.' });
    });
  } catch (error) {
    console.error('Error retrieving files:', error);
    res.status(500).json({ error: 'Error retrieving files.' });
  }
});

export default router.handler();
