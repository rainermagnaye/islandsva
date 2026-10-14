import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { resumeText } from "./resume-text";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF = "application/pdf";

/** A one-entry zip (local file header only — all the parser reads), deflated (method 8). */
function zip(name: string, content: Buffer) {
  const data = deflateRawSync(content);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(8, 8); // method: deflate
  header.writeUInt32LE(data.length, 18); // compressed size
  header.writeUInt32LE(content.length, 22); // uncompressed size
  header.writeUInt16LE(Buffer.byteLength(name), 26);
  return new Uint8Array(Buffer.concat([header, Buffer.from(name), data]));
}

const documentXml = (text: string) => Buffer.from(`<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);

describe("resumeText", () => {
  it("reads the text of an ordinary DOCX", () => {
    expect(resumeText(zip("word/document.xml", documentXml("Skills")), DOCX)).toBe("Skills");
  });

  it("gives up on a zip bomb instead of exhausting memory", () => {
    // ~50 MB of zeros deflates to ~50 KB: well under the 2 MB upload cap, far over the inflate limit.
    const bomb = zip("word/document.xml", Buffer.alloc(50 * 1024 * 1024));
    expect(bomb.byteLength).toBeLessThan(2 * 1024 * 1024);
    expect(resumeText(bomb, DOCX)).toBe("");
  });

  it("returns nothing for a truncated or corrupt file rather than throwing", () => {
    const truncated = zip("word/document.xml", documentXml("Skills")).subarray(0, 40);
    expect(resumeText(truncated, DOCX)).toBe("");
    expect(resumeText(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), DOCX)).toBe("");
  });

  it("treats an oversized PDF stream as plain text instead of inflating it", () => {
    const bomb = deflateRawSync(Buffer.alloc(50 * 1024 * 1024));
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\nstream\n"), bomb, Buffer.from("\nendstream\n(Hello) Tj\n")]);
    expect(() => resumeText(new Uint8Array(pdf), PDF)).not.toThrow();
  });
});
