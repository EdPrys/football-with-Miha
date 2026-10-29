import { createHash } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Avatars live in an S3-compatible bucket (a Railway Bucket in prod) instead of
// as data URLs in Postgres, so player lists stay small. Railway buckets are
// private: the DB stores `${PUBLIC_API_URL}/avatars/<file>` and that route
// redirects to a presigned bucket URL. Off until all S3_* vars are set — then
// avatars are kept inline as before.
const bucket = process.env.S3_BUCKET;
const publicApiUrl = process.env.PUBLIC_API_URL?.replace(/\/$/, '');

const client =
  bucket &&
  publicApiUrl &&
  process.env.S3_ENDPOINT &&
  process.env.S3_ACCESS_KEY_ID &&
  process.env.S3_SECRET_ACCESS_KEY
    ? new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'auto',
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      })
    : null;

export const avatarStorageEnabled = client !== null;

const PREFIX = 'avatars/';
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/;
/** File names we generate: `<userId>-<hash>.<ext>`. Anything else is rejected by the route. */
export const AVATAR_FILE = /^[A-Za-z0-9_-]+\.(jpg|png|webp)$/;

/**
 * Upload an avatar data URL and return the public URL to store on the user.
 * The content hash is in the file name, so the bytes behind a URL never
 * change and browsers can cache it forever.
 */
export async function storeAvatar(userId: string, dataUrl: string): Promise<string> {
  const match = DATA_URL.exec(dataUrl);
  if (!client || !match) throw new Error('Avatar storage is off or the image is not a data URL');
  const [, type, base64] = match;
  const body = Buffer.from(base64!, 'base64');
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 16);
  const file = `${userId}-${hash}.${type === 'jpeg' ? 'jpg' : type}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: PREFIX + file,
      Body: body,
      ContentType: `image/${type}`,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return `${publicApiUrl}/avatars/${file}`;
}

/** Remove an avatar we stored earlier; links and inline images are left alone. */
export async function deleteStoredAvatar(avatarUrl: string | null): Promise<void> {
  const prefix = `${publicApiUrl}/avatars/`;
  if (!client || !avatarUrl?.startsWith(prefix)) return;
  const file = avatarUrl.slice(prefix.length);
  if (!AVATAR_FILE.test(file)) return;
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: PREFIX + file }));
}

// Signatures are pinned to 6-hour windows so every request in a window gets
// the same URL (and browsers reuse their cached image) instead of a fresh one.
const SIGN_WINDOW_MS = 6 * 60 * 60 * 1000;
const SIGN_TTL_S = 24 * 60 * 60;

/** Short-lived presigned URL for reading one avatar straight from the bucket. */
export async function signedAvatarUrl(file: string): Promise<string | null> {
  if (!client || !AVATAR_FILE.test(file)) return null;
  const signingDate = new Date(Math.floor(Date.now() / SIGN_WINDOW_MS) * SIGN_WINDOW_MS);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: PREFIX + file }), {
    expiresIn: SIGN_TTL_S,
    signingDate,
  });
}
