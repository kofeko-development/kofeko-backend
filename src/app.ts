import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import { notFoundHandler } from './common/middlewares/notFound';
import { errorHandler } from './common/middlewares/errorHandler';
import { swaggerSpec } from './common/swagger/swagger.config';
import { httpLogger } from './common/logger/logger';
import { checkRedisHealth } from './config/redis';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors());
app.use(compression());
app.use(cookieParser());
app.use(httpLogger);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (_req, res) => {
  const redis = await checkRedisHealth();
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    redis,
  });
});

app.get('/health/redis', async (_req, res) => {
  const redis = await checkRedisHealth();
  const ok = redis.status === 'up' || redis.status === 'not_configured';
  res.status(ok ? 200 : 503).json({
    success: ok,
    redis,
  });
});

app.use('/uploads', express.static('uploads', {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

if (process.env.SWAGGER_ENABLED === 'true') {
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;