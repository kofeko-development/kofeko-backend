// Demo candidate pack shared by the in-app demo import and the scripts that build/install it.
export const DEMO_SOURCE = 'demo';
// Not real inboxes: candidates are linked across companies by email, so real addresses would
// attach demo applications to a real person's portal account.
export const DEMO_EMAIL_DOMAIN = 'demo.kofeko.com';

export interface DemoCandidate {
  firstName: string;
  lastName: string;
  email: string;
  /** Name of the resume PDF uploaded alongside the pack. */
  resumeFile: string;
  summary: string;
  skills: string[];
  location: string | null;
  currentCompany: string | null;
  yearsOfExperience: number | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  workExperience: unknown[];
  education: unknown[];
  projects: unknown[];
  hobbies: string[];
}

export function demoCandidateEmail(firstName: string, lastName: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
  return `${slug(firstName)}.${slug(lastName)}@${DEMO_EMAIL_DOMAIN}`;
}
