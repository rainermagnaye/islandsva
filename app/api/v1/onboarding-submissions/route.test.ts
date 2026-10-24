import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ submitClientOnboarding: vi.fn(), notifyOnboardingSubmitted: vi.fn(async () => {}) }));
vi.mock("@/features/clients/service", () => service);
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: vi.fn() }));

const { POST } = await import("./route");

const token = "a".repeat(43);
const valid = {
  token, contactName: "Ana", contactPhone: "", jobTitle: "", industry: "Legal", website: "", staffCount: "", about: "Inbox.",
  street: "", city: "Austin", state: "", zip: "", country: "United States", billingName: "Cruz Co", billingEmail: "b@cruz.co",
  billingStreet: "", billingCity: "", billingState: "", billingZip: "", billingCountry: "", billingTaxId: "", consent: true,
};
const post = async (body: unknown) => {
  const res = await POST(
    new NextRequest("http://localhost:3000/api/v1/onboarding-submissions", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
};

describe("POST /api/v1/onboarding-submissions", () => {
  beforeEach(() => service.submitClientOnboarding.mockReset());

  it("saves a valid form once and answers 201", async () => {
    service.submitClientOnboarding.mockResolvedValue({ ok: true, clientId: "c1" });
    expect(await post(valid)).toEqual({ status: 201, body: { data: { ok: true } } });
    expect(service.submitClientOnboarding).toHaveBeenCalledWith(expect.objectContaining({ token, contactName: "Ana", consent: true }));
  });

  it("answers 404 for an unknown link and 410 for a used or expired one", async () => {
    service.submitClientOnboarding.mockResolvedValue({ ok: false, reason: "unknown" });
    expect((await post(valid)).status).toBe(404);
    service.submitClientOnboarding.mockResolvedValue({ ok: false, reason: "gone" });
    expect(await post(valid)).toMatchObject({ status: 410, body: { error: { code: "link_used" } } });
  });

  it("answers 422 when the database finds the details too long, so the client can shorten and retry", async () => {
    service.submitClientOnboarding.mockResolvedValue({ ok: false, reason: "too_large" });
    expect(await post(valid)).toMatchObject({ status: 422, body: { error: { code: "too_large" } } });
  });

  it("never reaches the database with a bad token, missing consent or an unexpected field", async () => {
    expect((await post({ ...valid, token: "nope" })).status).toBe(400);
    expect((await post({ ...valid, consent: false })).status).toBe(422);
    expect((await post({ ...valid, contactEmail: "x@y.co" })).status).toBe(400);
    expect(service.submitClientOnboarding).not.toHaveBeenCalled();
  });
});
