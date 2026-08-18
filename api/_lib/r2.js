const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

let client;

function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey || !process.env.R2_BUCKET) {
    throw new Error('R2 configuration missing');
  }
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey }
    });
  }
  return client;
}

function safePart(value, fallback) {
  return String(value || fallback || 'file')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || fallback || 'file';
}

function keyForUpload(channel, fileName) {
  const ext = String(fileName || '').split('.').pop() || 'bin';
  const base = `${Date.now()}_${Math.random().toString(36).slice(2)}.${safePart(ext, 'bin')}`;
  return `${safePart(channel, 'mike')}/${base}`;
}

async function uploadObject({ key, body, contentType }) {
  await r2Client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream'
  }));
}

async function deleteObject(key) {
  await r2Client().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key
  }));
}

async function getObject(key) {
  return r2Client().send(new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key
  }));
}

async function signedUrl(key, fileName) {
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ResponseContentDisposition: fileName ? `inline; filename="${safePart(fileName, 'receipt')}"` : undefined
    }),
    { expiresIn: 300 }
  );
}

module.exports = { keyForUpload, uploadObject, deleteObject, getObject, signedUrl };
