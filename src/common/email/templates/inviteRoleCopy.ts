import { ROLE_NAMES } from '../../constants/roles';
import { escapeHtml } from '../htmlEscape';

type StaffInviteRoleKey =
  | typeof ROLE_NAMES.HR_MANAGER
  | typeof ROLE_NAMES.RECRUITER
  | typeof ROLE_NAMES.INTERVIEWER;

const STAFF_INVITE_ROLE_COPY: Record<StaffInviteRoleKey, { label: string; bullets: string[] }> = {
  [ROLE_NAMES.HR_MANAGER]: {
    label: 'HR Manager',
    bullets: [
      'Company and workspace settings (where your permissions allow).',
      'Invite team members and manage user accounts.',
      'Full job and candidate lifecycle: postings, applicants, and pipeline.',
      'Read analytics and audit activity to stay on top of hiring.',
    ],
  },
  [ROLE_NAMES.RECRUITER]: {
    label: 'Recruiter',
    bullets: [
      'Create and manage jobs, candidates, and the hiring pipeline.',
      'Run evaluations and communicate with candidates.',
      'View hiring analytics to track progress.',
    ],
  },
  [ROLE_NAMES.INTERVIEWER]: {
    label: 'Technical Interviewer',
    bullets: [
      'Review candidates and pipeline stages for interviews you support.',
      'Create and update evaluations and assessments.',
      'Read relevant communications for your interviews.',
    ],
  },
};

function bulletsToHtml(bullets: string[]): string {
  const items = bullets.map((b) => `<li style="margin:6px 0">${escapeHtml(b)}</li>`).join('');
  return `<ul style="margin:8px 0 0;padding-left:20px;color:#374151;font-size:14px;line-height:1.65">${items}</ul>`;
}

/**
 * Builds role title and responsibilities block for staff invite emails.
 */
export function buildInviteRoleEmailSection(opts: {
  isCustom: boolean;
  position?: string | null;
  roleNameKey?: string;
}): { roleTitle: string; responsibilitiesSectionHtml: string } {
  if (opts.isCustom) {
    const title = opts.position?.trim() || 'Custom role';
    const esc = escapeHtml(title);
    return {
      roleTitle: title,
      responsibilitiesSectionHtml: `
        <div style="margin:20px 0;padding:16px 18px;background:#f3f0fa;border:1px solid #e5dff5;border-radius:8px">
          <p style="margin:0 0 8px;font-size:15px;color:#111827"><strong>Your role:</strong> ${esc}</p>
          <p style="margin:0;color:#4b5563;font-size:14px;line-height:1.6">
            Your administrator assigned a tailored set of permissions for this role. After you sign in, you will only see the features and data allowed for your account.
          </p>
        </div>`,
    };
  }

  const key = (opts.roleNameKey ?? ROLE_NAMES.RECRUITER) as string;
  const entry =
    STAFF_INVITE_ROLE_COPY[key as StaffInviteRoleKey] ?? STAFF_INVITE_ROLE_COPY[ROLE_NAMES.RECRUITER];

  return {
    roleTitle: entry.label,
    responsibilitiesSectionHtml: `
      <div style="margin:20px 0;padding:16px 18px;background:#f3f0fa;border:1px solid #e5dff5;border-radius:8px">
        <p style="margin:0 0 10px;font-size:15px;color:#111827"><strong>Your access level:</strong> ${escapeHtml(entry.label)}</p>
        <p style="margin:0 0 8px;color:#4b5563;font-size:14px;line-height:1.6"><strong>What you can do in Kofeko:</strong></p>
        ${bulletsToHtml(entry.bullets)}
      </div>`,
  };
}

export function inviteEmailSubject(roleTitlePlain: string): string {
  const t = roleTitlePlain.trim() || 'team member';
  return `Welcome to Kofeko — you're invited as ${t}`;
}
