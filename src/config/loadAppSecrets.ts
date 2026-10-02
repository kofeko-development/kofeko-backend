// On ECS the whole Secrets Manager secret is injected as one JSON string; explicit env vars win.
// Imported first by env.ts and by standalone scripts (seed) that read process.env directly.
if (process.env.APP_SECRETS_JSON) {
  const secrets = JSON.parse(process.env.APP_SECRETS_JSON) as Record<string, unknown>;
  for (const [key, value] of Object.entries(secrets)) {
    if (process.env[key] === undefined && value != null) process.env[key] = String(value);
  }
  delete process.env.APP_SECRETS_JSON;
}

export {};
