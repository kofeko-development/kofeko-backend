import { Router } from 'express';
import { validateRequest } from '../../common/middlewares/validateRequest';
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

companyRouter.post('/register', validateRequest(createCompanySchema), registerCompany);
companyRouter.get('/:id', validateRequest(companyIdParamSchema), getCompany);
companyRouter.patch('/:id', validateRequest(updateCompanySchema), updateCompany);

export default companyRouter;
