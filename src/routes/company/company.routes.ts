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
  companyIdParamSchema,
  createCompanySchema,
  updateCompanySchema,
} from '../../validations/company/company.validation';

const companyRouter = Router();

companyRouter.post('/register', authenticate, authorize([PERMISSIONS.COMPANY_UPDATE]), validateRequest(createCompanySchema), registerCompany);
companyRouter.get('/:id', authenticate, authorize([PERMISSIONS.COMPANY_READ]), validateRequest(companyIdParamSchema), getCompany);
companyRouter.patch('/:id', authenticate, authorize([PERMISSIONS.COMPANY_UPDATE]), validateRequest(updateCompanySchema), updateCompany);

export default companyRouter;
