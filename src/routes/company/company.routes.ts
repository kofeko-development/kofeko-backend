import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  getCompany,
  registerCompany,
  updateCompany,
} from '../../controllers/company/company.controller';
import {
  createCompanySchema,
  updateCompanySchema,
} from '../../validations/company/company.validation';

const companyRouter = Router();

companyRouter.post('/', authenticate, authorize([PERMISSIONS.COMPANY_UPDATE]), validateRequest(createCompanySchema), registerCompany);
companyRouter.get('/', authenticate, authorize([PERMISSIONS.COMPANY_READ]), getCompany);
companyRouter.patch('/', authenticate, authorize([PERMISSIONS.COMPANY_UPDATE]), validateRequest(updateCompanySchema), updateCompany);

export default companyRouter;
