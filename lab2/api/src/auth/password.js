import bcrypt from 'bcryptjs';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function isLocked(user, now = new Date()) {
  if (!user.locked_until) return false;
  return new Date(user.locked_until) > now;
}

export function nextLockState(failedAttempts, now = new Date()) {
  const attempts = failedAttempts + 1;
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000);
    return { failedAttempts: attempts, lockedUntil };
  }
  return { failedAttempts: attempts, lockedUntil: null };
}

export function clearLockState() {
  return { failedAttempts: 0, lockedUntil: null };
}
