import 'dotenv/config';
import { AuditActionType, PrismaClient, UserStatus } from '@prisma/client';
import { hashPassword } from '../common/auth/password';
import { PERMISSIONS } from '../common/constants/permissions';
import { DEFAULT_ROLE_PERMISSION_MATRIX } from '../common/constants/rolePermissionMatrix';
import { ROLE_NAMES } from '../common/constants/roles';
import { authRepository } from '../repositories/auth/auth.repository';

const prisma = new PrismaClient();

const SEED_TENANT_SLUG = 'kofeko-test';
const SEED_TENANT_NAME = 'Kofeko Test Company';
const CANDIDATE_TENANT_SLUG = process.env.CANDIDATE_TENANT_SLUG ?? 'kofeko-candidates';
const CANDIDATE_TENANT_NAME = process.env.CANDIDATE_TENANT_NAME ?? 'Kofeko Candidates';

async function ensureTenantPermissions(tenantId: string): Promise<void> {
  await prisma.permission.createMany({
    data: Object.values(PERMISSIONS).map((key) => ({ tenantId, key })),
    skipDuplicates: true,
  });

  const permissions = await prisma.permission.findMany({
    where: { tenantId },
    select: { id: true, key: true },
  });
  const permissionByKey = new Map(permissions.map((p) => [p.key, p]));

  for (const [roleName, rolePermissions] of Object.entries(DEFAULT_ROLE_PERMISSION_MATRIX)) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: roleName } },
      update: { description: `Default ${roleName} role` },
      create: { tenantId, name: roleName, description: `Default ${roleName} role` },
    });

    const rows = (rolePermissions as string[])
      .map((key) => permissionByKey.get(key))
      .filter((p): p is { id: string; key: string } => Boolean(p))
      .map((p) => ({ tenantId, roleId: role.id, permissionId: p.id }));

    if (rows.length > 0) {
      await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
    }
  }
}

async function getOrCreateRole(tenantId: string, name: string) {
  return prisma.role.upsert({
    where: { tenantId_name: { tenantId, name } },
    update: {},
    create: { tenantId, name, description: `${name} role` },
  });
}

async function ensureCandidateRecord(user: {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
}) {
  const existing = await prisma.candidate.findUnique({ where: { id: user.id } });
  if (existing) return existing;
  return prisma.candidate.create({
    data: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: 'new',
    },
  });
}

async function createStaffUser(
  tenantId: string,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    roleName: string;
    status?: UserStatus;
  },
) {
  const existing = await prisma.user.findFirst({ where: { tenantId, email: data.email } });
  if (existing) {
    console.log(`  ℹ️  User exists: ${data.email}`);
    return existing;
  }

  const role = await getOrCreateRole(tenantId, data.roleName);
  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      passwordHash,
      status: data.status ?? UserStatus.active,
    },
  });

  await prisma.userRole.create({ data: { tenantId, userId: user.id, roleId: role.id } });
  console.log(`  ✅ ${data.status ?? 'active'} ${data.roleName}: ${data.email}`);
  return user;
}

async function createPortalLoginCandidate(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  const existing = await prisma.user.findFirst({
    where: { email: data.email, tenant: { slug: CANDIDATE_TENANT_SLUG } },
  });
  if (existing) {
    console.log(`  ℹ️  Portal user exists: ${data.email}`);
    await ensureCandidateRecord(existing);
    return existing;
  }

  const passwordHash = await hashPassword(data.password);
  const { user } = await authRepository.bootstrapCandidateUser({
    tenantSlug: CANDIDATE_TENANT_SLUG,
    tenantName: CANDIDATE_TENANT_NAME,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    passwordHash,
    permissionKeys: Object.values(PERMISSIONS),
  });

  await ensureCandidateRecord(user);
  console.log(`  ✅ Portal candidate: ${data.email}`);
  return user;
}

async function createCompanyCandidate(
  tenantId: string,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    password?: string;
    skills?: string[];
    location?: string;
    status?: 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
    resumeUrl?: string;
  },
) {
  const existing = await prisma.candidate.findFirst({ where: { tenantId, email: data.email } });
  if (existing) {
    console.log(`  ℹ️  Company candidate exists: ${data.email}`);
    return existing;
  }

  const passwordHash = data.password ? await hashPassword(data.password) : null;
  const candidate = await prisma.candidate.create({
    data: {
      tenantId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      passwordHash,
      skills: data.skills ?? [],
      location: data.location,
      status: data.status ?? 'new',
      resumeUrl: data.resumeUrl ?? null,
      resumeMimeType: data.resumeUrl ? 'application/pdf' : null,
      source: 'seed',
    },
  });
  console.log(`  ✅ Company candidate (${data.status ?? 'new'}): ${data.email}`);
  return candidate;
}

async function main() {
  console.log('🌱 Seeding test data...');

  let tenant = await prisma.tenant.findUnique({ where: { slug: SEED_TENANT_SLUG } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: SEED_TENANT_NAME, slug: SEED_TENANT_SLUG, status: 'active' },
    });
    console.log('✅ Tenant created:', tenant.slug);
  } else {
    console.log('ℹ️  Tenant already exists:', tenant.slug);
  }

  const tenantId = tenant.id;
  await ensureTenantPermissions(tenantId);

  console.log('\n👥 Creating staff users...');
  const admin = await createStaffUser(tenantId, {
    firstName: 'Arjun',
    lastName: 'Mehta',
    email: 'admin@kofeko-test.com',
    password: 'Admin@12345',
    roleName: ROLE_NAMES.COMPANY_ADMIN,
  });
  await createStaffUser(tenantId, {
    firstName: 'Sneha',
    lastName: 'Patel',
    email: 'hr@kofeko-test.com',
    password: 'HrManager@12345',
    roleName: ROLE_NAMES.HR_MANAGER,
  });
  const recruiter1 = await createStaffUser(tenantId, {
    firstName: 'Rohan',
    lastName: 'Sharma',
    email: 'recruiter1@kofeko-test.com',
    password: 'Recruiter@12345',
    roleName: ROLE_NAMES.RECRUITER,
  });
  await createStaffUser(tenantId, {
    firstName: 'Priya',
    lastName: 'Kapoor',
    email: 'recruiter2@kofeko-test.com',
    password: 'Recruiter@12345',
    roleName: ROLE_NAMES.RECRUITER,
  });
  const interviewer1 = await createStaffUser(tenantId, {
    firstName: 'Vikram',
    lastName: 'Singh',
    email: 'interviewer1@kofeko-test.com',
    password: 'Interviewer@12345',
    roleName: ROLE_NAMES.INTERVIEWER,
  });
  await createStaffUser(tenantId, {
    firstName: 'Meera',
    lastName: 'Nair',
    email: 'interviewer2@kofeko-test.com',
    password: 'Interviewer@12345',
    roleName: ROLE_NAMES.INTERVIEWER,
  });
  await createStaffUser(tenantId, {
    firstName: 'Suspended',
    lastName: 'User',
    email: 'suspended@kofeko-test.com',
    password: 'Suspended@12345',
    roleName: ROLE_NAMES.RECRUITER,
    status: UserStatus.suspended,
  });
  await createStaffUser(tenantId, {
    firstName: 'Invited',
    lastName: 'User',
    email: 'invited@kofeko-test.com',
    password: 'Invited@12345',
    roleName: ROLE_NAMES.RECRUITER,
    status: UserStatus.invited,
  });

  console.log('\n🎓 Creating portal login candidates...');
  await createPortalLoginCandidate({
    firstName: 'Amit',
    lastName: 'Sharma',
    email: 'amit.sharma@candidate.com',
    password: 'Candidate@12345',
  });
  await createPortalLoginCandidate({
    firstName: 'Priya',
    lastName: 'Patel',
    email: 'priya.patel@candidate.com',
    password: 'Candidate@12345',
  });
  await createPortalLoginCandidate({
    firstName: 'Rahul',
    lastName: 'Mehta',
    email: 'rahul.mehta@candidate.com',
    password: 'Candidate@12345',
  });
  await createPortalLoginCandidate({
    firstName: 'Anita',
    lastName: 'Desai',
    email: 'anita.desai@candidate.com',
    password: 'Candidate@12345',
  });
  await createPortalLoginCandidate({
    firstName: 'Suresh',
    lastName: 'Kumar',
    email: 'suresh.kumar@candidate.com',
    password: 'Candidate@12345',
  });
  await createPortalLoginCandidate({
    firstName: 'Divya',
    lastName: 'Nair',
    email: 'divya.nair@candidate.com',
    password: 'Candidate@12345',
  });
  await createPortalLoginCandidate({
    firstName: 'No',
    lastName: 'Resume',
    email: 'noresume@candidate.com',
    password: 'Candidate@12345',
  });

  console.log('\n📋 Creating company-tenant candidates (for pipelines)...');
  const cand1 = await createCompanyCandidate(tenantId, {
    firstName: 'Amit',
    lastName: 'Sharma',
    email: 'amit.sharma@kofeko-test.com',
    skills: ['React', 'TypeScript', 'Node.js'],
    location: 'Ahmedabad, India',
    status: 'new',
    resumeUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  });
  const cand2 = await createCompanyCandidate(tenantId, {
    firstName: 'Priya',
    lastName: 'Patel',
    email: 'priya.patel@kofeko-test.com',
    skills: ['Python', 'Django'],
    location: 'Mumbai, India',
    status: 'screening',
    resumeUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  });
  const cand3 = await createCompanyCandidate(tenantId, {
    firstName: 'Rahul',
    lastName: 'Mehta',
    email: 'rahul.mehta@kofeko-test.com',
    skills: ['React', 'Vue.js'],
    location: 'Bangalore, India',
    status: 'interview',
    resumeUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  });
  const cand4 = await createCompanyCandidate(tenantId, {
    firstName: 'Anita',
    lastName: 'Desai',
    email: 'anita.desai@kofeko-test.com',
    skills: ['Java', 'Spring Boot'],
    location: 'Pune, India',
    status: 'offer',
    resumeUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  });
  const cand5 = await createCompanyCandidate(tenantId, {
    firstName: 'Suresh',
    lastName: 'Kumar',
    email: 'suresh.kumar@kofeko-test.com',
    skills: ['DevOps', 'Kubernetes', 'AWS'],
    location: 'Hyderabad, India',
    status: 'hired',
    resumeUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  });
  const cand6 = await createCompanyCandidate(tenantId, {
    firstName: 'Divya',
    lastName: 'Nair',
    email: 'divya.nair@kofeko-test.com',
    skills: ['UI/UX', 'Figma'],
    location: 'Chennai, India',
    status: 'rejected',
    resumeUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  });
  await createCompanyCandidate(tenantId, {
    firstName: 'Sourced',
    lastName: 'Candidate',
    email: 'sourced@kofeko-test.com',
    skills: ['Data Science', 'Python'],
    status: 'new',
    resumeUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  });

  console.log('\n💼 Creating jobs...');
  const createJob = async (data: {
    title: string;
    description: string;
    department: string;
    status: 'draft' | 'open' | 'paused' | 'closed';
    skillWeights?: Array<{ skill: string; weight: number }>;
    experienceMin?: number;
    experienceMax?: number;
    hiringPriority?: 'high' | 'medium' | 'low';
  }) => {
    const existing = await prisma.job.findFirst({ where: { tenantId, title: data.title } });
    if (existing) {
      console.log(`  ℹ️  Job exists: "${data.title}"`);
      return existing;
    }
    const job = await prisma.job.create({
      data: {
        tenantId,
        title: data.title,
        description: data.description,
        department: data.department,
        status: data.status,
        skillWeights: data.skillWeights,
        experienceMin: data.experienceMin ?? 2,
        experienceMax: data.experienceMax ?? 5,
        requirements: `Strong ${data.title} skills required.`,
        hiringPriority: data.hiringPriority ?? 'medium',
        screeningQuestions: [
          'Tell us about your most relevant experience.',
          'Why do you want to join our team?',
        ],
      },
    });
    console.log(`  ✅ Job (${data.status}): "${data.title}"`);
    return job;
  };

  const job1 = await createJob({
    title: 'Senior React Developer',
    description: 'We are looking for an experienced React developer.',
    department: 'Engineering',
    status: 'open',
    skillWeights: [
      { skill: 'React', weight: 9 },
      { skill: 'TypeScript', weight: 8 },
      { skill: 'Node.js', weight: 7 },
    ],
    experienceMin: 3,
    experienceMax: 7,
    hiringPriority: 'high',
  });
  const job2 = await createJob({
    title: 'Python Backend Engineer',
    description: 'Join our backend team building scalable APIs.',
    department: 'Engineering',
    status: 'open',
    skillWeights: [
      { skill: 'Python', weight: 9 },
      { skill: 'Django', weight: 8 },
    ],
    hiringPriority: 'high',
  });
  const job3 = await createJob({
    title: 'DevOps Engineer',
    description: 'Own our cloud infrastructure and CI/CD pipelines.',
    department: 'Infrastructure',
    status: 'open',
    skillWeights: [
      { skill: 'Kubernetes', weight: 9 },
      { skill: 'AWS', weight: 8 },
    ],
    hiringPriority: 'medium',
  });
  await createJob({
    title: 'UI/UX Designer',
    description: 'Design beautiful user experiences.',
    department: 'Design',
    status: 'open',
    skillWeights: [{ skill: 'Figma', weight: 9 }, { skill: 'UI/UX', weight: 10 }],
  });
  await createJob({
    title: 'Draft: Mobile Developer',
    description: 'React Native mobile development role.',
    department: 'Mobile',
    status: 'draft',
    skillWeights: [{ skill: 'React Native', weight: 9 }],
  });
  await createJob({
    title: 'Paused: Data Scientist',
    description: 'Data science and ML role.',
    department: 'Data',
    status: 'paused',
  });
  await createJob({
    title: 'Closed: Product Manager',
    description: 'Product management role.',
    department: 'Product',
    status: 'closed',
  });
  const jobNoWeights = await createJob({
    title: 'Open Internship (no skill weights)',
    description: 'General internship role.',
    department: 'General',
    status: 'open',
  });

  console.log('\n🔄 Creating pipelines...');
  const createPipeline = async (data: {
    jobId: string;
    candidateId: string;
    stage: 'applied' | 'screening' | 'technical_interview' | 'hr_interview' | 'offer' | 'hired' | 'rejected';
    assignedTo?: string;
    decisionNote?: string;
  }) => {
    const existing = await prisma.pipeline.findFirst({
      where: { tenantId, jobId: data.jobId, candidateId: data.candidateId },
    });
    if (existing) return existing;
    return prisma.pipeline.create({
      data: {
        tenantId,
        jobId: data.jobId,
        candidateId: data.candidateId,
        stage: data.stage,
        assignedTo: data.assignedTo ?? null,
        decisionNote: data.decisionNote ?? null,
      },
    });
  };

  const p2 = await createPipeline({
    jobId: job1.id,
    candidateId: cand2.id,
    stage: 'screening',
    assignedTo: interviewer1.id,
  });
  const p3 = await createPipeline({
    jobId: job1.id,
    candidateId: cand3.id,
    stage: 'technical_interview',
    assignedTo: interviewer1.id,
  });
  const p4 = await createPipeline({
    jobId: job1.id,
    candidateId: cand4.id,
    stage: 'offer',
    assignedTo: recruiter1.id,
  });
  const p6 = await createPipeline({
    jobId: job1.id,
    candidateId: cand6.id,
    stage: 'rejected',
    decisionNote: 'Not enough React experience',
  });
  const p8 = await createPipeline({
    jobId: job2.id,
    candidateId: cand2.id,
    stage: 'hired',
    decisionNote: 'Excellent Python skills',
  });
  await createPipeline({ jobId: job1.id, candidateId: cand1.id, stage: 'applied' });
  await createPipeline({ jobId: job3.id, candidateId: cand5.id, stage: 'screening' });
  await createPipeline({ jobId: jobNoWeights.id, candidateId: cand3.id, stage: 'applied' });

  console.log('\n🤖 Creating mock evaluations...');
  const createEvaluation = async (data: {
    jobId: string;
    candidateId: string;
    pipelineId: string;
    score: number;
    whyCard: string;
    rankingSummary: string;
  }) => {
    const existing = await prisma.evaluation.findFirst({
      where: { tenantId, jobId: data.jobId, candidateId: data.candidateId },
    });
    if (existing) return existing;
    return prisma.evaluation.create({
      data: {
        tenantId,
        jobId: data.jobId,
        candidateId: data.candidateId,
        pipelineId: data.pipelineId,
        score: data.score,
        aiGenerated: true,
        whyCard: data.whyCard,
        rankingSummary: data.rankingSummary,
        roleFitNotes: `Score ${data.score} from seed data.`,
        sectionScores: { skills: data.score, experience: data.score },
        skillMatches: [],
        parsedResumeData: { skills: ['React', 'TypeScript'] },
      },
    });
  };

  await createEvaluation({
    jobId: job1.id,
    candidateId: cand2.id,
    pipelineId: p2.id,
    score: 88,
    whyCard: 'Strong Python and backend experience.',
    rankingSummary: 'Top candidate with deep expertise.',
  });
  await createEvaluation({
    jobId: job1.id,
    candidateId: cand3.id,
    pipelineId: p3.id,
    score: 74,
    whyCard: 'Good React skills but limited TypeScript.',
    rankingSummary: 'Solid frontend developer.',
  });
  await createEvaluation({
    jobId: job1.id,
    candidateId: cand6.id,
    pipelineId: p6.id,
    score: 42,
    whyCard: 'Primarily UI/UX background.',
    rankingSummary: 'Not a strong technical fit.',
  });
  await createEvaluation({
    jobId: job1.id,
    candidateId: cand4.id,
    pipelineId: p4.id,
    score: 85,
    whyCard: 'Strong Java backend profile; ready for offer.',
    rankingSummary: 'High potential hire at offer stage.',
  });
  await createEvaluation({
    jobId: job2.id,
    candidateId: cand2.id,
    pipelineId: p8.id,
    score: 91,
    whyCard: 'Excellent Python and Django fit for backend role.',
    rankingSummary: 'Hired candidate — top match for Python role.',
  });

  console.log('\n📋 Creating audit logs...');
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId,
        actorId: recruiter1.id,
        action: AuditActionType.create,
        entityType: 'job',
        entityId: job1.id,
        metadata: { title: job1.title },
      },
      {
        tenantId,
        actorId: recruiter1.id,
        action: AuditActionType.update,
        entityType: 'job',
        entityId: job1.id,
        metadata: {},
      },
      {
        tenantId,
        actorId: admin.id,
        action: AuditActionType.create,
        entityType: 'candidate',
        entityId: cand1.id,
        metadata: {},
      },
    ],
    skipDuplicates: true,
  });

  console.log(`
╔════════════════════════════════════════════════════════════╗
║           KOFEKO TEST DATA — LOGIN CREDENTIALS             ║
╠════════════════════════════════════════════════════════════╣
║ TENANT SLUG (staff): ${SEED_TENANT_SLUG.padEnd(36)}║
╠════════════════════════════════════════════════════════════╣
║ Staff login at /login (use tenant slug: kofeko-test)       ║
║  admin@kofeko-test.com          / Admin@12345                ║
║  hr@kofeko-test.com             / HrManager@12345            ║
║  recruiter1@kofeko-test.com     / Recruiter@12345            ║
║  interviewer1@kofeko-test.com   / Interviewer@12345          ║
╠════════════════════════════════════════════════════════════╣
║ Candidate login at /candidate-auth                         ║
║  amit.sharma@candidate.com      / Candidate@12345            ║
║  priya.patel@candidate.com      / Candidate@12345            ║
╚════════════════════════════════════════════════════════════╝
  `);

  console.log('🎉 Seed complete!');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
