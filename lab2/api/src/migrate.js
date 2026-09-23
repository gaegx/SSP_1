import { query } from './db.js';
import { hashPassword } from './auth/password.js';
import { logger } from './logger.js';

export async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL
        CHECK (role IN ('admin', 'customer', 'freelancer')),
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
      user_agent VARCHAR(500),
      ip VARCHAR(64),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      budget NUMERIC(12, 2) NOT NULL CHECK (budget > 0),
      status VARCHAR(32) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
      attachment_path VARCHAR(500),
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS proposals (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      cover_letter TEXT NOT NULL,
      bid_amount NUMERIC(12, 2) NOT NULL CHECK (bid_amount > 0),
      estimated_days INTEGER NOT NULL CHECK (estimated_days BETWEEN 1 AND 365),
      portfolio_path VARCHAR(500),
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE proposals ADD COLUMN IF NOT EXISTS author_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_proposals_job_id ON proposals(job_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@freelance.local';
  const adminPass = process.env.ADMIN_PASSWORD || 'Admin123!';
  const existing = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  if (existing.rowCount === 0) {
    const passwordHash = await hashPassword(adminPass);
    await query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')`,
      [adminEmail, passwordHash],
    );
    logger.info({ email: adminEmail }, 'seeded_admin_user');
  }
}
