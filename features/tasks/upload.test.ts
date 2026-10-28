import { describe, expect, it } from "vitest";
import { readFiles } from "./upload";

const pdf = (name: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type: "application/pdf" });

describe("readFiles", () => {
  it("reads accepted files", async () => {
    const read = await readFiles([pdf("brief.pdf", 10)]);
    expect(read).toMatchObject({ ok: true, files: [{ name: "brief.pdf", contentType: "application/pdf" }] });
  });

  it("refuses more than three files, over 2 MB in total, and a type we don't store", async () => {
    expect(await readFiles([pdf("a.pdf", 1), pdf("b.pdf", 1), pdf("c.pdf", 1), pdf("d.pdf", 1)])).toEqual({ ok: false, message: "Attach up to 3 files." });
    expect(await readFiles([pdf("a.pdf", 1_100_000), pdf("b.pdf", 1_100_000)])).toEqual({ ok: false, message: "Keep the attachments under 2 MB in total." });
    expect(await readFiles([new File(["x"], "run.exe", { type: "application/x-msdownload" })])).toMatchObject({ ok: false });
  });
});
