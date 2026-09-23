export class HttpError extends Error {
  constructor(status, message, code, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendError(res, err) {
  if (err instanceof HttpError) {
    const body = { error: err.message, code: err.code };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }
  return null;
}
