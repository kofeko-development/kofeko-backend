import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

interface OpenRouterArgs {
  system: string;
  user: string;
  model?: string;
}

export async function openRouterJsonCompletion(args: OpenRouterArgs): Promise<string> {
  const defaultModel =
    process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.0-flash-001';
  const { system, user, model = defaultModel } = args;

  const apiKey = process.env.OPEN_ROUTE;
  if (!apiKey) {
    throw new AppError(
      'OPEN_ROUTE API key is missing. Please add it to your environment variables.',
      StatusCodes.INTERNAL_SERVER_ERROR,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
  }

  const referer =
    process.env.APP_FRONTEND_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    'https://kofeko.com';

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': referer,
      'X-Title': 'Kofeko',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const status = response.status;
    
    if (status === 402) {
      throw new AppError(
        `OpenRouter requires payment/credits. Please add credits and try again.\n\n${errorText}`,
        StatusCodes.PAYMENT_REQUIRED,
        ERROR_CODES.AI_PAYMENT_REQUIRED,
      );
    }

    throw new AppError(
      `OpenRouter error: ${status} - ${errorText}`,
      StatusCodes.BAD_GATEWAY,
      ERROR_CODES.AI_EVALUATION_FAILED,
    );
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new AppError(
      'OpenRouter returned an empty response.',
      StatusCodes.BAD_GATEWAY,
      ERROR_CODES.AI_EVALUATION_FAILED,
    );
  }

  return content;
}
