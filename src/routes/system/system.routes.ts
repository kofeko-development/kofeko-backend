import { Router } from 'express';
import { getSeedStatus } from '../../controllers/system/system.controller';

const systemRouter = Router();

systemRouter.get('/seed-status', getSeedStatus);

export default systemRouter;
