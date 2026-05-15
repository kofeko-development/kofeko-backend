import Replicate from "replicate";

type ReplicateModelId = `${string}/${string}` | `${string}/${string}:${string}`;

function getToken(): string {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "REPLICATE_API_TOKEN is not set. Add it to .env. Add it to .env (https://replicate.com/account/api-tokens)."
    );
  }
  return token;
}

function getModelRef(): string {
  return process.env.REPLICATE_MODEL?.trim() || "openai/gpt-5.2";
}

/**
 * Replicate `openai/gpt-5.2` returns an array of string chunks; concatenate per schema.
 */
export async function replicateGpt52JsonCompletion(input: {
  system: string;
  user: string;
}): Promise<string> {
  const replicate = new Replicate({ auth: getToken() });
  const model = getModelRef();

  const messages = [
    { role: "system" as const, content: input.system },
    {
      role: "user" as const,
      content: `${input.user}\n\nReturn ONLY a single valid JSON object. No markdown code fences, no commentary before or after.`,
    },
  ];

  const reasoningEffort =
    (process.env.REPLICATE_REASONING_EFFORT?.trim() as
      | "none"
      | "low"
      | "medium"
      | "high"
      | "xhigh"
      | undefined) || "low";

  const verbosity =
    (process.env.REPLICATE_VERBOSITY?.trim() as "low" | "medium" | "high" | undefined) || "low";

  const maxCompletionTokens = Math.min(
    128_000,
    Math.max(1024, Number(process.env.REPLICATE_MAX_COMPLETION_TOKENS) || 16_384)
  );

  const output = await replicate.run(model as ReplicateModelId, {
    input: {
      messages,
      reasoning_effort: reasoningEffort,
      verbosity,
      max_completion_tokens: maxCompletionTokens,
    },
  });

  return await flattenReplicateOutput(output);
}

async function flattenReplicateOutput(output: unknown): Promise<string> {
  if (output == null) {
    return "";
  }
  if (typeof output === "string") {
    return output;
  }
  if (Array.isArray(output)) {
    return output.map((chunk) => (typeof chunk === "string" ? chunk : String(chunk))).join("");
  }
  if (typeof output === "object" && Symbol.asyncIterator in output) {
    let acc = "";
    for await (const chunk of output as AsyncIterable<unknown>) {
      if (typeof chunk === "string") {
        acc += chunk;
      }
    }
    return acc;
  }
  return String(output);
}
