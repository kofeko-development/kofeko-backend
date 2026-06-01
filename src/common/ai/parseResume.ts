import { aiJsonCompletion } from './jsonCompletion';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

const RESUME_PARSER_SYSTEM = `You are an expert AI resume parser.
Extract structured data from the candidate's resume text. Return ONLY valid JSON matching the user's requested schema. No markdown fences.`;

export interface ParsedResumeOnlyResult {
  summary: string;
  skills: string[];
  experience: {
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    highlights?: string[];
  }[];
  education: {
    institution: string;
    degree: string;
    field: string;
    dates: string;
  }[];
  projects: {
    name: string;
    description: string;
    technologies: string[];
  }[];
  hobbies: string[];
}

export async function parseResumeOnly(resumeText: string): Promise<ParsedResumeOnlyResult> {
  const userPrompt = `Resume text:
${resumeText.slice(0, 14000)}

Return a single JSON object with this exact shape:
{
  "summary": "Professional summary or bio extracted or inferred",
  "skills": ["Array of skills"],
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "startDate": "YYYY-MM or string",
      "endDate": "YYYY-MM or Present or string",
      "highlights": ["Array of bullet points"]
    }
  ],
  "education": [
    {
      "institution": "School Name",
      "degree": "Degree Name",
      "field": "Field of study",
      "dates": "Dates attended"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Short description",
      "technologies": ["Array of tech"]
    }
  ],
  "hobbies": ["Array of hobbies/interests"]
}`;

  const raw = await aiJsonCompletion({ system: RESUME_PARSER_SYSTEM, user: userPrompt });

  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  const jsonText = start >= 0 && end > start ? body.slice(start, end + 1) : body;

  try {
    const data = JSON.parse(jsonText);
    return {
      summary: String(data.summary || ''),
      skills: Array.isArray(data.skills) ? data.skills.map(String) : [],
      experience: Array.isArray(data.experience)
        ? data.experience.map((e: any) => ({
            company: String(e?.company || ''),
            role: String(e?.role || e?.title || ''),
            startDate: String(e?.startDate || e?.dates || ''),
            endDate: String(e?.endDate || ''),
            highlights: Array.isArray(e?.highlights) ? e.highlights.map(String) : [],
          }))
        : [],
      education: Array.isArray(data.education)
        ? data.education.map((ed: any) => ({
            institution: String(ed?.institution || ''),
            degree: String(ed?.degree || ''),
            field: String(ed?.field || ''),
            dates: String(ed?.dates || ''),
          }))
        : [],
      projects: Array.isArray(data.projects)
        ? data.projects.map((p: any) => ({
            name: String(p?.name || ''),
            description: String(p?.description || ''),
            technologies: Array.isArray(p?.technologies) ? p.technologies.map(String) : [],
          }))
        : [],
      hobbies: Array.isArray(data.hobbies) ? data.hobbies.map(String) : [],
    };
  } catch {
    throw new AppError('Failed to parse resume JSON structure.', StatusCodes.BAD_GATEWAY, ERROR_CODES.AI_EVALUATION_FAILED);
  }
}
