import { openRouterJsonCompletion } from './openRouter';
import type {
  AnalyzeResult,
  CareerTrajectoryClassification,
  HiringIntelligence,
  InterviewRecommendationClassification,
  JobForEvaluation,
  ScoreDeduction,
} from '../../types/ai/ai.types';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[Document truncated for processing.]`;
}

/** Pull JSON object from model text (handles optional ``` fences and stray prose). */
function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return body.slice(start, end + 1);
  }
  return body;
}

const TRAJECTORY: CareerTrajectoryClassification[] = [
  'high_growth',
  'steady_progression',
  'lateral_movement',
  'potential_stagnation',
];

const RECOMMENDATION: InterviewRecommendationClassification[] = [
  'strong_interview',
  'possible_interview',
  'low_priority',
  'reject',
];

function normalizeCareerTrajectory(s: unknown): CareerTrajectoryClassification {
  const t = String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (TRAJECTORY.includes(t as CareerTrajectoryClassification)) {
    return t as CareerTrajectoryClassification;
  }
  return 'steady_progression';
}

function normalizeInterviewRec(s: unknown): InterviewRecommendationClassification {
  const t = String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (RECOMMENDATION.includes(t as InterviewRecommendationClassification)) {
    return t as InterviewRecommendationClassification;
  }
  return 'possible_interview';
}

function normalizeStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.map((i) => String(i ?? '').trim()).filter(Boolean);
}

function normalizeDeductions(x: unknown): ScoreDeduction[] {
  if (!Array.isArray(x)) return [];
  return x.map((row) => {
    const r = row as Record<string, unknown>;
    const pts = Number(r.pointsDeductedApprox ?? r.points ?? 0);
    return {
      factor: String(r.factor ?? '').trim() || 'Unspecified factor',
      pointsDeductedApprox: Number.isFinite(pts) ? Math.min(100, Math.max(0, pts)) : 0,
      reason: String(r.reason ?? '').trim(),
    };
  });
}

function clampScorePart(n: unknown, fallback: number): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(100, Math.max(0, Math.round(x)));
}

function buildHiringIntelligenceFallback(
  overall: number,
  parsedSummary: string,
  rankingSummary: string,
  roleFitNotes: string,
): HiringIntelligence {
  return {
    applicationSummary:
      rankingSummary || 'Hiring intelligence block was not returned; see ranking summary and scores.',
    candidateSummary: parsedSummary || '—',
    keySkills: [],
    experienceSummary: {
      narrative: 'Use the structured experience array in parsed resume for details.',
    },
    careerTrajectory: {
      classification: 'steady_progression',
      explanation: 'Not enough structured signal in the model response to classify trajectory.',
    },
    relevanceToRole: {
      matchScorePercent: overall,
      strongMatchAreas: [],
      missingCapabilities: [],
    },
    matchScoreBreakdown: {
      theoreticalPerfectScoreNote:
        'A perfect match would show every must-have from the JD with strong, dated evidence and aligned domain experience.',
      deductions: [],
      whyFinalPercentIsNot100:
        roleFitNotes ||
        `Overall fit scored ${overall}/100. See section scores, skill matches, and role fit notes for detail.`,
    },
    keyStrengths: [],
    areasForGrowth: [],
    riskFlags: [],
    interviewRecommendation: {
      classification: overall >= 55 ? 'possible_interview' : 'low_priority',
      reasoning: 'Heuristic fallback because structured recommendation was missing from the model.',
    },
    suggestedInterviewQuestions: [],
  };
}

function normalizeHiringIntelligence(
  raw: unknown,
  overall: number,
  parsedSummary: string,
  rankingSummary: string,
  roleFitNotes: string,
): HiringIntelligence {
  if (!raw || typeof raw !== 'object') {
    return buildHiringIntelligenceFallback(overall, parsedSummary, rankingSummary, roleFitNotes);
  }
  const h = raw as Record<string, unknown>;
  const exp = (h.experienceSummary || {}) as Record<string, unknown>;
  const ct = (h.careerTrajectory || {}) as Record<string, unknown>;
  const rel = (h.relevanceToRole || {}) as Record<string, unknown>;
  const msb = (h.matchScoreBreakdown || {}) as Record<string, unknown>;
  const ir = (h.interviewRecommendation || {}) as Record<string, unknown>;

  const hi: HiringIntelligence = {
    applicationSummary: String(h.applicationSummary ?? '').trim() || rankingSummary,
    candidateSummary: String(h.candidateSummary ?? '').trim() || parsedSummary,
    keySkills: normalizeStringArray(h.keySkills),
    experienceSummary: {
      totalYearsApprox: exp.totalYearsApprox != null ? String(exp.totalYearsApprox).trim() : undefined,
      relevantDomains: normalizeStringArray(exp.relevantDomains),
      notableCompaniesOrIndustries: normalizeStringArray(exp.notableCompaniesOrIndustries),
      keyRolesHeld: normalizeStringArray(exp.keyRolesHeld),
      narrative: exp.narrative != null ? String(exp.narrative).trim() : undefined,
    },
    careerTrajectory: {
      classification: normalizeCareerTrajectory(ct.classification),
      explanation: String(ct.explanation ?? '').trim(),
    },
    relevanceToRole: {
      matchScorePercent: clampScorePart(rel.matchScorePercent ?? rel.matchScore ?? overall, overall),
      strongMatchAreas: normalizeStringArray(rel.strongMatchAreas),
      missingCapabilities: normalizeStringArray(rel.missingCapabilities),
    },
    matchScoreBreakdown: {
      theoreticalPerfectScoreNote: String(
        msb.theoreticalPerfectScoreNote ?? msb.baselineExplanation ?? '',
      ).trim(),
      deductions: normalizeDeductions(msb.deductions),
      whyFinalPercentIsNot100: String(
        msb.whyFinalPercentIsNot100 ?? msb.notesOnPercentReduction ?? '',
      ).trim(),
    },
    keyStrengths: normalizeStringArray(h.keyStrengths),
    areasForGrowth: normalizeStringArray(h.areasForGrowth),
    riskFlags: normalizeStringArray(h.riskFlags),
    interviewRecommendation: {
      classification: normalizeInterviewRec(ir.classification),
      reasoning: String(ir.reasoning ?? '').trim(),
    },
    suggestedInterviewQuestions: normalizeStringArray(h.suggestedInterviewQuestions),
  };

  hi.relevanceToRole.matchScorePercent = overall;

  if (!hi.matchScoreBreakdown.theoreticalPerfectScoreNote) {
    hi.matchScoreBreakdown.theoreticalPerfectScoreNote =
      '100 would imply the resume clearly satisfies the JD must-haves, skill priorities, and shows measurable impact in the right domain.';
  }
  if (!hi.matchScoreBreakdown.whyFinalPercentIsNot100) {
    hi.matchScoreBreakdown.whyFinalPercentIsNot100 =
      roleFitNotes || `Final score ${overall}/100 reflects JD alignment, weighted skills, and experience depth.`;
  }
  if (!hi.careerTrajectory.explanation) {
    hi.careerTrajectory.explanation =
      'See experience timeline in parsed resume for progression detail.';
  }
  if (!hi.interviewRecommendation.reasoning) {
    hi.interviewRecommendation.reasoning =
      'See strengths, gaps, and risk flags above; refine after human review.';
  }

  return hi;
}

const HIRING_ANALYST_SYSTEM = `You are an AI hiring analyst and resume screening expert (similar to evaluation intelligence on advanced hiring platforms).

Audience: recruiters and hiring managers with limited time. They need signal, not generic praise.

Goals:
- Compare the candidate STRICTLY against the job description (JD) and the company's explicit skill priorities.
- Extract hiring insight: strengths, gaps, risks, and whether to interview.
- Do NOT rewrite the resume. Avoid fluff and exaggeration. If the candidate is a weak fit, say so clearly.
- Still output numeric scores and structured resume parsing as required by the JSON schema.

Scoring rules (must coexist with the narrative):
- Hobbies must have minimal influence on the overall score (negligible section weight; overall must not depend on hobbies).
- If the specialty clearly mismatches the JD (e.g. pure ML research vs full-stack web), lower overall noticeably and explain in roleFitNotes and hiringIntelligence.
- Skill rows: use company weights 0–10. Strong evidence (including synonyms, e.g. React vs React.js) → matched true, contribution proportional to weight and evidence strength. Missing → matched false, contribution 0.
- Section scores are integers 0–100. Overall is an integer 0–100, weighted toward skills, experience, and projects for technical roles.
- hiringIntelligence.relevanceToRole.matchScorePercent MUST equal scores.overall (same 0–100 integer).
- hiringIntelligence.matchScoreBreakdown must explain why the score is NOT 100: list concrete deductions (factor, approximate points removed, reason). Approximate points should roughly reconcile with the gap from 100 to overall (not strict math, but directionally honest).
- hiringIntelligence.suggestedInterviewQuestions: 8–10 tailored questions mixing technical depth, real-world problem solving, behavioral, and domain-specific angles to validate strengths and probe risks.

Return ONLY valid JSON matching the user message schema. No markdown fences.`;

export async function analyzeResumeAgainstJD(
  resumeText: string,
  job: JobForEvaluation,
): Promise<AnalyzeResult> {
  const body = truncate(resumeText.trim(), 14_000);

  const skillLines = job.skillWeights
    .map((s) => `- ${s.skill}: company priority weight ${s.weight} out of 10`)
    .join('\n');

  const user = `Job title: ${job.title}

Job description (JD):
${job.description}

Company skill priorities (0–10, higher = more important if present on resume):
${skillLines || '(none listed — infer priorities only from JD text)'}

Resume text:
${body}

Return a single JSON object with this exact shape (all keys required).
Use snake_case strings for careerTrajectory.classification: one of "high_growth", "steady_progression", "lateral_movement", "potential_stagnation".
Use snake_case for interviewRecommendation.classification: one of "strong_interview", "possible_interview", "low_priority", "reject".

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
  "rankingSummary": "2-4 sentences for a recruiter shortlist",
  "hiringIntelligence": {
    "applicationSummary": "TL;DR one or two sentences: identity + fit for THIS role",
    "candidateSummary": "Short professional identity (no fluff)",
    "keySkills": ["most relevant bullets — prioritize JD-aligned skills"],
    "experienceSummary": {
      "totalYearsApprox": "e.g. 5+ or range inferred from resume",
      "relevantDomains": ["string"],
      "notableCompaniesOrIndustries": ["string"],
      "keyRolesHeld": ["string"],
      "narrative": "short paragraph on tenure, domains, and titles"
    },
    "careerTrajectory": {
      "classification": "high_growth | steady_progression | lateral_movement | potential_stagnation",
      "explanation": "brief evidence-based rationale"
    },
    "relevanceToRole": {
      "matchScorePercent": 0,
      "strongMatchAreas": ["string"],
      "missingCapabilities": ["string"]
    },
    "matchScoreBreakdown": {
      "theoreticalPerfectScoreNote": "what a near-100 would require for this JD",
      "deductions": [{"factor":"string","pointsDeductedApprox":0,"reason":"string"}],
      "whyFinalPercentIsNot100": "plain-language summary of reductions vs a perfect match"
    },
    "keyStrengths": ["string"],
    "areasForGrowth": ["string"],
    "riskFlags": ["string"],
    "interviewRecommendation": {
      "classification": "strong_interview | possible_interview | low_priority | reject",
      "reasoning": "brief, honest"
    },
    "suggestedInterviewQuestions": ["8-10 questions"]
  }
}

Include one skillMatches entry for each company priority skill listed above (reuse the same skill spelling). If no priorities were listed, skillMatches may be an empty array.

Enforce: hiringIntelligence.relevanceToRole.matchScorePercent === scores.overall.`;

  const raw = await openRouterJsonCompletion({ system: HIRING_ANALYST_SYSTEM, user });
  if (!raw.trim()) {
    throw new AppError('Empty response from AI provider.', StatusCodes.BAD_GATEWAY, ERROR_CODES.AI_EVALUATION_FAILED);
  }

  const jsonText = extractJsonObject(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new AppError('AI provider returned invalid JSON.', StatusCodes.BAD_GATEWAY, ERROR_CODES.AI_EVALUATION_FAILED);
  }

  return normalizeAnalyzeResult(parsed, job);
}

function normalizeAnalyzeResult(data: unknown, job: JobForEvaluation): AnalyzeResult {
  if (!data || typeof data !== 'object') {
    throw new AppError(
      'AI provider returned invalid analysis payload.',
      StatusCodes.BAD_GATEWAY,
      ERROR_CODES.AI_EVALUATION_FAILED,
    );
  }
  const root = data as Record<string, unknown>;
  const parsedResume = (root.parsedResume || {}) as Record<string, unknown>;
  const scores = (root.scores || {}) as Record<string, unknown>;
  const sections = (scores.sections || {}) as Record<string, unknown>;

  const clamp = (n: unknown, fallback = 0) => {
    const x = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.min(100, Math.max(0, Math.round(x)));
  };

  const skillMatchesRaw = Array.isArray(scores.skillMatches) ? scores.skillMatches : [];

  const skillMatches = skillMatchesRaw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      skill: String(r.skill ?? ''),
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
        evidence: '',
      });
    }
  }

  const overall = clamp(scores.overall, 0);
  const summaryText = String(parsedResume.summary ?? '');
  const rankingSummary = String(root.rankingSummary ?? '');
  const roleFitNotes = String(scores.roleFitNotes ?? '');

  const hiringIntelligence = normalizeHiringIntelligence(
    root.hiringIntelligence,
    overall,
    summaryText,
    rankingSummary,
    roleFitNotes,
  );

  const result: AnalyzeResult = {
    parsedResume: {
      summary: summaryText,
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
      overall,
      sections: {
        education: clamp(sections.education),
        experience: clamp(sections.experience),
        skills: clamp(sections.skills),
        projects: clamp(sections.projects),
        professionalSummary: clamp(
          sections.professionalSummary ?? sections.summary ?? sections.professional_summary,
        ),
        hobbies: clamp(sections.hobbies),
      },
      skillMatches: [...bySkill.values()],
      roleFitNotes,
    },
    rankingSummary,
    hiringIntelligence,
  };

  return result;
}
