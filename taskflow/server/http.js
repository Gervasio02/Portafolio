export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function fail(status, message, code) {
  throw new HttpError(status, message, code);
}
