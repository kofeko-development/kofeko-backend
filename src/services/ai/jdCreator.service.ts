import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/errorCodes';

export type JdCreatorInput = {
  jobTitle: string;
  requirements: string;
  location?: string;
  jobType?: string;
  employmentType?: string;
};

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export const jdCreatorService = {
  async generateJobDescription(input: JdCreatorInput): Promise<{ html: string }> {
    const jobTitle = input.jobTitle.trim();
    const requirements = input.requirements.trim();

    if (!jobTitle || !requirements) {
      throw new AppError('jobTitle and requirements are required', StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    // For now: do not generate with AI. Just return a clean preview of what was submitted.
    const meta = [
      input.location?.trim() ? `Location: ${input.location.trim()}` : null,
      input.jobType?.trim() ? `Work mode: ${input.jobType.trim()}` : null,
      input.employmentType?.trim() ? `Employment type: ${input.employmentType.trim()}` : null,
    ].filter(Boolean) as string[];

    const safeTitle = escapeHtml(jobTitle);
    const safeMeta = meta.map(escapeHtml);
    const safeRequirements = escapeHtml(requirements).replaceAll('\n', '<br/>');

    const html = `
<div class="space-y-8">
  <div class="space-y-2">
    <h2 class="text-lg font-bold font-headline mb-2 text-foreground">${safeTitle}</h2>
    ${safeMeta.length ? `<p class="text-muted-foreground">${safeMeta.join(' • ')}</p>` : ''}
  </div>
  <div class="space-y-2">
    <h3 class="font-semibold text-foreground mb-2">Requirements / Notes</h3>
    <p class="text-muted-foreground">${safeRequirements}</p>
  </div>
</div>
    `.trim();

    return { html };
  },
};

