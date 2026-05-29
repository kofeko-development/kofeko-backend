import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export type LinkedInErrorContext = 'post' | 'image' | 'oauth' | 'org';

export type LinkedInErrorDetails = {
  linkedInCode?: string;
  linkedInStatus?: number;
  existingPostUrn?: string;
};

type ParsedLinkedInBody = {
  message?: string;
  status?: number;
  code?: string;
  inputCodes: string[];
  oauthError?: string;
  oauthDescription?: string;
};

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function collectInputCodes(errorDetails: unknown): string[] {
  if (!errorDetails || typeof errorDetails !== 'object') return [];
  const inputErrors = (errorDetails as { inputErrors?: unknown }).inputErrors;
  if (!Array.isArray(inputErrors)) return [];
  return inputErrors
    .map((e) => (e && typeof e === 'object' ? (e as { code?: string }).code : undefined))
    .filter((c): c is string => Boolean(c));
}

function parseBody(text: string): ParsedLinkedInBody {
  const raw = tryParseJson(text);
  const inputCodes: string[] = [];
  let message: string | undefined;
  let status: number | undefined;
  let code: string | undefined;
  let oauthError: string | undefined;
  let oauthDescription: string | undefined;

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.message === 'string') message = obj.message;
    if (typeof obj.status === 'number') status = obj.status;
    if (typeof obj.code === 'string') code = obj.code;
    if (typeof obj.error === 'string') oauthError = obj.error;
    if (typeof obj.error_description === 'string') oauthDescription = obj.error_description;
    inputCodes.push(...collectInputCodes(obj.errorDetails));

    const serviceErrorCode = (obj.serviceErrorCode as { code?: string } | undefined)?.code;
    if (serviceErrorCode) code = serviceErrorCode;
  }

  const upper = text.toUpperCase();
  for (const known of [
    'DUPLICATE_POST',
    'INVALID_ACCESS_TOKEN',
    'EXPIRED_ACCESS_TOKEN',
    'REVOKED_ACCESS_TOKEN',
    'INSUFFICIENT_PERMISSION',
    'UNAUTHORIZED',
    'RATE_LIMIT',
    'THROTTLE',
  ]) {
    if (upper.includes(known) && !inputCodes.includes(known)) inputCodes.push(known);
  }

  if (oauthError && !inputCodes.includes(oauthError.toUpperCase())) {
    inputCodes.push(oauthError.toUpperCase());
  }

  return { message, status, code, inputCodes, oauthError, oauthDescription };
}

function extractDuplicateShareUrn(text: string): string | undefined {
  const match = text.match(/urn:li:share:\d+/i);
  return match?.[0];
}

function primaryCode(parsed: ParsedLinkedInBody): string | undefined {
  return parsed.inputCodes[0] ?? parsed.code ?? parsed.oauthError?.toUpperCase();
}

function userMessageForPost(code: string | undefined, parsed: ParsedLinkedInBody): string {
  switch (code) {
    case 'DUPLICATE_POST':
      return 'LinkedIn already has a post with the same content for this job. Change the text, use a different share image, or wait before posting again.';
    case 'INVALID_ACCESS_TOKEN':
    case 'EXPIRED_ACCESS_TOKEN':
    case 'REVOKED_ACCESS_TOKEN':
      return 'Your LinkedIn session expired. Disconnect and reconnect in Settings → Integrations.';
    case 'INSUFFICIENT_PERMISSION':
    case 'UNAUTHORIZED':
    case 'UNAUTHORIZED_SCOPE':
      return 'Your LinkedIn app does not have permission for this action. Reconnect after org scopes are approved, or post as your personal profile.';
    case 'RATE_LIMIT':
    case 'THROTTLE':
      return 'LinkedIn is rate-limiting posts. Wait a few minutes and try again.';
    default:
      if (parsed.message?.includes('duplicate') || parsed.message?.includes('Duplicate')) {
        return 'LinkedIn rejected this as a duplicate post. Edit the text or image and try again.';
      }
      if (parsed.oauthDescription) return parsed.oauthDescription;
      if (parsed.message && parsed.message.length < 280 && !parsed.message.startsWith('{')) {
        return parsed.message;
      }
      return 'LinkedIn could not publish this post. Check your connection and try again.';
  }
}

function userMessageForImage(code: string | undefined): string {
  switch (code) {
    case 'INVALID_ACCESS_TOKEN':
    case 'EXPIRED_ACCESS_TOKEN':
    case 'REVOKED_ACCESS_TOKEN':
      return 'Your LinkedIn session expired. Reconnect in Settings → Integrations.';
    case 'INSUFFICIENT_PERMISSION':
    case 'UNAUTHORIZED':
      return 'LinkedIn did not allow image upload for this account. Reconnect or post without a custom image.';
    default:
      return 'LinkedIn could not upload the share image. Try a smaller JPG/PNG or post without an image.';
  }
}

function isOrgScopeRejection(parsed: ParsedLinkedInBody): boolean {
  const text = `${parsed.oauthError ?? ''} ${parsed.oauthDescription ?? ''} ${parsed.message ?? ''}`.toLowerCase();
  return (
    parsed.oauthError === 'unauthorized_scope' ||
    parsed.inputCodes.includes('UNAUTHORIZED_SCOPE') ||
    text.includes('w_organization_social') ||
    text.includes('rw_organization_admin') ||
    text.includes('not authorized for your application')
  );
}

function userMessageForOAuth(parsed: ParsedLinkedInBody): string {
  if (parsed.oauthError === 'access_denied') {
    return 'You cancelled LinkedIn authorization. Try connecting again when ready.';
  }
  if (isOrgScopeRejection(parsed)) {
    return 'Company-page permissions are not enabled on your LinkedIn app yet. In backend .env set LINKEDIN_REQUEST_ORG_SCOPES=false, restart the server, then connect again (personal profile posting will work). After Community Management API is approved, set it back to true and reconnect.';
  }
  if (parsed.oauthError === 'invalid_grant') {
    return 'Authorization expired or was already used. Start Connect LinkedIn again.';
  }
  if (parsed.oauthDescription) return parsed.oauthDescription;
  return 'LinkedIn authorization failed. Check redirect URL and app credentials, then try again.';
}

function userMessageForOrg(parsed: ParsedLinkedInBody): string {
  if (parsed.inputCodes.includes('INSUFFICIENT_PERMISSION') || parsed.status === 403) {
    return 'LinkedIn did not allow listing company pages. Enable Community Management API and org scopes, then reconnect — or link your page ID manually.';
  }
  if (parsed.message && parsed.message.length < 300 && !parsed.message.startsWith('{')) {
    return parsed.message;
  }
  return 'Could not load company pages from LinkedIn. Link your page ID manually or reconnect with the right permissions.';
}

function resolveHttpStatus(code: string | undefined, linkedInStatus?: number): number {
  if (code === 'DUPLICATE_POST') return StatusCodes.CONFLICT;
  if (code === 'RATE_LIMIT' || code === 'THROTTLE') return StatusCodes.TOO_MANY_REQUESTS;
  if (
    code === 'INVALID_ACCESS_TOKEN' ||
    code === 'EXPIRED_ACCESS_TOKEN' ||
    code === 'REVOKED_ACCESS_TOKEN' ||
    linkedInStatus === 401
  ) {
    return StatusCodes.UNAUTHORIZED;
  }
  if (
    code === 'INSUFFICIENT_PERMISSION' ||
    code === 'UNAUTHORIZED' ||
    code === 'UNAUTHORIZED_SCOPE' ||
    linkedInStatus === 403
  ) {
    return StatusCodes.FORBIDDEN;
  }
  if (linkedInStatus === 422 || linkedInStatus === 400) return StatusCodes.BAD_REQUEST;
  if (linkedInStatus === 429) return StatusCodes.TOO_MANY_REQUESTS;
  return StatusCodes.BAD_GATEWAY;
}

function resolveErrorCode(code: string | undefined, context: LinkedInErrorContext): string {
  switch (code) {
    case 'DUPLICATE_POST':
      return ERROR_CODES.LINKEDIN_DUPLICATE_POST;
    case 'INVALID_ACCESS_TOKEN':
    case 'EXPIRED_ACCESS_TOKEN':
    case 'REVOKED_ACCESS_TOKEN':
      return ERROR_CODES.LINKEDIN_TOKEN_EXPIRED;
    case 'RATE_LIMIT':
    case 'THROTTLE':
      return ERROR_CODES.LINKEDIN_RATE_LIMITED;
    case 'INSUFFICIENT_PERMISSION':
    case 'UNAUTHORIZED':
    case 'UNAUTHORIZED_SCOPE':
      return ERROR_CODES.LINKEDIN_SCOPE_DENIED;
    default:
      if (context === 'oauth') return ERROR_CODES.LINKEDIN_OAUTH_FAILED;
      if (context === 'org') return ERROR_CODES.LINKEDIN_ORG_NOT_FOUND;
      return ERROR_CODES.LINKEDIN_POST_FAILED;
  }
}

/** Turn a LinkedIn API error body into an AppError with a safe user message. */
export function throwLinkedInApiError(
  responseBody: string,
  context: LinkedInErrorContext,
  httpStatusFromResponse?: number,
): never {
  const parsed = parseBody(responseBody);
  const code = primaryCode(parsed);
  const linkedInStatus = parsed.status ?? httpStatusFromResponse;

  let userMessage: string;
  switch (context) {
    case 'image':
      userMessage = userMessageForImage(code);
      break;
    case 'oauth':
      userMessage = userMessageForOAuth(parsed);
      break;
    case 'org':
      userMessage = userMessageForOrg(parsed);
      break;
    default:
      userMessage = userMessageForPost(code, parsed);
  }

  const details: LinkedInErrorDetails = {
    linkedInCode: code,
    linkedInStatus,
  };
  if (code === 'DUPLICATE_POST') {
    details.existingPostUrn = extractDuplicateShareUrn(responseBody);
  }

  throw new AppError(
    userMessage,
    resolveHttpStatus(code, linkedInStatus),
    resolveErrorCode(code, context),
    details,
  );
}

export function throwLinkedInNetworkError(context: LinkedInErrorContext): never {
  const message =
    context === 'oauth'
      ? 'Could not reach LinkedIn to complete authorization. Check your network and try again.'
      : 'Could not reach LinkedIn. Check your network and try again.';
  throw new AppError(message, StatusCodes.BAD_GATEWAY, ERROR_CODES.LINKEDIN_NETWORK_ERROR);
}

/** Short message for org discovery failures (no throw). */
export function formatOrgDiscoveryFailure(rawError?: string): string {
  if (!rawError?.trim()) {
    return 'No company pages found. Confirm you are a LinkedIn page admin or link the page ID manually.';
  }
  try {
    const parsed = parseBody(rawError);
    return userMessageForOrg(parsed);
  } catch {
    if (rawError.length < 280 && !rawError.trim().startsWith('{')) return rawError;
    return 'Could not load company pages from LinkedIn. Link your page ID manually or reconnect with org permissions.';
  }
}

/** Map OAuth callback query errors to user-facing redirect reasons. */
export function mapOAuthCallbackError(error: string, description?: string): string {
  const parsed = parseBody(
    JSON.stringify({ error, error_description: description ?? '' }),
  );
  return userMessageForOAuth(parsed);
}
