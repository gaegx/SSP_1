import { clearAuth, getStoredAuth, saveAuth } from './authStorage.js';

export class ApiError extends Error {
  constructor(message, status, details = [], code = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

let refreshPromise = null;

async function refreshAccess() {
  const { refreshToken } = getStoredAuth();
  if (!refreshToken) return null;
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          clearAuth();
          return null;
        }
        const data = await res.json();
        saveAuth(data);
        return data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request(url, options = {}, retry = true) {
  const headers = { ...(options.headers || {}) };
  const { accessToken } = getStoredAuth();
  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });
  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;

  if (res.status === 401 && retry && !url.includes('/api/auth/')) {
    const newToken = await refreshAccess();
    if (newToken) {
      return request(url, options, false);
    }
  }

  if (!res.ok) {
    throw new ApiError(
      data?.error || `Ошибка ${res.status}`,
      res.status,
      data?.details || [],
      data?.code,
    );
  }
  return data;
}

export const api = {
  register(payload) {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  login(payload) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  logout(refreshToken) {
    return request('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },
  me() {
    return request('/api/auth/me');
  },
  getSessions() {
    return request('/api/auth/sessions');
  },
  revokeSession(id) {
    return request(`/api/auth/sessions/${id}`, { method: 'DELETE' });
  },
  forgotPassword(email) {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  resetPassword(token, password) {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },
  getJobs(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/api/jobs${qs}`);
  },
  getJob(id) {
    return request(`/api/jobs/${id}`);
  },
  createJob(formData) {
    return request('/api/jobs', { method: 'POST', body: formData });
  },
  updateJob(id, formData) {
    return request(`/api/jobs/${id}`, { method: 'PUT', body: formData });
  },
  deleteJob(id) {
    return request(`/api/jobs/${id}`, { method: 'DELETE' });
  },
  getProposals(jobId) {
    return request(`/api/jobs/${jobId}/proposals`);
  },
  createProposal(jobId, formData) {
    return request(`/api/jobs/${jobId}/proposals`, {
      method: 'POST',
      body: formData,
    });
  },
  updateProposal(id, formData) {
    return request(`/api/proposals/${id}`, { method: 'PUT', body: formData });
  },
  deleteProposal(id) {
    return request(`/api/proposals/${id}`, { method: 'DELETE' });
  },
};

export function formatError(err) {
  if (!(err instanceof ApiError)) {
    return err.message || 'Неизвестная ошибка';
  }
  if (err.details?.length) {
    return `${err.message}: ${err.details.map((d) => d.message).join('; ')}`;
  }
  return err.message;
}
