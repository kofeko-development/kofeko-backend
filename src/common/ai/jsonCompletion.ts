import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { openRouterJsonCompletion } from './openRouter';
import { replicateGpt52JsonCompletion } from './replicateGpt';

export interface AiJsonCompletionArgs {
  system: string;
  user: string;
  model?: string;
}

function isRecoverableProviderError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.statusCode >= 500 || error.statusCode === StatusCodes.UNAUTHORIZED || error.statusCode === StatusCodes.PAYMENT_REQUIRED;
  }
  if (error instanceof Error) {
    return /401|402|403|429|5\d{2}|unauthorized|payment|credit|rate limit/i.test(error.message);
  }
  return true;
}

/**
 * JSON-oriented LLM completion: prefers Replicate when REPLICATE_API_TOKEN is set,
 * then falls back to OpenRouter (OPEN_ROUTE) if Replicate fails.
 */
export async function aiJsonCompletion(args: AiJsonCompletionArgs): Promise<string> {
  const replicateToken = process.env.REPLICATE_API_TOKEN?.trim();
  const openRouteKey = process.env.OPEN_ROUTE?.trim();

  if (replicateToken) {
    try {
      return await replicateGpt52JsonCompletion({ system: args.system, user: args.user });
    } catch (error) {
      console.error('Replicate AI completion failed:', error);
      if (openRouteKey && isRecoverableProviderError(error)) {
        console.warn('Falling back to OpenRouter for AI completion.');
        return openRouterJsonCompletion(args);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'AI provider failed. Verify REPLICATE_API_TOKEN or set a valid OPEN_ROUTE key.',
        StatusCodes.BAD_GATEWAY,
        ERROR_CODES.AI_EVALUATION_FAILED,
      );
    }
  }

  if (openRouteKey) {
    return openRouterJsonCompletion(args);
  }

  throw new AppError(
    'No AI provider configured. Set REPLICATE_API_TOKEN (https://replicate.com/account/api-tokens) or OPEN_ROUTE (https://openrouter.ai/keys) in .env.',
    StatusCodes.INTERNAL_SERVER_ERROR,
    ERROR_CODES.INTERNAL_SERVER_ERROR,
  );
}
