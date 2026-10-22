// Uploads the local demo pack (demo-data/, built by `npm run demo:build`) into the demo company through
// the live API. Run once (or again after rebuilding the pack); afterwards the job page's
// "Demo candidates" button applies them to any open job.
//
//   npm run demo:install -- [--api=https://api.kofeko.com/api/v1] [--company=chirag@kofeko.com]
//
// The company password is asked for in the terminal (hidden).
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { DemoCandidate } from '../common/constants/demoCandidates';

const DEMO_DATA_DIR = path.resolve(__dirname, '../../demo-data');

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function askHidden(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
    if (!muted) process.stdout.write(s);
  };
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
    muted = true;
  });
}

async function main() {
  const apiBase = (arg('api') ?? 'https://api.kofeko.com/api/v1').replace(/\/$/, '');
  const companyEmail = arg('company') ?? 'chirag@kofeko.com';
  const packFile = path.join(DEMO_DATA_DIR, 'candidates.json');
  if (!fs.existsSync(packFile)) throw new Error('No demo pack found. Run `npm run demo:build` first.');
  const pack = JSON.parse(fs.readFileSync(packFile, 'utf8')) as DemoCandidate[];

  const password = await askHidden(`Password for ${companyEmail}: `);
  const loginRes = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: companyEmail, password }),
  });
  const login = (await loginRes.json().catch(() => ({}))) as { data?: { accessToken?: string }; message?: string };
  if (!loginRes.ok || !login.data?.accessToken) throw new Error(`Login failed: ${login.message ?? loginRes.status}`);

  const form = new FormData();
  form.append('pack', JSON.stringify(pack));
  for (const c of pack) {
    const buffer = fs.readFileSync(path.join(DEMO_DATA_DIR, 'resumes', c.resumeFile));
    form.append('resumes', new Blob([buffer], { type: 'application/pdf' }), c.resumeFile);
  }

  console.log(`Uploading ${pack.length} demo candidates to ${apiBase} ...`);
  const res = await fetch(`${apiBase}/jobs/demo-candidates/install`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.data.accessToken}` },
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { installed?: number }; message?: string };
  if (!res.ok) throw new Error(`Install failed: ${res.status} ${body.message ?? ''}`);
  console.log(`Installed ${body.data?.installed} demo candidates for ${companyEmail}.`);
  console.log('Open any open job → "Demo candidates" → "Import demo candidates".');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
