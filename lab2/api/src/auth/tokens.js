import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ACCESS_TTL = process.env.ACCESS_TTL || '15m';
const REFRESH_DAYS = Number(process.env.REFRESH_DAYS) || 7;

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function createRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshExpiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_DAYS);
  return d;
}

export function resetExpiresAt() {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  return d;
}

export { JWT_SECRET };
