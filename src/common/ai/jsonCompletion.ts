import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { replicateGpt52JsonCompletion } from './replicateGpt';

export interface AiJsonCompletionArgs {
  system: string;
  user: string;
  model?: string;
}

/**
 * JSON-oriented LLM completion via Replicate (REPLICATE_API_TOKEN).
 */
export async function aiJsonCompletion(args: AiJsonCompletionArgs): Promise<string> {
  const replicateToken = process.env.REPLICATE_API_TOKEN?.trim();

  if (!replicateToken) {
    throw new AppError(
      'No AI provider configured. Set REPLICATE_API_TOKEN (https://replicate.com/account/api-tokens) in .env.',
      StatusCodes.INTERNAL_SERVER_ERROR,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
  }

  try {
    return await replicateGpt52JsonCompletion({ system: args.system, user: args.user });
  } catch (error) {
    console.error('Replicate AI completion failed:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'AI provider failed. Verify REPLICATE_API_TOKEN is valid and has sufficient credits.',
      StatusCodes.BAD_GATEWAY,
      ERROR_CODES.AI_EVALUATION_FAILED,
    );
  }
}
