export const ROLE_NAMES = {
  COMPANY_ADMIN: 'company_admin',
  HR_MANAGER: 'hr_manager',
  RECRUITER: 'recruiter',
  INTERVIEWER: 'interviewer',
} as const;

export type RoleNameValue = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];