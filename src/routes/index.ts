import { Router } from 'express';
import authRoutes from './auth/auth.routes';
import candidateRoutes from './candidate/candidate.routes';
import companyRoutes from './company/company.routes';
import communicationRoutes from './communication/communication.routes';
import analyticsRoutes from './analytics/analytics.routes';
import auditRoutes from './audit/audit.routes';
import evaluationRoutes from './evaluation/evaluation.routes';
import jobRoutes from './job/job.routes';
import pipelineRoutes from './pipeline/pipeline.routes';
import rbacRoutes from './rbac/rbac.routes';
import systemRoutes from './system/system.routes';
import tenantRoutes from './tenant/tenant.routes';
import userRoutes from './user/user.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/system', systemRoutes);
router.use('/companies', companyRoutes);
router.use('/tenants', tenantRoutes);
router.use('/users', userRoutes);
router.use('/rbac', rbacRoutes);
router.use('/jobs', jobRoutes);
router.use('/candidates', candidateRoutes);
router.use('/pipelines', pipelineRoutes);
router.use('/evaluations', evaluationRoutes);
router.use('/communication', communicationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/audit', auditRoutes);

export default router;
