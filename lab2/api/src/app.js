import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { uploadDir } from './middleware/upload.js';
import jobsRouter from './routes/jobs.js';
import proposalsRouter from './routes/proposals.js';
import authRouter from './routes/auth.js';
import { HttpError, sendError } from './errors.js';
import { logger } from './logger.js';

export function createApp() {
  const app = express();

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
      customProps: (req) => ({
        userId: req.user?.id,
      }),
      serializers: {
        req(req) {
          return { id: req.id, method: req.method, url: req.url };
        },
      },
    }),
  );

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(uploadDir));

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api', proposalsRouter);

  app.use((err, req, res, _next) => {
    if (sendError(res, err)) {
      req.log?.warn({ err: { message: err.message, code: err.code } }, 'handled_error');
      return;
    }
    if (
      err instanceof multer.MulterError ||
      err.message?.includes('Допустимы') ||
      err.message === 'Unexpected end of form'
    ) {
      return res.status(400).json({
        error: err.message,
        code: 'UPLOAD_ERROR',
      });
    }
    req.log?.error({ err }, 'unhandled_error');
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR',
    });
  });

  return app;
}

export { HttpError };
