import { createRouter } from 'next-connect';
import AWS from 'aws-sdk';
import { PassThrough } from 'stream';
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
    const data = await s3.listObjectsV2({
      Bucket: OUTPUT_BUCKET,
      Prefix: prefix,
    }).promise();

    if (!data.Contents || data.Contents.length === 0) {
      return res.status(404).json({ error: 'No files found for the user.' });
    }

    const passThroughStream = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(passThroughStream);

    for (const item of data.Contents) {
      const fileStream = s3
        .getObject({ Bucket: OUTPUT_BUCKET, Key: item.Key })
        .createReadStream();

      const fileName = item.Key.split('/').pop();
      archive.append(fileStream, { name: fileName });
    }

    archive.finalize();

    const zipKey = `${userName}/pdfs.zip`;
    const uploadParams = {
      Bucket: OUTPUT_BUCKET,
      Key: zipKey,
      Body: passThroughStream,
      ContentType: 'application/zip',
    };

    await s3.upload(uploadParams).promise();

    const signedUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: OUTPUT_BUCKET,
      Key: zipKey,
      Expires: 60,
    });

    return res.status(200).json({ url: signedUrl });
  } catch (error) {
    console.error('Error creating/serving ZIP:', error);
    return res.status(500).json({ error: 'Error generating ZIP file.' });
  }
});

export default router.handler();
