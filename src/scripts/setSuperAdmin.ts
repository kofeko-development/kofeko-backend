/* eslint-disable no-console */
// Create or update a super admin login (email + password) in whatever DATABASE_URL points to.
// Production: bash deploy/aws/with-prod-db.sh npx ts-node --transpile-only src/scripts/setSuperAdmin.ts
import '../config/loadAppSecrets';
import 'dotenv/config';
import readline from 'node:readline';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../common/auth/password';

const prisma = new PrismaClient();

// One reader for the whole run (a reader per question would swallow buffered answers).
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});
let muted = false;
// Echo nothing while a password is typed
(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
  if (!muted) process.stdout.write(s);
};
const pendingLines: string[] = [];
const waiting: ((line: string) => void)[] = [];
rl.on('line', (line) => {
  const next = waiting.shift();
  if (next) next(line);
  else pendingLines.push(line);
});

function ask(question: string, hidden = false): Promise<string> {
  process.stdout.write(question);
  muted = hidden;
  return new Promise((resolve) => {
    const done = (line: string) => {
      muted = false;
      if (hidden) process.stdout.write('\n');
      resolve(line.trim());
    };
    const buffered = pendingLines.shift();
    if (buffered !== undefined) done(buffered);
    else waiting.push(done);
  });
}

async function main(): Promise<void> {
  const host = (process.env.DATABASE_URL ?? '').replace(/^[^@]*@/, '').split('/')[0];
  console.log(`Database: ${host || '(DATABASE_URL not set)'}`);

  const existing = await prisma.superAdmin.findMany({
    select: { email: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Existing super admins: ${existing.map((a) => a.email).join(', ') || 'none'}`);

  const email = (await ask('Super admin email: ')).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email');

  const password = await ask('New password (min 12 chars): ', true);
  if (password.length < 12) throw new Error('Password must be at least 12 characters');
  if ((await ask('Repeat password: ', true)) !== password)
    throw new Error('Passwords do not match');

  const passwordHash = await hashPassword(password);
  const current = await prisma.superAdmin.findUnique({ where: { email } });

  if (current) {
    await prisma.superAdmin.update({ where: { email }, data: { passwordHash } });
    // Same as a password change in the app: sign out everywhere
    await prisma.superAdminSession.deleteMany({ where: { superAdminId: current.id } });
    console.log(`Updated password for ${email} (existing sessions revoked).`);
  } else {
    const firstName = (await ask('First name: ')) || 'Super';
    const lastName = (await ask('Last name: ')) || 'Admin';
    await prisma.superAdmin.create({ data: { email, passwordHash, firstName, lastName } });
    console.log(`Created super admin ${email}.`);
  }

  const others = existing.map((a) => a.email).filter((e) => e !== email);
  if (
    others.length &&
    (
      await ask(`Delete the other super admin account(s) ${others.join(', ')}? (y/N): `)
    ).toLowerCase() === 'y'
  ) {
    const victims = await prisma.superAdmin.findMany({
      where: { email: { in: others } },
      select: { id: true },
    });
    const ids = victims.map((v) => v.id);
    await prisma.superAdminSession.deleteMany({ where: { superAdminId: { in: ids } } });
    await prisma.superAdminPasswordResetToken.deleteMany({ where: { superAdminId: { in: ids } } });
    await prisma.superAdmin.deleteMany({ where: { id: { in: ids } } });
    console.log(`Deleted: ${others.join(', ')}`);
  }
}

main()
  .catch((error) => {
    console.error('Failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
