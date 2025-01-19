import { createRouter } from 'next-connect';
import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
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
    // ...existing code...
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

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const localPaths = await Promise.all(
      data.Contents.map(async (item) => {
        const fileData = await s3
          .getObject({ Bucket: OUTPUT_BUCKET, Key: item.Key })
          .promise();
        const fileName = path.basename(item.Key);
        const localFilePath = path.join(tmpDir, fileName);
        fs.writeFileSync(localFilePath, fileData.Body);
        return localFilePath;
      })
    );

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="pdfs.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    localPaths.forEach((file) => {
      archive.file(file, { name: path.basename(file) });
    });

    archive.finalize();

    setTimeout(() => {
      localPaths.forEach((file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      });
    }, 120000);
  } catch (error) {
    return res.status(500).json({ error: 'Error retrieving files.' });
  }
});

export default router.handler();