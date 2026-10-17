import { describe, expect, it } from "vitest";
import { acceptLeadAttachment } from "./attachment";

const file = { name: "call.mp3", type: "audio/mpeg", size: 1200 };

describe("acceptLeadAttachment", () => {
  it("keeps a short recording and uses the name typed beside it", () => {
    expect(acceptLeadAttachment(file)).toEqual({ ok: true, name: "call.mp3", type: "audio/mpeg" });
    expect(acceptLeadAttachment(file, "Discovery call")).toEqual({ ok: true, name: "Discovery call.mp3", type: "audio/mpeg" });
  });

  it("rejects a file over 2 MB, an empty file, and a type we do not store", () => {
    expect(acceptLeadAttachment({ ...file, size: 2_097_153 })).toEqual({ ok: false, message: "Keep the attachment under 2 MB." });
    expect(acceptLeadAttachment({ ...file, size: 0 }).ok).toBe(false);
    expect(acceptLeadAttachment({ name: "notes.exe", type: "application/octet-stream", size: 10 }).ok).toBe(false);
  });
});
