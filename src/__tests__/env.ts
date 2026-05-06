import dotenv from 'dotenv';

// Runs before any test files are loaded.
process.env.NODE_ENV = 'test';

// Load .env so DATABASE_URL (and other required vars) are available in process.env
// before the rest of the test bootstrap runs.
dotenv.config();

// Guard against accidentally running destructive integration tests against a dev/prod database.
if (!process.env.DATABASE_URL_TEST) {
  if (process.env.ALLOW_DATABASE_URL_FOR_TESTS === 'true') {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is missing (cannot run tests)');
    }
    // Intentionally use DATABASE_URL (destructive) only when explicitly allowed.
    process.env.DATABASE_URL_TEST = process.env.DATABASE_URL;
  } else {
    throw new Error(
      'DATABASE_URL_TEST is required for tests (refusing to run against DATABASE_URL). Set ALLOW_DATABASE_URL_FOR_TESTS=true to override.',
    );
  }
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

// Required by env schema
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-test-refresh-secret';
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';
process.env.APP_FRONTEND_URL ??= 'http://localhost:3000';

// Email is mocked in tests, but env parsing still requires these.
process.env.SMTP_HOST ??= 'smtp.test';
process.env.SMTP_PORT ??= '587';
process.env.SMTP_USER ??= 'test';
process.env.SMTP_PASS ??= 'test';
process.env.SMTP_FROM ??= 'noreply@test.local';
