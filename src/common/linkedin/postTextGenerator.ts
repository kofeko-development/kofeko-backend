import type { Job } from '@prisma/client';
import type { SkillWeight } from '../../types/ai/ai.types';

type PostOptions = {
  job: Job;
  companyName: string;
  portalUrl: string;
  customText?: string;
};

const weightLabel = (w: number) =>
  w >= 8 ? 'Critical' : w >= 6 ? 'Important' : 'Nice to have';

export function generatePostText(options: PostOptions): string {
  const { job, companyName, portalUrl, customText } = options;

  if (customText?.trim()) return customText.trim();

  const skills = ((job.skillWeights as SkillWeight[] | null) ?? [])
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  const metaLines = [
    job.location ? `Location: ${job.location}` : null,
    job.experienceMin != null && job.experienceMax != null
      ? `Experience: ${job.experienceMin}-${job.experienceMax} years`
      : null,
    job.department ? `Department: ${job.department}` : null,
  ]
    .filter(Boolean)
    .join('   ');

  const skillBlock = skills.length
    ? `Key skills we are looking for:\n${skills.map((s) => `- ${s.skill} (${weightLabel(s.weight)})`).join('\n')}`
    : '';

  const hashtags = [
    '#hiring',
    `#${(job.title ?? '').toLowerCase().replace(/[^a-z0-9]/gi, '')}`,
    ...skills.slice(0, 3).map((s) => `#${s.skill.toLowerCase().replace(/[^a-z0-9]/g, '')}`),
    '#kofeko',
  ]
    .filter(Boolean)
    .join(' ');

  const firstLine =
    (job.description ?? '').split('\n')[0]?.trim() ||
    `${companyName} is looking for a talented ${job.title} to join the team.`;

  const lines = [
    `We are Hiring: ${job.title} at ${companyName}`,
    '',
    firstLine,
    '',
    metaLines,
    '',
    skillBlock,
    '',
    `Interested? Apply here: ${portalUrl}`,
    '',
    hashtags,
  ];

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function generateShareUrl(portalUrl: string, postText: string): string {
  const params = new URLSearchParams({
    url: portalUrl,
    summary: postText.slice(0, 700),
  });
  return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
}
