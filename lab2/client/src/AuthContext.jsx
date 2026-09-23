import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { clearAuth, getStoredAuth, saveAuth } from './authStorage.js';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const stored = getStoredAuth();
  const [user, setUser] = useState(stored.user);
  const [accessToken, setAccessToken] = useState(stored.accessToken);

  const applyAuth = useCallback((data) => {
    saveAuth(data);
    setUser(data.user);
    setAccessToken(data.accessToken);
  }, []);

  const logout = useCallback(async () => {
    const { refreshToken } = getStoredAuth();
    try {
      if (refreshToken) await api.logout(refreshToken);
    } catch {
      // ignore
    }
    clearAuth();
    setUser(null);
    setAccessToken(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      applyAuth,
      logout,
      setUser,
    }),
    [user, accessToken, applyAuth, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
