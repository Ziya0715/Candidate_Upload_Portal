import 'server-only';
import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { COURSE_VIDEO_FOLDER, normalizeCandidateId } from './candidateId';
import { httpError } from './http';

const UPLOAD_SECONDS = 60 * 60;
const PLAYBACK_SECONDS = 60 * 60 * 4;

let client;

function spacesError(error) {
  console.error('Spaces request failed:', error?.name, error?.Code || error?.code, error?.message);
  const code = error?.Code || error?.code || error?.name || '';
  let message = 'Could not reach DigitalOcean Spaces. Check the bucket, region, endpoint, and keys.';

  if (code === 'NoSuchBucket') {
    message = 'The Spaces bucket was not found. Check DO_SPACES_BUCKET and DO_SPACES_REGION.';
  } else if (code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch') {
    message = 'DigitalOcean rejected the Spaces key. Check DO_SPACES_KEY and DO_SPACES_SECRET.';
  } else if (code === 'AccessDenied') {
    message = 'The Spaces key does not have permission for this bucket.';
  }

  const wrapped = new Error(message);
  wrapped.status = 502;
  wrapped.publicMessage = message;
  return wrapped;
}

function isMissingObject(error) {
  const status = error?.$metadata?.httpStatusCode;
  const name = error?.name || '';
  return status === 404 || name === 'NotFound' || name === 'NoSuchKey';
}

export function requireSpacesConfig() {
  const bucket = process.env.DO_SPACES_BUCKET?.trim();
  const region = process.env.DO_SPACES_REGION?.trim();
  const endpoint = process.env.DO_SPACES_ENDPOINT?.trim().replace(/\/+$/, '');
  const accessKeyId = process.env.DO_SPACES_KEY?.trim();
  const secretAccessKey = process.env.DO_SPACES_SECRET?.trim();
  const missing = [
    ['DO_SPACES_BUCKET', bucket],
    ['DO_SPACES_REGION', region],
    ['DO_SPACES_ENDPOINT', endpoint],
    ['DO_SPACES_KEY', accessKeyId],
    ['DO_SPACES_SECRET', secretAccessKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw httpError(`Add ${missing.join(', ')} to .env.local, then restart the server.`, 500);
  }

  let host = '';
  try {
    host = new URL(endpoint).host;
  } catch {
    throw httpError('DO_SPACES_ENDPOINT must be a full https address, such as https://nyc3.digitaloceanspaces.com.', 500);
  }

  if (!endpoint.startsWith('https://') || !host.includes(region)) {
    throw httpError(
      'DO_SPACES_ENDPOINT should match DO_SPACES_REGION. Example: region nyc3 and endpoint https://nyc3.digitaloceanspaces.com.',
      500
    );
  }

  if (host.startsWith(`${bucket}.`)) {
    throw httpError(
      'DO_SPACES_ENDPOINT should be the region address only, without the bucket name.',
      500
    );
  }

  return { bucket, endpoint, accessKeyId, secretAccessKey };
}

function getClient() {
  if (client) return client;
  const config = requireSpacesConfig();
  client = new S3Client({
    endpoint: config.endpoint,
    // DigitalOcean asks for this AWS region name. The real location is the endpoint.
    region: 'us-east-1',
    forcePathStyle: false,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Keep checksum headers off the upload URL. Browsers cannot send them.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return client;
}

export function buildStorageKey(candidateId, videoId, name) {
  const checked = normalizeCandidateId(candidateId);
  if (!checked.ok) {
    throw httpError(checked.error);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw httpError('The file name could not be used. Rename the file and try again.');
  }
  return `${COURSE_VIDEO_FOLDER}/${checked.candidateId}/${videoId}-${name}`;
}

export async function createUploadUrl({ storageKey, contentType }) {
  try {
    const { bucket } = requireSpacesConfig();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: contentType,
    });
    return await getSignedUrl(getClient(), command, {
      expiresIn: UPLOAD_SECONDS,
      // The browser must send this same Content-Type header with the file.
      signableHeaders: new Set(['content-type']),
    });
  } catch (error) {
    if (error.status) throw error;
    throw spacesError(error);
  }
}

export async function listStoredObjects(prefix) {
  try {
    const { bucket } = requireSpacesConfig();
    const objects = [];
    let token;

    do {
      const page = await getClient().send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: token,
        })
      );
      objects.push(...(page.Contents || []));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    return objects;
  } catch (error) {
    if (error.status) throw error;
    throw spacesError(error);
  }
}

export async function uploadStoredObject({ storageKey, contentType, body, contentLength }) {
  try {
    const { bucket } = requireSpacesConfig();
    const stream = typeof body?.getReader === 'function' ? Readable.fromWeb(body) : body;
    await getClient().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: stream,
        ContentType: contentType,
        ContentLength: contentLength,
      })
    );
  } catch (error) {
    if (error.status) throw error;
    throw spacesError(error);
  }
}

export async function statObject(storageKey) {
  try {
    const { bucket } = requireSpacesConfig();
    return await getClient().send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      })
    );
  } catch (error) {
    if (isMissingObject(error)) return null;
    if (error.status) throw error;
    throw spacesError(error);
  }
}

export async function deleteStoredObject(storageKey) {
  try {
    const { bucket } = requireSpacesConfig();
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      })
    );
  } catch (error) {
    if (error.status) throw error;
    throw spacesError(error);
  }
}

export async function createPlaybackUrl({ storageKey, contentType }) {
  try {
    const { bucket } = requireSpacesConfig();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ResponseContentType: contentType,
    });
    return await getSignedUrl(getClient(), command, { expiresIn: PLAYBACK_SECONDS });
  } catch (error) {
    if (error.status) throw error;
    throw spacesError(error);
  }
}
