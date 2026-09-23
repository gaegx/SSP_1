import { Router } from 'express';
import { body, param } from 'express-validator';
import { query } from '../db.js';
import { upload } from '../middleware/upload.js';
import { handleValidation, mapProposal } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../errors.js';

const router = Router({ mergeParams: true });

const proposalValidators = [
  body('coverLetter')
    .trim()
    .isLength({ min: 10, max: 3000 })
    .withMessage('Сопроводительное письмо: от 10 до 3000 символов'),
  body('bidAmount')
    .isFloat({ gt: 0 })
    .withMessage('Ставка должна быть числом больше 0'),
  body('estimatedDays')
    .isInt({ min: 1, max: 365 })
    .withMessage('Срок: от 1 до 365 дней'),
];

async function getJob(jobId) {
  const result = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
  return result.rows[0] || null;
}

function canManageProposal(user, proposal) {
  return user.role === 'admin' || proposal.author_id === user.id;
}

router.use(requireAuth);

router.get(
  '/jobs/:jobId/proposals',
  param('jobId').isInt({ min: 1 }).withMessage('Некорректный jobId'),
  handleValidation,
  async (req, res, next) => {
    try {
      const job = await getJob(req.params.jobId);
      if (!job) throw new HttpError(404, 'Заказ не найден', 'JOB_NOT_FOUND');
      if (
        req.user.role === 'customer' &&
        job.owner_id !== req.user.id &&
        req.user.role !== 'admin'
      ) {
        throw new HttpError(403, 'Недостаточно прав', 'FORBIDDEN');
      }
      const result = await query(
        'SELECT * FROM proposals WHERE job_id = $1 ORDER BY created_at DESC',
        [req.params.jobId],
      );
      res.status(200).json(result.rows.map(mapProposal));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/jobs/:jobId/proposals',
  requireRole('freelancer', 'admin'),
  upload.single('portfolio'),
  param('jobId').isInt({ min: 1 }).withMessage('Некорректный jobId'),
  proposalValidators,
  handleValidation,
  async (req, res, next) => {
    try {
      const job = await getJob(req.params.jobId);
      if (!job) throw new HttpError(404, 'Заказ не найден', 'JOB_NOT_FOUND');

      const { coverLetter, bidAmount, estimatedDays } = req.body;
      const portfolioPath = req.file ? `/uploads/${req.file.filename}` : null;

      const result = await query(
        `INSERT INTO proposals (job_id, cover_letter, bid_amount, estimated_days, portfolio_path, author_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          req.params.jobId,
          coverLetter.trim(),
          bidAmount,
          estimatedDays,
          portfolioPath,
          req.user.id,
        ],
      );
      res.status(201).json(mapProposal(result.rows[0]));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/proposals/:id',
  param('id').isInt({ min: 1 }).withMessage('Некорректный id'),
  handleValidation,
  async (req, res, next) => {
    try {
      const result = await query('SELECT * FROM proposals WHERE id = $1', [
        req.params.id,
      ]);
      if (result.rowCount === 0) {
        throw new HttpError(404, 'Отклик не найден', 'PROPOSAL_NOT_FOUND');
      }
      res.status(200).json(mapProposal(result.rows[0]));
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/proposals/:id',
  requireRole('freelancer', 'admin'),
  upload.single('portfolio'),
  param('id').isInt({ min: 1 }).withMessage('Некорректный id'),
  proposalValidators,
  handleValidation,
  async (req, res, next) => {
    try {
      const existing = await query('SELECT * FROM proposals WHERE id = $1', [
        req.params.id,
      ]);
      if (existing.rowCount === 0) {
        throw new HttpError(404, 'Отклик не найден', 'PROPOSAL_NOT_FOUND');
      }
      if (!canManageProposal(req.user, existing.rows[0])) {
        throw new HttpError(403, 'Недостаточно прав', 'FORBIDDEN');
      }

      const { coverLetter, bidAmount, estimatedDays } = req.body;
      const portfolioPath = req.file
        ? `/uploads/${req.file.filename}`
        : existing.rows[0].portfolio_path;

      const result = await query(
        `UPDATE proposals
         SET cover_letter = $1, bid_amount = $2, estimated_days = $3,
             portfolio_path = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [
          coverLetter.trim(),
          bidAmount,
          estimatedDays,
          portfolioPath,
          req.params.id,
        ],
      );
      res.status(200).json(mapProposal(result.rows[0]));
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/proposals/:id',
  requireRole('freelancer', 'admin'),
  param('id').isInt({ min: 1 }).withMessage('Некорректный id'),
  handleValidation,
  async (req, res, next) => {
    try {
      const existing = await query('SELECT * FROM proposals WHERE id = $1', [
        req.params.id,
      ]);
      if (existing.rowCount === 0) {
        throw new HttpError(404, 'Отклик не найден', 'PROPOSAL_NOT_FOUND');
      }
      if (!canManageProposal(req.user, existing.rows[0])) {
        throw new HttpError(403, 'Недостаточно прав', 'FORBIDDEN');
      }
      await query('DELETE FROM proposals WHERE id = $1', [req.params.id]);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
