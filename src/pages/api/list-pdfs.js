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

    // 1) List the user's objects in S3
    const prefix = `${userName}/`;
    const data = await s3.listObjectsV2({
      Bucket: OUTPUT_BUCKET,
      Prefix: prefix,
    }).promise();

    if (!data.Contents || data.Contents.length === 0) {
      return res.status(404).json({ error: 'No files found for the user.' });
    }

    // 2) Create a PassThrough stream that archiver can pipe into
    const passThroughStream = new PassThrough();

    // 3) Create the archive in memory (via archiver) and pipe it to passThrough
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(passThroughStream);

    // 4) Append each file from S3 into the archive
    for (const item of data.Contents) {
      const fileStream = s3
        .getObject({ Bucket: OUTPUT_BUCKET, Key: item.Key })
        .createReadStream();

      const fileName = item.Key.split('/').pop(); // Get the base file name
      archive.append(fileStream, { name: fileName });
    }

    // 5) Finalize the archive (this starts streaming to passThrough)
    archive.finalize();

    // 6) Upload the generated ZIP to S3
    //    We'll store it under e.g. `${userName}/pdfs.zip`
    const zipKey = `${userName}/pdfs.zip`;
    const uploadParams = {
      Bucket: OUTPUT_BUCKET,
      Key: zipKey,
      Body: passThroughStream,
      ContentType: 'application/zip',
    };

    // Wait until the entire upload completes
    await s3.upload(uploadParams).promise();

    // 7) Generate a pre-signed URL for the client to download the ZIP directly
    const signedUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: OUTPUT_BUCKET,
      Key: zipKey,
      Expires: 60, // link valid for 1 minute (adjust as needed)
    });

    // 8) Return the pre-signed URL to the client
    return res.status(200).json({ url: signedUrl });
  } catch (error) {
    console.error('Error creating/serving ZIP:', error);
    return res.status(500).json({ error: 'Error generating ZIP file.' });
  }
});

export default router.handler();
