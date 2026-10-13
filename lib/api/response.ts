import "server-only";
import type { ApiResponse } from "@/types/api";
import type { ApiError } from "./errors";

// The only way Route Handlers build a response body, so every endpoint returns ApiResponse<T>.
// API responses are never cached: they carry per-request results.
const NO_STORE = { "Cache-Control": "no-store" };

function send<T>(body: ApiResponse<T>, status: number, headers?: HeadersInit) {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/** Success: `{ data }`. */
export function ok<T>(data: T, status = 200, headers?: HeadersInit) {
  return send<T>({ data }, status, headers);
}

/** Failure: `{ error: { code, message, fieldErrors? } }` with the error's status. */
export function fail(error: ApiError) {
  return send<never>({ error: { code: error.code, message: error.message, fieldErrors: error.fieldErrors } }, error.status);
}
