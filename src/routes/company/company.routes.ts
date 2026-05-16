import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  getCompany,
  registerCompany,
  updateCompany,
  uploadLogo,
} from '../../controllers/company/company.controller';
import {
  createCompanySchema,
  updateCompanySchema,
} from '../../validations/company/company.validation';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const companyRouter = Router();

/**
 * @openapi
 * /api/v1/company/upload-logo:
 *   post:
 *     tags: [Company]
 *     summary: Upload company logo (JPG/PNG/SVG)
 */
companyRouter.post('/upload-logo', authenticate, authorize([PERMISSIONS.COMPANY_UPDATE]), upload.single('logo'), uploadLogo);

/**
 * @openapi
 * /api/v1/company:
 *   post:
 *     tags: [Company]
 *     summary: Create company profile for tenant
 */
companyRouter.post('/', authenticate, authorize([PERMISSIONS.COMPANY_UPDATE]), validateRequest(createCompanySchema), registerCompany);

/**
 * @openapi
 * /api/v1/company:
 *   get:
 *     tags: [Company]
 *     summary: Get company profile for tenant
 */
companyRouter.get('/', authenticate, authorize([PERMISSIONS.COMPANY_READ]), getCompany);

/**
 * @openapi
 * /api/v1/company:
 *   patch:
 *     tags: [Company]
 *     summary: Update company profile for tenant
 */
companyRouter.patch('/', authenticate, authorize([PERMISSIONS.COMPANY_UPDATE]), validateRequest(updateCompanySchema), updateCompany);

export default companyRouter;
