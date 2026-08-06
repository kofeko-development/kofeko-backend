import { Router } from 'express';
import { getSeedStatus, submitContactForm } from '../../controllers/system/system.controller';
import { validateRequest } from '../../common/middlewares/validateRequest';
import { contactInquirySchema } from '../../validations/system/system.validation';

const systemRouter = Router();

systemRouter.get('/seed-status', getSeedStatus);
systemRouter.post('/contact', validateRequest(contactInquirySchema), submitContactForm);

export default systemRouter;
