import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { throwLinkedInApiError } from './linkedinApiErrors';

const LI_API = 'https://api.linkedin.com/v2';
export const LINKEDIN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const SUPPORTED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);

export function isLinkedInSupportedImage(mimeType: string, filename: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.svg')) return false;
  if (SUPPORTED_MIMES.has(mimeType.toLowerCase())) return true;
  return (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp')
  );
}

export function normalizeLinkedInImageMime(mimeType: string, filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  const m = mimeType.toLowerCase();
  if (m === 'image/jpg') return 'image/jpeg';
  return m;
}

export async function fetchImageBytes(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
  let res: Response;
  try {
    res = await fetch(imageUrl);
  } catch {
    throw new AppError(
      'Could not fetch share image from storage.',
      StatusCodes.BAD_GATEWAY,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
  }

  if (!res.ok) {
    throw new AppError(
      `Could not fetch share image (${res.status}).`,
      StatusCodes.BAD_GATEWAY,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
  }

  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > LINKEDIN_IMAGE_MAX_BYTES) {
    throw new AppError(
      `Share image is too large (max ${LINKEDIN_IMAGE_MAX_BYTES / (1024 * 1024)} MB).`,
      StatusCodes.REQUEST_TOO_LONG,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  if (buffer.length === 0) {
    throw new AppError('Share image file is empty.', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }

  return { buffer, mimeType: contentType };
}

type RegisterUploadResponse = {
  value?: {
    uploadMechanism?: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'?: { uploadUrl?: string };
    };
    asset?: string;
  };
};

export async function uploadImageToLinkedIn(
  accessToken: string,
  personUrn: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const registerRes = await fetch(`${LI_API}/assets?action=registerUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        owner: personUrn,
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
        supportedUploadMechanism: ['SYNCHRONOUS_UPLOAD'],
      },
    }),
  });

  if (!registerRes.ok) {
    throwLinkedInApiError(await registerRes.text(), 'image', registerRes.status);
  }

  const registerData = (await registerRes.json()) as RegisterUploadResponse;
  const uploadUrl =
    registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']
      ?.uploadUrl;
  const asset = registerData.value?.asset;

  if (!uploadUrl || !asset) {
    throw new AppError(
      'LinkedIn did not return upload URL or asset.',
      StatusCodes.BAD_GATEWAY,
      ERROR_CODES.LINKEDIN_POST_FAILED,
    );
  }

  const body = new Uint8Array(buffer);

  let uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body,
  });

  if (!uploadRes.ok) {
    uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body,
    });
  }

  if (!uploadRes.ok) {
    throwLinkedInApiError(await uploadRes.text(), 'image', uploadRes.status);
  }

  return asset;
}
