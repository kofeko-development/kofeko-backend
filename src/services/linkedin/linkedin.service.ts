import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { encrypt, decrypt } from '../../common/utils/encrypt';
import { generatePostText, generateShareUrl } from '../../common/linkedin/postTextGenerator';
import { auditService } from '../audit/audit.service';

const LI_AUTH = 'https://www.linkedin.com/oauth/v2';
const LI_API = 'https://api.linkedin.com/v2';

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
  return { postText, shareUrl, portalUrl, charCount: postText.length, charLimit: 3000 };
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
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'w_member_social r_liteprofile',
    state,
  });
  return `${LI_AUTH}/authorization?${params.toString()}`;
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
    throw new AppError(
      `LinkedIn token exchange failed: ${await tokenRes.text()}`,
      StatusCodes.BAD_GATEWAY,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
  };

  let linkedInPersonId: string | undefined;
  let linkedInName: string | undefined;

  const profileRes = await fetch(`${LI_API}/me?projection=(id,localizedFirstName,localizedLastName)`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (profileRes.ok) {
    const p = (await profileRes.json()) as {
      id?: string;
      localizedFirstName?: string;
      localizedLastName?: string;
    };
    linkedInPersonId = p.id;
    linkedInName = [p.localizedFirstName, p.localizedLastName].filter(Boolean).join(' ');
  }

  const expiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined;

  await prisma.linkedInConnection.upsert({
    where: { userId },
    create: {
      tenantId,
      userId,
      linkedInPersonId,
      linkedInName,
      accessToken: encrypt(tokens.access_token),
      accessTokenExpiry: expiry,
      scope: tokens.scope,
    },
    update: {
      linkedInPersonId,
      linkedInName,
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
    metadata: { linkedInName },
  });

  return { userId, tenantId };
}

export async function getConnectionStatus(userId: string) {
  const conn = await prisma.linkedInConnection.findUnique({
    where: { userId },
    select: { linkedInName: true, connectedAt: true, accessTokenExpiry: true },
  });
  if (!conn) return { connected: false };
  const isExpired = conn.accessTokenExpiry ? conn.accessTokenExpiry < new Date() : false;
  return {
    connected: true,
    name: conn.linkedInName,
    connectedAt: conn.connectedAt,
    isExpired,
  };
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
  customText?: string,
) {
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

  const accessToken = decrypt(conn.accessToken);
  const authorUrn = `urn:li:person:${conn.linkedInPersonId}`;

  const ugcPayload = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: postText },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const record = await prisma.linkedInPost.create({
    data: { tenantId, jobId, postedByUserId: userId, postText, tier: 3, status: 'generated' },
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
      throw new AppError(
        `LinkedIn rejected the post: ${errBody}`,
        StatusCodes.BAD_GATEWAY,
        ERROR_CODES.LINKEDIN_POST_FAILED,
      );
    }

    const resData = (await res.json()) as { id?: string };
    const liPostId = resData.id ?? res.headers.get('x-linkedin-id') ?? '';
    const postUrl = liPostId ? `https://www.linkedin.com/feed/update/${liPostId}` : undefined;

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
      metadata: { tier: 3, liPostId, postUrl },
    });

    return { postId: liPostId, postUrl: postUrl ?? null, status: 'published' as const };
  } catch (error) {
    if (error instanceof AppError) throw error;
    await prisma.linkedInPost.update({
      where: { id: record.id },
      data: { status: 'failed', errorMessage: String(error) },
    });
    throw new AppError(
      'Could not reach LinkedIn. Please try again.',
      StatusCodes.BAD_GATEWAY,
      ERROR_CODES.LINKEDIN_POST_FAILED,
    );
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
