import path from 'path';
import { createApp } from './app.js';
import { migrate } from './migrate.js';
import { uploadDir } from './middleware/upload.js';
import { logger } from './logger.js';

const PORT = Number(process.env.PORT) || 4000;
const app = createApp();

async function start() {
  const maxAttempts = 30;
  for (let i = 1; i <= maxAttempts; i += 1) {
    try {
      await migrate();
      break;
    } catch (err) {
      logger.warn({ attempt: i, err: err.message }, 'db_not_ready');
      if (i === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  app.listen(PORT, () => {
    logger.info({ port: PORT, uploads: path.resolve(uploadDir) }, 'api_started');
  });
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((err) => {
    logger.error({ err }, 'failed_to_start');
    process.exit(1);
  });
}

export default app;
