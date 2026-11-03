import { beforeEach, describe, expect, it, vi } from "vitest";
import { logOwnedLeadStep, submitContactRequest } from "./service";

const dal = vi.hoisted(() => ({
  insertDiscoveryRequest: vi.fn(),
  insertLead: vi.fn(),
  getLead: vi.fn(),
}));
const timeline = vi.hoisted(() => ({ recordOwnedLeadStep: vi.fn() }));
vi.mock("./dal", () => dal);
vi.mock("./convert-dal", () => ({}));
vi.mock("./timeline-dal", () => timeline);
vi.mock("./email", () => ({}));
vi.mock("@/features/clients/service", () => ({}));

const lead = { name: "Ana Cruz", email: "ana@example.com", company: "Cruz Co", industry: "Legal", country: "Philippines", message: "Inbox help, please.", packageSlug: null };
const source = { ipHash: "c".repeat(64), userAgent: "UA" };
const SLOT = "2026-11-03T01:00:00.000Z";

describe("submitContactRequest", () => {
  beforeEach(() => vi.resetAllMocks());

  it("books the chosen time with the lead and its source", async () => {
    dal.insertDiscoveryRequest.mockResolvedValue({ ok: true, id: "lead-1" });
    expect(await submitContactRequest(lead, SLOT, source)).toEqual({ ok: true, id: "lead-1" });
    expect(dal.insertDiscoveryRequest).toHaveBeenCalledWith({ ...lead, ...source }, SLOT);
    expect(dal.insertLead).not.toHaveBeenCalled();
  });

  it("passes on the database's refusal", async () => {
    dal.insertDiscoveryRequest.mockResolvedValue({ ok: false, message: "That time was just taken. Choose another." });
    expect(await submitContactRequest(lead, SLOT, source)).toEqual({ ok: false, message: "That time was just taken. Choose another." });
    expect(dal.insertLead).not.toHaveBeenCalled();
  });
});

const owned = { closerId: "closer-1", status: "new", disabledAt: null };

describe("logOwnedLeadStep", () => {
  beforeEach(() => vi.resetAllMocks());

  it("refuses a lead this closer does not own", async () => {
    dal.getLead.mockResolvedValue(null);
    expect(await logOwnedLeadStep("closer-1", { leadId: "lead-1", kind: "call", body: "Demo at 2." })).toEqual({ ok: false, reason: "not_found" });
    expect(timeline.recordOwnedLeadStep).not.toHaveBeenCalled();
  });

  it("refuses a step that does not match the lead's status", async () => {
    dal.getLead.mockResolvedValue({ ...owned, status: "contacted" });
    expect(await logOwnedLeadStep("closer-1", { leadId: "lead-1", kind: "call", body: "Demo at 2." })).toEqual({ ok: false, reason: "unavailable" });
    expect(timeline.recordOwnedLeadStep).not.toHaveBeenCalled();
  });

  it("refuses junk, notes and conversion", async () => {
    dal.getLead.mockResolvedValue(owned);
    expect(await logOwnedLeadStep("closer-1", { leadId: "lead-1", kind: "junk", body: "Not a fit." })).toEqual({ ok: false, reason: "unavailable" });
    expect(timeline.recordOwnedLeadStep).not.toHaveBeenCalled();
  });

  it("records a demo on a new lead this closer owns", async () => {
    dal.getLead.mockResolvedValue(owned);
    timeline.recordOwnedLeadStep.mockResolvedValue({ ok: true });
    expect(await logOwnedLeadStep("closer-1", { leadId: "lead-1", kind: "call", body: "Demo at 2." })).toEqual({ ok: true });
    expect(timeline.recordOwnedLeadStep).toHaveBeenCalledWith("closer-1", "lead-1", "call", "Demo at 2.");
  });
});
