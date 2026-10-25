import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@/lib/upstream-error";
import { ApiError } from "./errors";
import { createGetHandler, createHandler } from "./handler";
import { ok } from "./response";

const URL_ = "http://localhost:3000/api/v1/test";

function request(body: string, headers: Record<string, string> = {}) {
  return new NextRequest(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", ...headers },
    body,
  });
}

async function respond(handler: Parameters<typeof createHandler>[1], req: NextRequest, maxBytes = 100) {
  const res = await createHandler({ maxBytes, unavailableMessage: "Try later." }, handler)(req);
  return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
}

const echo = vi.fn(async ({ body }: { body: unknown }) => ok({ echoed: body }));

describe("createHandler", () => {
  it("passes parsed JSON to the handler and returns its response uncached", async () => {
    const res = await respond(echo, request('{"a":1}'));
    expect(res).toEqual({ status: 200, body: { data: { echoed: { a: 1 } } }, cache: "no-store" });
  });

  it("rejects a non-JSON content type with 415", async () => {
    expect((await respond(echo, request("{}", { "content-type": "text/plain" }))).status).toBe(415);
  });

  it.each([["a foreign origin", { origin: "https://evil.example" }], ["no origin", { origin: "" }]])(
    "rejects %s with 403 (CSRF)",
    async (_, headers) => {
      expect((await respond(echo, request("{}", headers))).body.error.code).toBe("forbidden_origin");
    },
  );

  it("measures the body in bytes, not characters (413)", async () => {
    // 40 characters, 120 bytes: under a character limit of 100, over the byte limit.
    const res = await respond(echo, request(JSON.stringify("日".repeat(38))));
    expect(res.status).toBe(413);
  });

  it("rejects malformed JSON with 400", async () => {
    expect((await respond(echo, request("{bad"))).body.error.code).toBe("malformed_json");
  });

  it("returns an ApiError as the error envelope", async () => {
    const res = await respond(async () => {
      throw new ApiError(422, "validation_failed", "Check the fields.", { email: "Bad." });
    }, request("{}"));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "validation_failed", message: "Check the fields.", fieldErrors: { email: "Bad." } } } });
  });

  it("turns an UpstreamError into 503 with the route's message, hiding internals", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await respond(async () => {
      throw new UpstreamError("supabase", "secret connection detail");
    }, request("{}"));
    expect(res).toMatchObject({ status: 503, body: { error: { code: "unavailable", message: "Try later." } } });
    expect(JSON.stringify(res.body)).not.toContain("secret");
    log.mockRestore();
  });

  it("reads a same-origin GET and rejects a foreign origin", async () => {
    const handler = createGetHandler({}, async () => ok({ ok: true }));
    const allowed = await handler(new NextRequest(URL_, { headers: { origin: "http://localhost:3000" } }));
    expect(allowed.status).toBe(200);
    const browserGet = await handler(new NextRequest(URL_, { headers: { "sec-fetch-site": "same-origin" } }));
    expect(browserGet.status).toBe(200);
    const blocked = await handler(new NextRequest(URL_, { headers: { origin: "https://evil.example" } }));
    expect((await blocked.json()).error.code).toBe("forbidden_origin");
    const bare = await handler(new NextRequest(URL_));
    expect((await bare.json()).error.code).toBe("forbidden_origin");
  });

  it("turns any other error into a generic 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await respond(async () => {
      throw new Error("stack trace with SQL");
    }, request("{}"));
    expect(res).toMatchObject({ status: 500, body: { error: { code: "internal_error" } } });
    expect(JSON.stringify(res.body)).not.toContain("SQL");
    log.mockRestore();
  });

  it("lets a prerender interrupt leave the handler", async () => {
    const handler = createGetHandler({}, async () => {
      const error = new Error("bail") as Error & { digest: string };
      error.digest = "NEXT_PRERENDER_INTERRUPTED";
      throw error;
    });
    await expect(handler(new NextRequest(URL_, { headers: { origin: "http://localhost:3000" } }))).rejects.toMatchObject({
      digest: "NEXT_PRERENDER_INTERRUPTED",
    });
  });
});
