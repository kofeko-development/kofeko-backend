/**
 * Send a test password-reset email via the staff forgot-password flow.
 *
 * Usage:
 *   npx ts-node scripts/send-test-password-reset-email.ts --email user@company.com --tenant acme
 *
 * Requires a real staff user for the given tenant (anti-enumeration: no error if missing).
 */
import dotenv from 'dotenv';
dotenv.config();

import { authService } from '../src/services/auth/auth.service';
import { prisma } from '../src/config/prisma';

async function main() {
  const args = process.argv.slice(2);
  const emailIdx = args.indexOf('--email');
  const tenantIdx = args.indexOf('--tenant');

  const email = emailIdx >= 0 ? args[emailIdx + 1] : undefined;
  const tenantSlug = tenantIdx >= 0 ? args[tenantIdx + 1] : undefined;

  if (!email) {
    console.error('Usage: npx ts-node scripts/send-test-password-reset-email.ts --email <address> [--tenant <slug>]');
    process.exit(1);
  }

  console.log(`RESEND_EFFECTIVE_FROM: ${process.env.RESEND_FROM ?? '(dev default onboarding@resend.dev if unset)'}`);
  console.log(`Sending forgot-password to: ${email}${tenantSlug ? ` (tenant: ${tenantSlug})` : ''}`);

  await authService.forgotPassword({ email, tenantSlug });

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase() },
    include: { tenant: true },
  });

  if (!user) {
    console.log('Note: No user found for this email — email was not sent (anti-enumeration).');
  } else {
    console.log(`User found: ${user.email} (tenant: ${user.tenant?.slug ?? user.tenantId})`);
    console.log('Check inbox/spam and Resend Activity log.');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
