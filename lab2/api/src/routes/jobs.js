import { Router } from 'express';
import { body, param, query as q } from 'express-validator';
import { query } from '../db.js';
import { upload } from '../middleware/upload.js';
import { handleValidation, mapJob } from '../middleware/validate.js';

const router = Router();

const STATUSES = ['open', 'in_progress', 'done', 'cancelled'];

const jobValidators = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Название: от 3 до 200 символов'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Описание: от 10 до 5000 символов'),
  body('budget')
    .isFloat({ gt: 0 })
    .withMessage('Бюджет должен быть числом больше 0'),
  body('status')
    .optional()
    .isIn(STATUSES)
    .withMessage(`Статус: ${STATUSES.join(', ')}`),
];

router.get(
  '/',
  q('status').optional().isIn(STATUSES).withMessage('Некорректный статус'),
  handleValidation,
  async (req, res, next) => {
    try {
      const { status } = req.query;
      let result;
      if (status) {
        result = await query(
          'SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC',
          [status],
        );
      } else {
        result = await query('SELECT * FROM jobs ORDER BY created_at DESC');
      }
      res.status(200).json(result.rows.map(mapJob));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id',
  param('id').isInt({ min: 1 }).withMessage('Некорректный id'),
  handleValidation,
  async (req, res, next) => {
    try {
      const result = await query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }
      res.status(200).json(mapJob(result.rows[0]));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  upload.single('attachment'),
  jobValidators,
  handleValidation,
  async (req, res, next) => {
    try {
      const { title, description, budget } = req.body;
      const status = req.body.status || 'open';
      const attachmentPath = req.file ? `/uploads/${req.file.filename}` : null;

      const result = await query(
        `INSERT INTO jobs (title, description, budget, status, attachment_path)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [title.trim(), description.trim(), budget, status, attachmentPath],
      );
      res.status(201).json(mapJob(result.rows[0]));
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/:id',
  upload.single('attachment'),
  param('id').isInt({ min: 1 }).withMessage('Некорректный id'),
  jobValidators,
  handleValidation,
  async (req, res, next) => {
    try {
      const existing = await query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      const { title, description, budget, status } = req.body;
      const attachmentPath = req.file
        ? `/uploads/${req.file.filename}`
        : existing.rows[0].attachment_path;

      const result = await query(
        `UPDATE jobs
         SET title = $1, description = $2, budget = $3, status = $4,
             attachment_path = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          title.trim(),
          description.trim(),
          budget,
          status || existing.rows[0].status,
          attachmentPath,
          req.params.id,
        ],
      );
      res.status(200).json(mapJob(result.rows[0]));
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  param('id').isInt({ min: 1 }).withMessage('Некорректный id'),
  handleValidation,
  async (req, res, next) => {
    try {
      const result = await query('DELETE FROM jobs WHERE id = $1 RETURNING id', [
        req.params.id,
      ]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
