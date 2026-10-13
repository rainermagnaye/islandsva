/**
 * A dependency (database, captcha, email) is unconfigured or unreachable. Thrown by low-level clients so
 * they never carry user-facing copy; `createHandler` logs it and answers 503 with the route's own message.
 */
export class UpstreamError extends Error {
  constructor(
    readonly service: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "UpstreamError";
  }
}
