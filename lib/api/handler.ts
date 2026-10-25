import "server-only";
import type { NextRequest } from "next/server";
import { site } from "@/content/site";
import { UpstreamError } from "@/lib/upstream-error";
import { ApiError } from "./errors";
import { fail } from "./response";

type HandlerContext = { req: NextRequest; body: unknown; ip: string | null };

type ReadContext = { req: NextRequest; ip: string | null };

type HandlerOptions = {
  /** Maximum request body size in bytes. */
  maxBytes: number;
  /** Shown to the user when a dependency (database, captcha) is down — phrase it for this route. */
  unavailableMessage?: string;
};

type ReadOptions = {
  /** Shown to the user when a dependency is down — phrase it for this route. */
  unavailableMessage?: string;
};

function allowedOrigins(req: NextRequest) {
  return new Set([req.nextUrl.origin, new URL(site.url).origin]);
}

/** Client IP as reported by the platform proxy (Vercel sets x-forwarded-for). */
function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

function isPrerenderInterrupt(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && (error as { digest?: unknown }).digest === "NEXT_PRERENDER_INTERRUPTED";
}

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins(req).has(origin)) {
    throw new ApiError(403, "forbidden_origin", "This request isn't allowed.");
  }
}

/** A read may omit Origin. Browsers do that for a same-page GET, and send Sec-Fetch-Site instead. */
function samePageRead(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) {
    if (!allowedOrigins(req).has(origin)) throw new ApiError(403, "forbidden_origin", "This request isn't allowed.");
    return;
  }
  if (req.headers.get("sec-fetch-site") === "same-origin") return;
  throw new ApiError(403, "forbidden_origin", "This request isn't allowed.");
}

function respondTo(error: unknown, req: NextRequest, unavailableMessage?: string) {
  // A prerender that touches request headers bails out on purpose. Swallowing it turns the route into a logged 500.
  if (isPrerenderInterrupt(error)) throw error;
  if (error instanceof ApiError) return fail(error);
  if (error instanceof UpstreamError) {
    console.error("Upstream unavailable", { path: req.nextUrl.pathname, service: error.service, error });
    const message = unavailableMessage ?? "This is temporarily unavailable. Please try again in a moment.";
    return fail(new ApiError(503, "unavailable", message));
  }
  console.error("Unhandled API error", { path: req.nextUrl.pathname, error });
  return fail(new ApiError(500, "internal_error", "Something went wrong on our side. Please try again."));
}

/**
 * Every JSON Route Handler goes through this. In order: content type, origin (CSRF — Route Handlers
 * have no built-in protection), body size, JSON parse; then the handler. ApiErrors become the standard
 * error envelope, UpstreamErrors a logged 503, anything else a logged generic 500.
 */
export function createHandler(options: HandlerOptions, handler: (ctx: HandlerContext) => Promise<Response>) {
  return async function route(req: NextRequest) {
    try {
      if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
        throw new ApiError(415, "unsupported_media_type", "Send the request as JSON.");
      }
      sameOrigin(req);
      if (Number(req.headers.get("content-length") ?? 0) > options.maxBytes) {
        throw new ApiError(413, "payload_too_large", "That message is too long.");
      }
      const raw = await req.text();
      // Bytes, not characters: non-Latin text can take up to 4 bytes per character.
      if (Buffer.byteLength(raw, "utf8") > options.maxBytes) {
        throw new ApiError(413, "payload_too_large", "That message is too long.");
      }
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new ApiError(400, "malformed_json", "The request couldn't be read.");
      }
      return await handler({ req, body, ip: clientIp(req) });
    } catch (error) {
      return respondTo(error, req, options.unavailableMessage);
    }
  };
}

/**
 * A read with no body (search). Same origin check and error envelope as `createHandler`, without a JSON body.
 */
export function createGetHandler(options: ReadOptions, handler: (ctx: ReadContext) => Promise<Response>) {
  return async function route(req: NextRequest) {
    try {
      samePageRead(req);
      return await handler({ req, ip: clientIp(req) });
    } catch (error) {
      return respondTo(error, req, options.unavailableMessage);
    }
  };
}
