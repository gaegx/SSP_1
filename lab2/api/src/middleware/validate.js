import { validationResult } from 'express-validator';
import { HttpError } from '../errors.js';

export function handleValidation(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError(400, 'Ошибка валидации', 'VALIDATION_ERROR', errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      }))),
    );
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
    ownerId: row.owner_id,
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
    authorId: row.author_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
