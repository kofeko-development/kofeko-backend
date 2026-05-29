import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { encrypt, decrypt } from '../../common/utils/encrypt';
import { generatePostText, generateShareUrl } from '../../common/linkedin/postTextGenerator';
import {
  fetchImageBytes,
  isLinkedInSupportedImage,
  LINKEDIN_IMAGE_MAX_BYTES,
  normalizeLinkedInImageMime,
  uploadImageToLinkedIn,
} from '../../common/linkedin/linkedinImageUpload';
import {
  formatOrgDiscoveryFailure,
  throwLinkedInApiError,
  throwLinkedInNetworkError,
} from '../../common/linkedin/linkedinApiErrors';
import { uploadFile } from '../../common/storage/fileUpload';
import { auditService } from '../audit/audit.service';

const LI_AUTH = 'https://www.linkedin.com/oauth/v2';
const LI_API = 'https://api.linkedin.com/v2';

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function tryReadJwtPayload<T extends object>(jwt?: string): T | null {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1])) as T;
  } catch {
    return null;
  }
}

async function getJobContext(jobId: string, tenantId: string) {
  const job = await prisma.job.findFirst({ where: { id: jobId, tenantId } });
  if (!job) {
    throw new AppError('Job not found', StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { company: { select: { companyName: true } } },
  });
  const companyName = tenant?.company?.companyName ?? tenant?.name ?? 'Our Company';
  const portalUrl = `${env.FRONTEND_URL}/open-positions/${jobId}`;

  return { job, companyName, portalUrl };
}

export async function getPreview(jobId: string, tenantId: string) {
  const { job, companyName, portalUrl } = await getJobContext(jobId, tenantId);
  const postText = generatePostText({ job, companyName, portalUrl });
  const shareUrl = generateShareUrl(portalUrl, postText);
  const imageUrl = job.linkedInImageUrl ?? null;
  return {
    postText,
    shareUrl,
    portalUrl,
    charCount: postText.length,
    charLimit: 3000,
    imageUrl,
    hasShareImage: Boolean(imageUrl),
    hasImage: Boolean(imageUrl),
  };
}

export async function uploadJobShareImage(
  jobId: string,
  tenantId: string,
  file: Express.Multer.File,
) {
  await getJobContext(jobId, tenantId);

  if (!isLinkedInSupportedImage(file.mimetype, file.originalname)) {
    throw new AppError(
      'Unsupported format. Use JPG, PNG, GIF, or WEBP for LinkedIn share images.',
      StatusCodes.UNSUPPORTED_MEDIA_TYPE,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  if (file.size > LINKEDIN_IMAGE_MAX_BYTES) {
    throw new AppError(
      `File is too large (max ${LINKEDIN_IMAGE_MAX_BYTES / (1024 * 1024)} MB).`,
      StatusCodes.REQUEST_TOO_LONG,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const mimeType = normalizeLinkedInImageMime(file.mimetype, file.originalname);
  const imageUrl = await uploadFile(file.buffer, file.originalname, mimeType);

  await prisma.job.update({
    where: { id: jobId },
    data: { linkedInImageUrl: imageUrl },
  });

  return { imageUrl };
}

export async function clearJobShareImage(jobId: string, tenantId: string) {
  await getJobContext(jobId, tenantId);
  await prisma.job.update({
    where: { id: jobId },
    data: { linkedInImageUrl: null },
  });
  return { imageUrl: null };
}

export async function recordCopy(
  jobId: string,
  tenantId: string,
  userId: string,
  postText: string,
) {
  const record = await prisma.linkedInPost.create({
    data: { tenantId, jobId, postedByUserId: userId, postText, tier: 1, status: 'generated' },
  });
  await auditService.createAuditLog({
    tenantId,
    actorId: userId,
    action: 'linkedin_copy',
    entityType: 'job',
    entityId: jobId,
    metadata: { tier: 1 },
  });
  return record;
}

export async function recordShareOpen(
  jobId: string,
  tenantId: string,
  userId: string,
  postText: string,
  shareUrl: string,
) {
  const record = await prisma.linkedInPost.create({
    data: {
      tenantId,
      jobId,
      postedByUserId: userId,
      postText,
      shareUrl,
      tier: 2,
      status: 'shared',
    },
  });
  await auditService.createAuditLog({
    tenantId,
    actorId: userId,
    action: 'linkedin_share_opened',
    entityType: 'job',
    entityId: jobId,
    metadata: { tier: 2 },
  });
  return record;
}

export function getAuthorizationUrl(userId: string, tenantId: string): string {
  const clientId = env.LINKEDIN_CLIENT_ID;
  const redirectUri = env.LINKEDIN_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new AppError(
      'LinkedIn integration is not configured. Add LINKEDIN_CLIENT_ID and LINKEDIN_REDIRECT_URI to .env.',
      StatusCodes.SERVICE_UNAVAILABLE,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
  }
  const state = Buffer.from(JSON.stringify({ userId, tenantId, ts: Date.now() })).toString('base64');
  // w_organization_social = post as company page; rw_organization_admin = list pages you admin (Marketing API).
  const baseScopes = 'openid profile email w_member_social';
  const scope = env.LINKEDIN_REQUEST_ORG_SCOPES
    ? `${baseScopes} w_organization_social rw_organization_admin`
    : baseScopes;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  });
  return `${LI_AUTH}/authorization?${params.toString()}`;
}

const LI_REST_HEADERS = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  'X-Restli-Protocol-Version': '2.0.0',
});

function parseGrantedScopes(scope?: string | null): Set<string> {
  return new Set((scope ?? '').split(/[\s,]+/).filter(Boolean));
}

function parseOrgIdInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urnMatch = trimmed.match(/urn:li:organization:(\d+)/i);
  if (urnMatch) return urnMatch[1];
  const urlMatch = trimmed.match(/linkedin\.com\/company\/(\d+)/i);
  if (urlMatch) return urlMatch[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return null;
}

type OrgDiscoveryResult = {
  linkedInOrgId?: string;
  linkedInOrgName?: string;
  lastError?: string;
};

/** Lists company pages the member admins (requires rw_organization_admin on the access token). */
async function fetchLinkedInOrgForMember(accessToken: string): Promise<OrgDiscoveryResult> {
  const urls = [
    `${LI_API}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organization~(id,localizedName)))`,
    `https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organization~(id,localizedName)))`,
  ];

  let lastError: string | undefined;

  for (const url of urls) {
    try {
      const orgRes = await fetch(url, { headers: LI_REST_HEADERS(accessToken) });
      if (!orgRes.ok) {
        lastError = await orgRes.text();
        continue;
      }
      const orgData = (await orgRes.json()) as {
        elements?: Array<{ 'organization~'?: { id?: number; localizedName?: string } }>;
      };
      const first = orgData.elements?.[0]?.['organization~'];
      if (!first?.id) {
        lastError = 'No administrator company pages returned by LinkedIn.';
        continue;
      }
      return {
        linkedInOrgId: String(first.id),
        linkedInOrgName: first.localizedName,
      };
    } catch (err) {
      lastError = String(err);
    }
  }

  return { lastError };
}

function buildOrgDiscoveryHint(conn: {
  scope: string | null;
  linkedInOrgId: string | null;
}): string {
  const granted = parseGrantedScopes(conn.scope);
  const hasPostScope = granted.has('w_organization_social');
  const hasAdminScope = granted.has('rw_organization_admin') || granted.has('r_organization_admin');

  if (conn.linkedInOrgId && !hasPostScope) {
    return 'A company page is linked, but your token cannot post as the page yet. Enable w_organization_social on your LinkedIn app, set LINKEDIN_REQUEST_ORG_SCOPES=true, restart, and reconnect.';
  }

  if (!env.LINKEDIN_REQUEST_ORG_SCOPES && !hasAdminScope) {
    return 'To auto-detect your company page, set LINKEDIN_REQUEST_ORG_SCOPES=true in backend .env after LinkedIn approves Marketing API scopes (w_organization_social, rw_organization_admin), then reconnect. Or link the page manually below.';
  }

  if (!hasAdminScope) {
    return 'LinkedIn did not grant page-admin permissions (rw_organization_admin). Add the Marketing Developer Platform product on your LinkedIn app, enable org scopes in .env, and reconnect — or link your page ID manually below.';
  }

  if (!conn.linkedInOrgId) {
    return 'You must be an administrator of a LinkedIn Company Page (on linkedin.com, not only Kofeko admin). Use "Refresh pages" or enter your page numeric ID from LinkedIn Admin → Page info.';
  }

  return '';
}

function resolveWillPostAs(conn: {
  postAsOrg: boolean;
  linkedInOrgId: string | null;
  linkedInOrgName: string | null;
  linkedInName: string | null;
}): string {
  if (conn.postAsOrg && conn.linkedInOrgId && conn.linkedInOrgName) {
    return `${conn.linkedInOrgName} (Company Page)`;
  }
  return `${conn.linkedInName ?? 'Personal'} (Personal Profile)`;
}

export async function exchangeCodeForTokens(code: string, state: string) {
  const clientId = env.LINKEDIN_CLIENT_ID;
  const clientSecret = env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = env.LINKEDIN_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new AppError(
      'LinkedIn not configured',
      StatusCodes.SERVICE_UNAVAILABLE,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
  }

  let userId: string;
  let tenantId: string;
  try {
    const d = JSON.parse(Buffer.from(state, 'base64').toString('utf8')) as {
      userId: string;
      tenantId: string;
    };
    userId = d.userId;
    tenantId = d.tenantId;
  } catch {
    throw new AppError('Invalid OAuth state', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }

  const tokenRes = await fetch(`${LI_AUTH}/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!tokenRes.ok) {
    throwLinkedInApiError(await tokenRes.text(), 'oauth', tokenRes.status);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
  };

  let linkedInPersonId: string | undefined;
  let linkedInName: string | undefined;
  let linkedInEmail: string | undefined;

  // Prefer OIDC id_token (if provided) for stable member identity.
  const idTokenPayload = tryReadJwtPayload<{
    sub?: string;
    name?: string;
    email?: string;
    given_name?: string;
    family_name?: string;
  }>(tokens.id_token);
  if (idTokenPayload?.sub) {
    linkedInPersonId = idTokenPayload.sub;
    linkedInName =
      idTokenPayload.name ??
      [idTokenPayload.given_name, idTokenPayload.family_name].filter(Boolean).join(' ') ??
      undefined;
    linkedInEmail = idTokenPayload.email;
  }

  // Fallback: OIDC userinfo endpoint.
  const userInfoRes = await fetch(`${LI_API}/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (userInfoRes.ok) {
    const u = (await userInfoRes.json()) as {
      sub?: string;
      name?: string;
      email?: string;
      given_name?: string;
      family_name?: string;
    };
    if (!linkedInPersonId && u.sub) linkedInPersonId = u.sub;
    if (!linkedInName) {
      linkedInName = u.name ?? [u.given_name, u.family_name].filter(Boolean).join(' ') ?? undefined;
    }
    if (!linkedInEmail && u.email) linkedInEmail = u.email;
  }

  const existing = await prisma.linkedInConnection.findUnique({
    where: { userId },
    select: { linkedInOrgId: true, linkedInOrgName: true, postAsOrg: true },
  });

  const discovered = await fetchLinkedInOrgForMember(tokens.access_token);
  const linkedInOrgId = discovered.linkedInOrgId ?? existing?.linkedInOrgId ?? undefined;
  const linkedInOrgName = discovered.linkedInOrgName ?? existing?.linkedInOrgName ?? undefined;
  const postAsOrg = linkedInOrgId ? (existing?.postAsOrg ?? true) : false;

  const expiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined;

  await prisma.linkedInConnection.upsert({
    where: { userId },
    create: {
      tenantId,
      userId,
      linkedInPersonId,
      linkedInName,
      linkedInEmail,
      linkedInOrgId,
      linkedInOrgName,
      postAsOrg,
      accessToken: encrypt(tokens.access_token),
      accessTokenExpiry: expiry,
      scope: tokens.scope,
    },
    update: {
      linkedInPersonId,
      linkedInName,
      linkedInEmail,
      linkedInOrgId,
      linkedInOrgName,
      postAsOrg,
      accessToken: encrypt(tokens.access_token),
      accessTokenExpiry: expiry,
      scope: tokens.scope,
    },
  });

  await auditService.createAuditLog({
    tenantId,
    actorId: userId,
    action: 'linkedin_connect',
    entityType: 'user',
    entityId: userId,
    metadata: { linkedInName, linkedInOrgName },
  });

  return { userId, tenantId, linkedInOrgName, linkedInName };
}

export async function getConnectionStatus(userId: string) {
  const conn = await prisma.linkedInConnection.findUnique({
    where: { userId },
    select: {
      linkedInName: true,
      linkedInEmail: true,
      linkedInOrgId: true,
      linkedInOrgName: true,
      postAsOrg: true,
      connectedAt: true,
      accessTokenExpiry: true,
      scope: true,
    },
  });
  if (!conn) return { connected: false as const };
  const isExpired = conn.accessTokenExpiry ? conn.accessTokenExpiry < new Date() : false;
  const granted = parseGrantedScopes(conn.scope);
  const hasOrgPage = Boolean(conn.linkedInOrgId);
  const canPostAsCompanyPage = hasOrgPage && granted.has('w_organization_social');
  const orgDiscoveryHint = buildOrgDiscoveryHint({
    scope: conn.scope,
    linkedInOrgId: conn.linkedInOrgId,
  });
  return {
    connected: true as const,
    name: conn.linkedInName,
    email: conn.linkedInEmail,
    connectedAt: conn.connectedAt,
    isExpired,
    orgScopesEnabled: env.LINKEDIN_REQUEST_ORG_SCOPES,
    grantedScopes: [...granted],
    canPostAsCompanyPage,
    hasOrgPage,
    orgName: conn.linkedInOrgName ?? null,
    orgId: conn.linkedInOrgId ?? null,
    postAsOrg: conn.postAsOrg,
    orgDiscoveryHint: orgDiscoveryHint || null,
    willPostAs: resolveWillPostAs({
      postAsOrg: conn.postAsOrg,
      linkedInOrgId: conn.linkedInOrgId,
      linkedInOrgName: conn.linkedInOrgName,
      linkedInName: conn.linkedInName,
    }),
  };
}

export async function refreshOrganizationDiscovery(userId: string) {
  const conn = await prisma.linkedInConnection.findUnique({ where: { userId } });
  if (!conn) {
    throw new AppError(
      'LinkedIn is not connected.',
      StatusCodes.NOT_FOUND,
      ERROR_CODES.LINKEDIN_NOT_CONNECTED,
    );
  }
  const accessToken = decrypt(conn.accessToken);
  const discovered = await fetchLinkedInOrgForMember(accessToken);
  if (!discovered.linkedInOrgId) {
    throw new AppError(
      formatOrgDiscoveryFailure(discovered.lastError),
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.LINKEDIN_ORG_NOT_FOUND,
    );
  }
  await prisma.linkedInConnection.update({
    where: { userId },
    data: {
      linkedInOrgId: discovered.linkedInOrgId,
      linkedInOrgName: discovered.linkedInOrgName,
      postAsOrg: true,
    },
  });
  return {
    orgId: discovered.linkedInOrgId,
    orgName: discovered.linkedInOrgName ?? null,
  };
}

export async function setManualOrganization(
  userId: string,
  orgIdInput: string,
  orgName?: string,
) {
  const conn = await prisma.linkedInConnection.findUnique({ where: { userId } });
  if (!conn) {
    throw new AppError(
      'LinkedIn is not connected.',
      StatusCodes.NOT_FOUND,
      ERROR_CODES.LINKEDIN_NOT_CONNECTED,
    );
  }
  const linkedInOrgId = parseOrgIdInput(orgIdInput);
  if (!linkedInOrgId) {
    throw new AppError(
      'Invalid company page ID. Use the numeric ID from LinkedIn (e.g. 12345678) or a company URL containing /company/12345678.',
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }
  await prisma.linkedInConnection.update({
    where: { userId },
    data: {
      linkedInOrgId,
      linkedInOrgName: orgName?.trim() || conn.linkedInOrgName,
      postAsOrg: true,
    },
  });
  const granted = parseGrantedScopes(conn.scope);
  return {
    orgId: linkedInOrgId,
    orgName: orgName?.trim() || conn.linkedInOrgName,
    canPostAsCompanyPage: granted.has('w_organization_social'),
  };
}

export async function updatePostPreference(userId: string, postAsOrg: boolean) {
  const conn = await prisma.linkedInConnection.findUnique({ where: { userId } });
  if (!conn) {
    throw new AppError(
      'LinkedIn is not connected.',
      StatusCodes.NOT_FOUND,
      ERROR_CODES.LINKEDIN_NOT_CONNECTED,
    );
  }
  if (postAsOrg && !conn.linkedInOrgId) {
    throw new AppError(
      'No company page found. Connect a LinkedIn account that is an admin of a company page.',
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.LINKEDIN_ORG_NOT_FOUND,
    );
  }
  await prisma.linkedInConnection.update({
    where: { userId },
    data: { postAsOrg },
  });
  return { postAsOrg };
}

export async function disconnectLinkedIn(userId: string, tenantId: string) {
  await prisma.linkedInConnection.deleteMany({ where: { userId } });
  await auditService.createAuditLog({
    tenantId,
    actorId: userId,
    action: 'linkedin_disconnect',
    entityType: 'user',
    entityId: userId,
    metadata: {},
  });
}

export async function autoPost(
  jobId: string,
  tenantId: string,
  userId: string,
  options: { customText?: string; postAsOrg?: boolean } = {},
) {
  const { customText, postAsOrg: postAsOrgOverride } = options;
  const conn = await prisma.linkedInConnection.findUnique({ where: { userId } });
  if (!conn) {
    throw new AppError(
      'Your LinkedIn account is not connected. Go to Settings to connect it first.',
      StatusCodes.PRECONDITION_FAILED,
      ERROR_CODES.LINKEDIN_NOT_CONNECTED,
    );
  }
  if (conn.accessTokenExpiry && conn.accessTokenExpiry < new Date()) {
    throw new AppError(
      'Your LinkedIn access token has expired. Please reconnect in Settings.',
      StatusCodes.UNAUTHORIZED,
      ERROR_CODES.LINKEDIN_TOKEN_EXPIRED,
    );
  }
  if (!conn.linkedInPersonId) {
    throw new AppError(
      'LinkedIn profile ID missing. Please reconnect your LinkedIn account in Settings.',
      StatusCodes.PRECONDITION_FAILED,
      ERROR_CODES.LINKEDIN_NOT_CONNECTED,
    );
  }

  const { job, companyName, portalUrl } = await getJobContext(jobId, tenantId);
  if (job.status !== 'open') {
    throw new AppError(
      'Only published (open) jobs can be posted to LinkedIn. Publish the job first.',
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.JOB_NOT_OPEN,
    );
  }

  const postText = customText?.trim()
    ? customText.trim()
    : generatePostText({ job, companyName, portalUrl });

  if (postText.length > 3000) {
    throw new AppError(
      `Post is too long (${postText.length} chars). LinkedIn allows max 3000.`,
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const useOrg = postAsOrgOverride !== undefined ? postAsOrgOverride : conn.postAsOrg;
  const granted = parseGrantedScopes(conn.scope);
  if (useOrg && !conn.linkedInOrgId) {
    throw new AppError(
      'No company page linked. Refresh pages in Settings, link your page ID manually, or post as personal profile.',
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.LINKEDIN_ORG_NOT_FOUND,
    );
  }
  if (useOrg && conn.linkedInOrgId && !granted.has('w_organization_social')) {
    throw new AppError(
      'Your LinkedIn token cannot post as a company page. Set LINKEDIN_REQUEST_ORG_SCOPES=true, get w_organization_social approved on your LinkedIn app, restart the backend, and reconnect.',
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.LINKEDIN_ORG_NOT_FOUND,
    );
  }

  const accessToken = decrypt(conn.accessToken);
  const authorUrn =
    useOrg && conn.linkedInOrgId
      ? `urn:li:organization:${conn.linkedInOrgId}`
      : `urn:li:person:${conn.linkedInPersonId}`;

  const postedAsLabel =
    useOrg && conn.linkedInOrgName ? conn.linkedInOrgName : (conn.linkedInName ?? 'Personal');

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayCount = await prisma.linkedInPost.count({
    where: {
      postedByUserId: userId,
      tier: 3,
      status: 'published',
      postedAt: { gte: todayStart },
    },
  });
  if (todayCount >= 140) {
    throw new AppError(
      'LinkedIn daily post limit reached (150/day). Try again tomorrow.',
      StatusCodes.TOO_MANY_REQUESTS,
      ERROR_CODES.LINKEDIN_RATE_LIMITED,
    );
  }

  const shareImageUrl = job.linkedInImageUrl ?? null;
  let ugcPayload: Record<string, unknown>;

  if (shareImageUrl) {
    const { buffer, mimeType } = await fetchImageBytes(shareImageUrl);
    const assetUrn = await uploadImageToLinkedIn(accessToken, authorUrn, buffer, mimeType);
    ugcPayload = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: postText },
          shareMediaCategory: 'IMAGE',
          media: [{ status: 'READY', media: assetUrn }],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };
  } else {
    ugcPayload = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: postText },
          shareMediaCategory: 'ARTICLE',
          media: [
            {
              status: 'READY',
              originalUrl: portalUrl,
              title: { text: `${job.title} at ${companyName}` },
              description: { text: (job.description ?? '').slice(0, 200) },
            },
          ],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };
  }

  const record = await prisma.linkedInPost.create({
    data: {
      tenantId,
      jobId,
      postedByUserId: userId,
      postText,
      imageUrl: shareImageUrl,
      tier: 3,
      status: 'generated',
      postedAsOrg: useOrg && Boolean(conn.linkedInOrgId),
      postedOrgName: useOrg ? conn.linkedInOrgName : null,
      postedPersonName: conn.linkedInName,
    },
  });

  try {
    const res = await fetch(`${LI_API}/ugcPosts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(ugcPayload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      await prisma.linkedInPost.update({
        where: { id: record.id },
        data: { status: 'failed', errorMessage: errBody },
      });
      throwLinkedInApiError(errBody, 'post', res.status);
    }

    const liPostId = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id') ?? '';
    const postUrl = liPostId ? `https://www.linkedin.com/feed/update/${encodeURIComponent(liPostId)}/` : undefined;

    await prisma.linkedInPost.update({
      where: { id: record.id },
      data: { linkedInPostId: liPostId, postUrl, status: 'published', postedAt: new Date() },
    });

    await auditService.createAuditLog({
      tenantId,
      actorId: userId,
      action: 'linkedin_post',
      entityType: 'job',
      entityId: jobId,
      metadata: {
        tier: 3,
        liPostId,
        postUrl,
        hasImage: Boolean(shareImageUrl),
        postedAs: postedAsLabel,
        postedAsOrg: useOrg && Boolean(conn.linkedInOrgId),
      },
    });

    return {
      postId: liPostId,
      postUrl: postUrl ?? null,
      status: 'published' as const,
      postedAs: postedAsLabel,
      postedAsOrg: useOrg && Boolean(conn.linkedInOrgId),
      postedAt: new Date(),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    await prisma.linkedInPost.update({
      where: { id: record.id },
      data: { status: 'failed', errorMessage: String(error) },
    });
    throwLinkedInNetworkError('post');
  }
}

export async function getJobPostHistory(jobId: string, tenantId: string) {
  return prisma.linkedInPost.findMany({
    where: { jobId, tenantId },
    orderBy: { createdAt: 'desc' },
    include: { postedByUser: { select: { firstName: true, lastName: true } } },
  });
}

export async function getAllTenantPosts(tenantId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.linkedInPost.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        job: { select: { id: true, title: true } },
        postedByUser: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.linkedInPost.count({ where: { tenantId } }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
