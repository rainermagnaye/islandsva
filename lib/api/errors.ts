import "server-only";

/** An expected API failure with its HTTP status. Thrown anywhere in a route; `createHandler` turns it into `fail()`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}
