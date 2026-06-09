import { Router } from 'express';
import { serveStorageFile } from '../../controllers/files/files.controller';

const filesRouter = Router();

/**
 * @openapi
 * /api/v1/files/{path}:
 *   get:
 *     tags: [Files]
 *     summary: Serve uploaded files (logos, resumes, etc.)
 *     security: []
 */
filesRouter.get('/*path', serveStorageFile);

export default filesRouter;
