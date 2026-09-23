import { query } from './db.js';

export async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      budget NUMERIC(12, 2) NOT NULL CHECK (budget > 0),
      status VARCHAR(32) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
      attachment_path VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS proposals (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      cover_letter TEXT NOT NULL,
      bid_amount NUMERIC(12, 2) NOT NULL CHECK (bid_amount > 0),
      estimated_days INTEGER NOT NULL CHECK (estimated_days BETWEEN 1 AND 365),
      portfolio_path VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_proposals_job_id ON proposals(job_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);`);
}
