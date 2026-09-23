const ACCESS_KEY = 'fd_access';
const REFRESH_KEY = 'fd_refresh';
const USER_KEY = 'fd_user';

export function getStoredAuth() {
  try {
    return {
      accessToken: localStorage.getItem(ACCESS_KEY),
      refreshToken: localStorage.getItem(REFRESH_KEY),
      user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
    };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
}

export function saveAuth({ accessToken, refreshToken, user }) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
