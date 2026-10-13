// Wire format of /api/v1, shared by the Route Handlers (lib/api) and the browser (features/*/api-client.ts).

export type ApiErrorDetail = { code: string; message: string; fieldErrors?: Record<string, string> };

/** Every /api/v1 response body: `{ data }` on success, `{ error }` on failure — never both, never anything else. */
export type ApiResponse<T> = { data: T; error?: never } | { data?: never; error: ApiErrorDetail };
