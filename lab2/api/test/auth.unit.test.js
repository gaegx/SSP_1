import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLocked,
  nextLockState,
  clearLockState,
  MAX_FAILED_ATTEMPTS,
} from '../src/auth/password.js';
import { hashToken, createRefreshToken } from '../src/auth/tokens.js';
import { HttpError } from '../src/errors.js';

test('lockout after max failed attempts', () => {
  let attempts = 0;
  let lockedUntil = null;
  for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
    const state = nextLockState(attempts);
    attempts = state.failedAttempts;
    lockedUntil = state.lockedUntil;
  }
  assert.equal(attempts, MAX_FAILED_ATTEMPTS);
  assert.ok(lockedUntil instanceof Date);
  assert.equal(isLocked({ locked_until: lockedUntil }), true);
});

test('clear lock state', () => {
  const cleared = clearLockState();
  assert.equal(cleared.failedAttempts, 0);
  assert.equal(cleared.lockedUntil, null);
});

test('token hashing is stable and different for different tokens', () => {
  const a = createRefreshToken();
  const b = createRefreshToken();
  assert.notEqual(a, b);
  assert.equal(hashToken(a), hashToken(a));
  assert.notEqual(hashToken(a), hashToken(b));
});

test('HttpError carries status and code', () => {
  const err = new HttpError(429, 'locked', 'ACCOUNT_LOCKED');
  assert.equal(err.status, 429);
  assert.equal(err.code, 'ACCOUNT_LOCKED');
});
