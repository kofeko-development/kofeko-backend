import { replicateGpt52JsonCompletion } from "./replicateGpt";
import type { AnalyzeResult, JobForEvaluation } from "../../types/ai/ai.types";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../errors/AppError";
import { ERROR_CODES } from "../errors/errorCodes";

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[Document truncated for processing.]`;
}

/** Pull JSON object from model text (handles optional ``` fences and stray prose). */
function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return body.slice(start, end + 1);
  }
  return body;
}

export async function analyzeResumeAgainstJD(
  resumeText: string,
  job: JobForEvaluation
): Promise<AnalyzeResult> {
  const body = truncate(resumeText.trim(), 14_000);

  const skillLines = job.skillWeights
    .map((s) => `- ${s.skill}: company priority weight ${s.weight} out of 10`)
    .join("\n");

  const system = `You are an expert technical recruiter assistant. You extract structured data from resumes and score fit against a job description (JD) and explicit company skill priorities.

Rules:
- Hobbies must have minimal influence on the overall score (negligible weight in sections; overall score should not depend on hobbies).
- If the candidate's background is clearly a different specialty than the JD (e.g. pure ML research vs full-stack web), overall score should be noticeably lower and explain why in roleFitNotes.
- Skill rows: company provided weights 0-10. If the resume shows strong evidence of a skill (including synonyms, e.g. React vs React.js), set matched true and contribution proportional to weight and strength of evidence. If missing, matched false and contribution 0.
- Section scores are 0-100 integers. Overall is 0-100 integer, weighted toward skills, experience, and projects for technical roles.
- Return ONLY valid JSON matching the schema described in the user message. No markdown fences.`;

  const user = `Job title: ${job.title}

Job description (JD):
${job.description}

Company skill priorities (0-10, higher = more important if present on resume):
${skillLines || "(none listed — infer priorities only from JD text)"}

Resume text:
${body}

Return a single JSON object with this exact shape (all keys required):
{
  "parsedResume": {
    "summary": "string",
    "skills": ["string"],
    "experience": [{"company":"string","title":"string","dates":"string","highlights":["string"]}],
    "education": [{"institution":"string","degree":"string","field":"string","dates":"string"}],
    "projects": [{"name":"string","description":"string","technologies":["string"]}],
    "hobbies": ["string"]
  },
  "scores": {
    "overall": 0,
    "sections": {
      "education": 0,
      "experience": 0,
      "skills": 0,
      "projects": 0,
      "professionalSummary": 0,
      "hobbies": 0
    },
    "skillMatches": [{"skill":"string","weight":0,"matched":true,"contribution":0,"evidence":"short quote or empty"}],
    "roleFitNotes": "string"
  },
  "rankingSummary": "2-4 sentences for a recruiter shortlist"
}

Include one skillMatches entry for each company priority skill listed above (reuse the same skill spelling). If no priorities were listed, skillMatches may be an empty array.`;

  const raw = await replicateGpt52JsonCompletion({ system, user });
  if (!raw.trim()) {
    throw new AppError("Empty response from AI provider.", StatusCodes.BAD_GATEWAY, ERROR_CODES.AI_EVALUATION_FAILED);
  }

  const jsonText = extractJsonObject(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new AppError("AI provider returned invalid JSON.", StatusCodes.BAD_GATEWAY, ERROR_CODES.AI_EVALUATION_FAILED);
  }

  return normalizeAnalyzeResult(parsed, job);
}

function normalizeAnalyzeResult(data: unknown, job: JobForEvaluation): AnalyzeResult {
  if (!data || typeof data !== "object") {
    throw new AppError(
      "AI provider returned invalid analysis payload.",
      StatusCodes.BAD_GATEWAY,
      ERROR_CODES.AI_EVALUATION_FAILED,
    );
  }
  const root = data as Record<string, unknown>;
  const parsedResume = (root.parsedResume || {}) as Record<string, unknown>;
  const scores = (root.scores || {}) as Record<string, unknown>;
  const sections = (scores.sections || {}) as Record<string, unknown>;

  const clamp = (n: unknown, fallback = 0) => {
    const x = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.min(100, Math.max(0, Math.round(x)));
  };

  const skillMatchesRaw = Array.isArray(scores.skillMatches) ? scores.skillMatches : [];

  const skillMatches = skillMatchesRaw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      skill: String(r.skill ?? ""),
      weight: Math.min(10, Math.max(0, Math.round(Number(r.weight) || 0))),
      matched: Boolean(r.matched),
      contribution: Math.min(100, Math.max(0, Number(r.contribution) || 0)),
      evidence: r.evidence != null ? String(r.evidence) : undefined,
    };
  });

  const bySkill = new Map(skillMatches.map((m) => [m.skill.toLowerCase(), m]));
  for (const sw of job.skillWeights) {
    const key = sw.skill.toLowerCase();
    if (!bySkill.has(key)) {
      bySkill.set(key, {
        skill: sw.skill,
        weight: sw.weight,
        matched: false,
        contribution: 0,
        evidence: "",
      });
    }
  }

  const result: AnalyzeResult = {
    parsedResume: {
      summary: String(parsedResume.summary ?? ""),
      skills: Array.isArray(parsedResume.skills)
        ? parsedResume.skills.map((s) => String(s))
        : [],
      experience: Array.isArray(parsedResume.experience)
        ? parsedResume.experience.map((e) => {
            const ex = e as Record<string, unknown>;
            return {
              company: ex.company != null ? String(ex.company) : undefined,
              title: ex.title != null ? String(ex.title) : undefined,
              dates: ex.dates != null ? String(ex.dates) : undefined,
              highlights: Array.isArray(ex.highlights)
                ? ex.highlights.map((h) => String(h))
                : undefined,
            };
          })
        : [],
      education: Array.isArray(parsedResume.education)
        ? parsedResume.education.map((ed) => {
            const e = ed as Record<string, unknown>;
            return {
              institution: e.institution != null ? String(e.institution) : undefined,
              degree: e.degree != null ? String(e.degree) : undefined,
              field: e.field != null ? String(e.field) : undefined,
              dates: e.dates != null ? String(e.dates) : undefined,
            };
          })
        : [],
      projects: Array.isArray(parsedResume.projects)
        ? parsedResume.projects.map((p) => {
            const pr = p as Record<string, unknown>;
            return {
              name: pr.name != null ? String(pr.name) : undefined,
              description: pr.description != null ? String(pr.description) : undefined,
              technologies: Array.isArray(pr.technologies)
                ? pr.technologies.map((t) => String(t))
                : undefined,
            };
          })
        : [],
      hobbies: Array.isArray(parsedResume.hobbies)
        ? parsedResume.hobbies.map((h) => String(h))
        : [],
    },
    scores: {
      overall: clamp(scores.overall, 0),
      sections: {
        education: clamp(sections.education),
        experience: clamp(sections.experience),
        skills: clamp(sections.skills),
        projects: clamp(sections.projects),
        professionalSummary: clamp(
          sections.professionalSummary ?? sections.summary ?? sections.professional_summary
        ),
        hobbies: clamp(sections.hobbies),
      },
      skillMatches: [...bySkill.values()],
      roleFitNotes: String(scores.roleFitNotes ?? ""),
    },
    rankingSummary: String(root.rankingSummary ?? ""),
  };

  return result;
}
