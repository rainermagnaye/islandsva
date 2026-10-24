import { describe, expect, it } from "vitest";
import { contentDisposition } from "./content-disposition";

const header = (value: string) => new Response(null, { headers: { "Content-Disposition": value } }).headers.get("Content-Disposition");
const realName = (value: string) => decodeURIComponent(value.split("filename*=UTF-8''")[1]);

describe("contentDisposition", () => {
  it("is a valid header for any name, where a plain quoted name throws", () => {
    for (const name of ["履歴書.pdf", "cv 📄.pdf", "Résumé.pdf", "Ana's notes (final).pdf"]) {
      expect(() => header(contentDisposition(name))).not.toThrow();
    }
    expect(() => header(`inline; filename="履歴書.pdf"`)).toThrow();
  });

  it("keeps the real name in filename* and a readable ASCII fallback in filename", () => {
    const value = contentDisposition("Résumé 2026.pdf");
    expect(value).toContain(`filename="Resume 2026.pdf"`);
    expect(realName(value)).toBe("Résumé 2026.pdf");
    expect(realName(contentDisposition("履歴書.pdf"))).toBe("履歴書.pdf");
    expect(contentDisposition("履歴書.pdf")).toContain(`filename="___.pdf"`);
  });

  it("can't be used to break out of the header or add another one", () => {
    const value = contentDisposition(`evil"\r\nSet-Cookie: x=1.pdf`);
    expect(value).not.toMatch(/[\r\n]/);
    expect(value.split(";")[1]).toBe(` filename="evilSet-Cookie: x=1.pdf"`);
    expect(value).toContain("filename*=UTF-8''evilSet-Cookie%3A%20x%3D1.pdf");
  });

  it("encodes the characters RFC 8187 reserves, and falls back to a name when none is left", () => {
    expect(contentDisposition("a'b(c)*.pdf")).toContain("filename*=UTF-8''a%27b%28c%29%2A.pdf");
    expect(contentDisposition('""')).toBe(`inline; filename="file"; filename*=UTF-8''file`);
    expect(contentDisposition("x.pdf", "attachment").startsWith("attachment;")).toBe(true);
  });
});
