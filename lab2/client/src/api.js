export class ApiError extends Error {
  constructor(message, status, details = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json()
    : null;

  if (!res.ok) {
    throw new ApiError(
      data?.error || `Ошибка ${res.status}`,
      res.status,
      data?.details || [],
    );
  }
  return data;
}

export const api = {
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
