import { validationResult } from 'express-validator';

export function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
}

export function mapJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    budget: Number(row.budget),
    status: row.status,
    attachmentPath: row.attachment_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProposal(row) {
  if (!row) return null;
  return {
    id: row.id,
    jobId: row.job_id,
    coverLetter: row.cover_letter,
    bidAmount: Number(row.bid_amount),
    estimatedDays: row.estimated_days,
    portfolioPath: row.portfolio_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
