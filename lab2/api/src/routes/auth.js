import { Router } from 'express';
import { body, param } from 'express-validator';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { handleValidation } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  comparePassword,
  hashPassword,
  isLocked,
  nextLockState,
  clearLockState,
} from '../auth/password.js';
import {
  signAccessToken,
  createRefreshToken,
  hashToken,
  refreshExpiresAt,
  resetExpiresAt,
} from '../auth/tokens.js';
import { sendPasswordResetEmail } from '../mail.js';
import { logger } from '../logger.js';

const router = Router();
const ROLES = ['customer', 'freelancer'];
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

function mapUser(row) {
  return { id: row.id, email: row.email, role: row.role };
}

function mapSession(row) {
  return {
    id: row.id,
    userAgent: row.user_agent,
    ip: row.ip,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    active: !row.revoked_at && new Date(row.expires_at) > new Date(),
  };
}

async function issueTokens(user, req) {
  const refreshToken = createRefreshToken();
  const refreshHash = hashToken(refreshToken);
  const expiresAt = refreshExpiresAt();
  const session = await query(
    `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      user.id,
      refreshHash,
      (req.headers['user-agent'] || '').slice(0, 500),
      req.ip,
      expiresAt,
    ],
  );
  const accessToken = signAccessToken(user);
  return {
    accessToken,
    refreshToken,
    expiresIn: 900,
    sessionId: session.rows[0].id,
    user: mapUser(user),
  };
}

router.post(
  '/register',
  body('email').isEmail().withMessage('Некорректный email').normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: 100 })
    .withMessage('Пароль: минимум 8 символов'),
  body('role')
    .isIn(ROLES)
    .withMessage('Роль: customer или freelancer'),
  handleValidation,
  async (req, res, next) => {
    try {
      const { email, password, role } = req.body;
      const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (exists.rowCount > 0) {
        throw new HttpError(409, 'Email уже зарегистрирован', 'EMAIL_TAKEN');
      }
      const passwordHash = await hashPassword(password);
      const result = await query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, email, role`,
        [email, passwordHash, role],
      );
      const tokens = await issueTokens(result.rows[0], req);
      logger.info({ userId: result.rows[0].id, role }, 'user_registered');
      res.status(201).json(tokens);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/login',
  body('email').isEmail().withMessage('Некорректный email').normalizeEmail(),
  body('password').notEmpty().withMessage('Пароль обязателен'),
  handleValidation,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const result = await query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rowCount === 0) {
        throw new HttpError(401, 'Неверный email или пароль', 'INVALID_CREDENTIALS');
      }
      const user = result.rows[0];
      if (isLocked(user)) {
        throw new HttpError(
          429,
          'Аккаунт временно заблокирован из-за подбора пароля. Попробуйте позже.',
          'ACCOUNT_LOCKED',
        );
      }
      const ok = await comparePassword(password, user.password_hash);
      if (!ok) {
        const lock = nextLockState(user.failed_login_attempts);
        await query(
          `UPDATE users SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW()
           WHERE id = $3`,
          [lock.failedAttempts, lock.lockedUntil, user.id],
        );
        if (lock.lockedUntil) {
          logger.warn({ userId: user.id }, 'account_locked');
          throw new HttpError(
            429,
            'Слишком много неудачных попыток. Аккаунт заблокирован на 15 минут.',
            'ACCOUNT_LOCKED',
          );
        }
        throw new HttpError(401, 'Неверный email или пароль', 'INVALID_CREDENTIALS');
      }
      const cleared = clearLockState();
      await query(
        `UPDATE users SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW()
         WHERE id = $3`,
        [cleared.failedAttempts, cleared.lockedUntil, user.id],
      );
      const tokens = await issueTokens(user, req);
      logger.info({ userId: user.id }, 'user_login');
      res.status(200).json(tokens);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/refresh',
  body('refreshToken').notEmpty().withMessage('refreshToken обязателен'),
  handleValidation,
  async (req, res, next) => {
    try {
      const hash = hashToken(req.body.refreshToken);
      const result = await query(
        `SELECT s.*, u.email, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.refresh_token_hash = $1`,
        [hash],
      );
      if (result.rowCount === 0) {
        throw new HttpError(401, 'Сессия не найдена', 'INVALID_REFRESH');
      }
      const session = result.rows[0];
      if (session.revoked_at || new Date(session.expires_at) <= new Date()) {
        throw new HttpError(401, 'Сессия истекла или отозвана', 'SESSION_EXPIRED');
      }
      await query('UPDATE sessions SET revoked_at = NOW() WHERE id = $1', [session.id]);
      const tokens = await issueTokens(
        { id: session.user_id, email: session.email, role: session.role },
        req,
      );
      res.status(200).json(tokens);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/logout',
  body('refreshToken').optional().isString(),
  async (req, res, next) => {
    try {
      if (req.body.refreshToken) {
        const hash = hashToken(req.body.refreshToken);
        await query(
          `UPDATE sessions SET revoked_at = NOW()
           WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
          [hash],
        );
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

router.get('/me', requireAuth, async (req, res) => {
  res.status(200).json(mapUser(req.user));
});

router.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id],
    );
    res.status(200).json(result.rows.map(mapSession));
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/sessions/:id',
  requireAuth,
  param('id').isInt({ min: 1 }),
  handleValidation,
  async (req, res, next) => {
    try {
      const result = await query(
        `UPDATE sessions SET revoked_at = NOW()
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
         RETURNING id`,
        [req.params.id, req.user.id],
      );
      if (result.rowCount === 0) {
        throw new HttpError(404, 'Сессия не найдена', 'SESSION_NOT_FOUND');
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/forgot-password',
  body('email').isEmail().normalizeEmail(),
  handleValidation,
  async (req, res, next) => {
    try {
      const result = await query('SELECT id, email FROM users WHERE email = $1', [
        req.body.email,
      ]);
      // Always 200 to avoid email enumeration
      if (result.rowCount > 0) {
        const user = result.rows[0];
        const raw = createRefreshToken();
        const tokenHash = hashToken(raw);
        await query(
          `INSERT INTO password_resets (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [user.id, tokenHash, resetExpiresAt()],
        );
        const resetUrl = `${CLIENT_URL}/reset-password?token=${raw}`;
        await sendPasswordResetEmail(user.email, resetUrl);
      }
      res.status(200).json({
        message: 'Если аккаунт существует, письмо отправлено',
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/reset-password',
  body('token').notEmpty().withMessage('token обязателен'),
  body('password')
    .isLength({ min: 8, max: 100 })
    .withMessage('Пароль: минимум 8 символов'),
  handleValidation,
  async (req, res, next) => {
    try {
      const tokenHash = hashToken(req.body.token);
      const result = await query(
        `SELECT * FROM password_resets
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
        [tokenHash],
      );
      if (result.rowCount === 0) {
        throw new HttpError(400, 'Недействительный или истёкший токен', 'INVALID_RESET_TOKEN');
      }
      const reset = result.rows[0];
      const passwordHash = await hashPassword(req.body.password);
      await query(
        `UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
         WHERE id = $2`,
        [passwordHash, reset.user_id],
      );
      await query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [reset.id]);
      await query(
        `UPDATE sessions SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [reset.user_id],
      );
      logger.info({ userId: reset.user_id }, 'password_reset_completed');
      res.status(200).json({ message: 'Пароль обновлён' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
