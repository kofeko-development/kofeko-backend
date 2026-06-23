import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../common/utils/catchAsync';
import { sendSuccess } from '../../common/utils/apiResponse';
import { evaluationLabService } from '../../services/ai/evaluationLab.service';
import type { SkillWeight } from '../../types/ai/ai.types';

function parseSkillWeights(raw: unknown): SkillWeight[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parseSkillWeights(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        skill: String(item.skill ?? '').trim(),
        weight: Math.min(10, Math.max(0, Math.round(Number(item.weight) || 0))),
        yearsOfExperience: Number(item.yearsOfExperience) || undefined,
      };
    })
    .filter((s) => s.skill.length > 0);
}

export const runEvaluationLab = catchAsync(async (req: Request, res: Response) => {
  const files = (req as Request & { files?: Express.Multer.File[] }).files ?? [];
  const jobTitle = String(req.body?.jobTitle ?? '');
  const description = String(req.body?.description ?? '');
  const skillWeights = parseSkillWeights(req.body?.skillWeights);

  const result = await evaluationLabService.evaluateResumes({
    jobTitle,
    description,
    skillWeights,
    files: files.map((f) => ({
      buffer: f.buffer,
      mimetype: f.mimetype,
      originalname: f.originalname,
      size: f.size,
    })),
  });

  sendSuccess(res, StatusCodes.OK, 'Evaluation lab run complete', result);
});
