import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import { aiJsonCompletion } from '../../common/ai/jsonCompletion';
import { extractJsonObject } from '../../common/ai/extractJsonObject';

export type JdCreatorInput = {
  jobTitle: string;
  requirements: string;
  location?: string;
  jobType?: string;
  employmentType?: string;
};

export type SkillWeight = {
  skill: string;
  weight: number;
  yearsOfExperience: number;
};

export const jdCreatorService = {
  async generateJobDescription(input: JdCreatorInput): Promise<{ html: string; plainText: string; suggestedSkills: SkillWeight[] }> {
    const jobTitle = input.jobTitle.trim();
    const requirements = input.requirements.trim();

    if (!jobTitle) {
      throw new AppError('Job Title is required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const systemPrompt = `You are a professional HR and Job Description writer. 
Generate a high-quality job description in TWO formats:
1. HTML format for a premium web preview.
2. Structured plain text for a standard textarea (use clear headers and bullet points with dashes).

Your response MUST be a valid JSON object with the following structure:
{
  "html": "string (the job description in professional HTML, using Tailwind classes if possible or clean semantic tags. Use <h2> for headers, <ul>/<li> for lists, and <p> for paragraphs)",
  "plainText": "string (the structured plain text version with clear headers and bullet points)",
  "suggestedSkills": [
    { "skill": "string", "weight": number (0-10), "yearsOfExperience": number }
  ]
}

- For weights: 10 is essential/mandatory, 1-3 is preferred/nice-to-have.
- For years: Provide a realistic number based on the seniority usually associated with the title.
- If requirements are provided, use them to customize the description and skills. If requirements are empty, generate a comprehensive description based on the title, job type (${input.jobType}), and employment type (${input.employmentType}).`;

    const userPrompt = `Job Title: ${jobTitle}
Job Type: ${input.jobType || 'Not specified'}
Employment Type: ${input.employmentType || 'Not specified'}
Additional Requirements/Context: ${requirements || 'None provided. Generate a standard profile.'}`;

    let response: string;
    try {
      response = await aiJsonCompletion({
        system: systemPrompt,
        user: `${userPrompt}\n\nReturn ONLY a single valid JSON object. No markdown code fences, no commentary before or after.`,
      });
    } catch (error) {
      console.error('AI JD Generation provider failed:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Failed to generate job description with AI. Check AI provider credentials on the server.',
        StatusCodes.BAD_GATEWAY,
        ERROR_CODES.AI_EVALUATION_FAILED,
      );
    }

    if (!response?.trim()) {
      throw new AppError('AI provider returned an empty response.', StatusCodes.BAD_GATEWAY, ERROR_CODES.AI_EVALUATION_FAILED);
    }

    let result: { html: string; plainText: string; suggestedSkills: SkillWeight[] };
    try {
      result = JSON.parse(extractJsonObject(response)) as {
        html: string;
        plainText: string;
        suggestedSkills: SkillWeight[];
      };
    } catch (error) {
      console.error('AI JD Generation JSON parse failed:', error, response.slice(0, 500));
      throw new AppError('AI provider returned invalid JSON.', StatusCodes.BAD_GATEWAY, ERROR_CODES.AI_EVALUATION_FAILED);
    }

    return {
      html: result.html,
      plainText: result.plainText || '',
      suggestedSkills: result.suggestedSkills || [],
    };
  },
};

