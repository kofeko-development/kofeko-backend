import { StatusCodes } from 'http-status-codes';
import { analyzeResumeAgainstJD } from '../../common/ai/analyzeResume';
import { extractResumeText } from '../../common/ai/extractResumeText';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';
import type { AnalyzeResult, SkillWeight } from '../../types/ai/ai.types';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_RESUMES = 30;

export type EvaluationLabFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export type EvaluationLabResultItem =
  | {
      fileName: string;
      success: true;
      overallScore: number;
      rankingSummary: string;
      analysis: AnalyzeResult;
    }
  | {
      fileName: string;
      success: false;
      error: string;
    };

export const evaluationLabService = {
  async evaluateResumes(input: {
    jobTitle: string;
    description: string;
    skillWeights: SkillWeight[];
    files: EvaluationLabFile[];
  }): Promise<{ results: EvaluationLabResultItem[] }> {
    const jobTitle = input.jobTitle.trim();
    const description = input.description.trim();

    if (!jobTitle) {
      throw new AppError('Job title is required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!description) {
      throw new AppError('Job description is required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!input.files.length) {
      throw new AppError('Upload at least one resume', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    if (input.files.length > MAX_RESUMES) {
      throw new AppError(`Maximum ${MAX_RESUMES} resumes per run`, StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const skillWeights = input.skillWeights.filter((s) => s.skill?.trim());

    const results: EvaluationLabResultItem[] = [];

    for (const file of input.files) {
      const fileName = file.originalname || 'resume';

      if (!ALLOWED_MIME.has(file.mimetype)) {
        results.push({
          fileName,
          success: false,
          error: 'Unsupported format. Use PDF, DOCX, or TXT.',
        });
        continue;
      }

      if (file.size > MAX_FILE_BYTES) {
        results.push({
          fileName,
          success: false,
          error: 'File is too large (max 8 MB).',
        });
        continue;
      }

      try {
        const resumeText = await extractResumeText(file.buffer, file.mimetype, fileName);
        const analysis = await analyzeResumeAgainstJD(resumeText, {
          title: jobTitle,
          description,
          skillWeights,
        });

        results.push({
          fileName,
          success: true,
          overallScore: analysis.scores.overall,
          rankingSummary: analysis.rankingSummary,
          analysis,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Evaluation failed';
        results.push({ fileName, success: false, error: message });
      }
    }

    const ranked = [...results].sort((a, b) => {
      const scoreA = a.success ? a.overallScore : -1;
      const scoreB = b.success ? b.overallScore : -1;
      return scoreB - scoreA;
    });

    return { results: ranked };
  },
};
