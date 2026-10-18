import { describe, expect, it } from "vitest";
import { acceptClientAttachment } from "./attachment";

const file = { name: "note.pdf", type: "application/pdf", size: 1200 };

describe("acceptClientAttachment", () => {
  it("keeps a short file and uses the name typed beside it", () => {
    expect(acceptClientAttachment(file)).toEqual({ ok: true, name: "note.pdf", type: "application/pdf" });
    expect(acceptClientAttachment(file, "Start date")).toEqual({ ok: true, name: "Start date.pdf", type: "application/pdf" });
  });

  it("rejects a file over 2 MB, an empty file, and a type we do not store", () => {
    expect(acceptClientAttachment({ ...file, size: 2_097_153 })).toEqual({ ok: false, message: "Keep the attachment under 2 MB." });
    expect(acceptClientAttachment({ ...file, size: 0 }).ok).toBe(false);
    expect(acceptClientAttachment({ name: "notes.exe", type: "application/octet-stream", size: 10 }).ok).toBe(false);
  });
});