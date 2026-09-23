import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { migrate } from './migrate.js';
import { uploadDir } from './middleware/upload.js';
import jobsRouter from './routes/jobs.js';
import proposalsRouter from './routes/proposals.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/jobs', jobsRouter);
app.use('/api', proposalsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (
    err instanceof multer.MulterError ||
    err.message?.includes('Допустимы') ||
    err.message === 'Unexpected end of form'
  ) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

async function start() {
  const maxAttempts = 30;
  for (let i = 1; i <= maxAttempts; i += 1) {
    try {
      await migrate();
      break;
    } catch (err) {
      console.warn(`DB not ready (attempt ${i}/${maxAttempts}): ${err.message}`);
      if (i === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  app.listen(PORT, () => {
    console.log(`API listening on :${PORT}`);
    console.log(`Uploads: ${path.resolve(uploadDir)}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
