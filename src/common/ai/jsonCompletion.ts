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

/**
 * JSON-oriented LLM completion: prefers Replicate when REPLICATE_API_TOKEN is set,
 * otherwise OpenRouter (OPEN_ROUTE). Matches production env validation and Jest mocks.
 */
export async function aiJsonCompletion(args: AiJsonCompletionArgs): Promise<string> {
  const replicateToken = process.env.REPLICATE_API_TOKEN?.trim();
  if (replicateToken) {
    return replicateGpt52JsonCompletion({ system: args.system, user: args.user });
  }

  const openRouteKey = process.env.OPEN_ROUTE?.trim();
  if (openRouteKey) {
    return openRouterJsonCompletion(args);
  }

  throw new AppError(
    'No AI provider configured. Set REPLICATE_API_TOKEN (https://replicate.com/account/api-tokens) or OPEN_ROUTE (https://openrouter.ai/keys) in .env.',
    StatusCodes.INTERNAL_SERVER_ERROR,
    ERROR_CODES.INTERNAL_SERVER_ERROR,
  );
}
