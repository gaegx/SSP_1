import { verifyAccessToken } from '../auth/tokens.js';
import { HttpError } from '../errors.js';
import { query } from '../db.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new HttpError(401, 'Требуется авторизация', 'UNAUTHORIZED');
    }
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new HttpError(401, 'Недействительный или истёкший токен', 'INVALID_TOKEN');
    }
    const result = await query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [payload.sub],
    );
    if (result.rowCount === 0) {
      throw new HttpError(401, 'Пользователь не найден', 'UNAUTHORIZED');
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new HttpError(401, 'Требуется авторизация', 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'Недостаточно прав', 'FORBIDDEN'));
    }
    next();
  };
}
