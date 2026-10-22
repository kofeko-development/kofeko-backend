// Builds the demo candidate pack locally: copies each resume into demo-data/resumes/ and writes
// demo-data/candidates.json with AI-parsed profiles. Then `npm run demo:install` uploads it to the
// demo company, after which the job page's "Demo candidates" button applies them to any open job.
//
//   npm run demo:build -- [--dir=~/Downloads/Resumes]
//
// Who is in the pack comes from demo-data/sources.json: [{ "file": "<pdf in --dir>", "firstName": "", "lastName": "" }].
// Needs REPLICATE_API_TOKEN in .env. demo-data/ is gitignored.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { extractResumeText } from '../common/ai/extractResumeText';
import { aiJsonCompletion } from '../common/ai/jsonCompletion';
import { extractJsonObject } from '../common/ai/extractJsonObject';
import { demoCandidateEmail, type DemoCandidate } from '../common/constants/demoCandidates';

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

// Gitignored: the repo is public and these are real people's resumes
const DEMO_DATA_DIR = path.resolve(__dirname, '../../demo-data');


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const str = (v: unknown) => (typeof v === 'string' && v.trim().toLowerCase() !== 'null' ? v.trim() : '');
const strList = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const url = (v: unknown) => {
  const s = str(v);
  if (!s) return null;
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).toString();
  } catch {
    return null;
  }
};

// Replicate throttles low-credit accounts to ~6 requests/minute, so wait and retry instead of failing
async function aiWithRetry(args: Parameters<typeof aiJsonCompletion>[0]): Promise<string> {
  const logError = console.error;
  for (let attempt = 1; ; attempt++) {
    // The app logs the full provider error (with request headers); keep the terminal readable
    console.error = () => {};
    try {
      return await aiJsonCompletion(args);
    } catch (err) {
      console.error = logError;
      if (attempt >= 8) throw err;
      process.stdout.write(`    AI busy, retrying in 15s (attempt ${attempt}/7)...\n`);
      await sleep(15_000);
    } finally {
      console.error = logError;
    }
  }
}

async function parseProfile(resumeText: string): Promise<Omit<DemoCandidate, 'firstName' | 'lastName' | 'email' | 'resumeFile'>> {
  const raw = await aiWithRetry({
    system:
      'You are an expert AI resume parser. Extract structured data from the resume text. Return ONLY valid JSON matching the requested schema. No markdown fences.',
    user: `Resume text:
${resumeText.slice(0, 14000)}

Return a single JSON object with this exact shape:
{
  "summary": "2-3 sentence professional summary, extracted or inferred",
  "skills": ["Up to 20 key skills, each under 60 characters"],
  "location": "City, Country or null",
  "currentCompany": "Most recent employer or null",
  "yearsOfExperience": 3.5,
  "linkedinUrl": "LinkedIn URL or null",
  "portfolioUrl": "Personal site or GitHub URL or null",
  "experience": [{ "company": "", "role": "", "startDate": "YYYY-MM or string", "endDate": "YYYY-MM or Present", "highlights": [""] }],
  "education": [{ "institution": "", "degree": "", "field": "", "dates": "" }],
  "projects": [{ "name": "", "description": "", "technologies": [""] }],
  "hobbies": [""]
}
yearsOfExperience is the sum of the durations of the jobs listed under experience (paid professional work only, not education),
as a number in years; 0 for students/freshers.`,
  });

  const data = JSON.parse(extractJsonObject(raw)) as Record<string, any>;
  const years = Number(data.yearsOfExperience);
  return {
    summary: str(data.summary),
    skills: [...new Set(strList(data.skills).filter((s) => s.length <= 100))].slice(0, 20),
    location: str(data.location).slice(0, 150) || null,
    currentCompany: str(data.currentCompany).slice(0, 120) || null,
    yearsOfExperience: Number.isFinite(years) && years >= 0 && years <= 60 ? Math.round(years * 10) / 10 : null,
    linkedinUrl: url(data.linkedinUrl),
    portfolioUrl: url(data.portfolioUrl),
    workExperience: (Array.isArray(data.experience) ? data.experience : []).map((e: any) => ({
      company: str(e?.company),
      role: str(e?.role || e?.title),
      startDate: str(e?.startDate),
      endDate: str(e?.endDate),
      highlights: strList(e?.highlights),
    })),
    education: (Array.isArray(data.education) ? data.education : []).map((e: any) => ({
      institution: str(e?.institution),
      degree: str(e?.degree),
      field: str(e?.field),
      dates: str(e?.dates),
    })),
    projects: (Array.isArray(data.projects) ? data.projects : []).map((p: any) => ({
      name: str(p?.name),
      description: str(p?.description),
      technologies: strList(p?.technologies),
    })),
    hobbies: strList(data.hobbies),
  };
}

async function main() {
  const dirArg = process.argv.find((a) => a.startsWith('--dir='))?.slice('--dir='.length);
  const dir = (dirArg ?? path.join(os.homedir(), 'Downloads', 'Resumes')).replace(/^~/, os.homedir());
  const sourcesFile = path.join(DEMO_DATA_DIR, 'sources.json');
  if (!fs.existsSync(sourcesFile)) throw new Error(`Create ${sourcesFile} listing the resumes first.`);
  const RESUMES = JSON.parse(fs.readFileSync(sourcesFile, 'utf8')) as { file: string; firstName: string; lastName: string }[];
  const missing = RESUMES.filter((r) => !fs.existsSync(path.join(dir, r.file)));
  if (missing.length) throw new Error(`Missing in ${dir}: ${missing.map((m) => m.file).join(', ')}`);

  const resumesDir = path.join(DEMO_DATA_DIR, 'resumes');
  fs.mkdirSync(resumesDir, { recursive: true });
  const outFile = path.join(DEMO_DATA_DIR, 'candidates.json');
  // Keep already-parsed entries so a failed run can resume without re-spending AI calls
  const previous: DemoCandidate[] = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : [];

  const pack: DemoCandidate[] = [];
  for (const r of RESUMES) {
    const name = `${r.firstName} ${r.lastName}`;
    const email = demoCandidateEmail(r.firstName, r.lastName);
    const resumeFile = `${r.firstName}_${r.lastName}_Resume.pdf`.replace(/\s+/g, '_');
    const buffer = fs.readFileSync(path.join(dir, r.file));
    fs.writeFileSync(path.join(resumesDir, resumeFile), buffer);

    const cached = previous.find((p) => p.email === email);
    if (cached) {
      pack.push({ ...cached, resumeFile });
      console.log(`= ${name} (already parsed)`);
      continue;
    }
    const profile = await parseProfile(await extractResumeText(buffer, 'application/pdf', r.file));
    pack.push({ firstName: r.firstName, lastName: r.lastName, email, resumeFile, ...profile });
    fs.writeFileSync(outFile, `${JSON.stringify(pack, null, 2)}\n`);
    console.log(`+ ${name}: ${profile.currentCompany ?? '-'}, ${profile.yearsOfExperience ?? '?'} yrs | ${profile.skills.slice(0, 5).join(', ')}`);
  }
  fs.writeFileSync(outFile, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`Wrote ${pack.length} candidates to ${path.relative(process.cwd(), outFile)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
