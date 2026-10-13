import "server-only";
import { inflateRawSync } from "node:zlib";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF = "application/pdf";

/** Plain text from a DOCX or a PDF whose text is stored as ordinary strings. Empty when the file has none. */
export function resumeText(bytes: Uint8Array, type: string): string {
  if (type === DOCX) return docxText(bytes);
  if (type === PDF) return pdfText(bytes);
  return "";
}

export type ParsedResume = {
  highestEducation: string;
  certifications: string;
  skills: string;
  languages: string;
  keyResponsibilities: string;
};

/** Pulls the headed sections a résumé usually has. Missing headings stay blank. */
export function parseResumeText(text: string): ParsedResume {
  const section = (labels: string[], max: number) => {
    const pattern = new RegExp(`(?:^|\\n)\\s*(?:${labels.join("|")})\\s*[:\\-]?\\s*\\n([\\s\\S]*?)(?=\\n\\s*[A-Z][^\\n]{0,48}\\s*\\n|$)`, "i");
    return (text.match(pattern)?.[1] ?? "").replace(/[^\S\n]+/g, " ").trim().slice(0, max);
  };
  const education = section(["education", "academic background", "educational attainment"], 160);
  return {
    highestEducation: education.split("\n")[0]?.trim() ?? "",
    certifications: section(["certifications", "licenses", "certification"], 500),
    skills: section(["skills", "technical skills", "core skills"], 500),
    languages: section(["languages", "languages spoken"], 200),
    keyResponsibilities: section(["experience", "work experience", "employment", "professional experience"], 2000),
  };
}

function docxText(bytes: Uint8Array): string {
  const xml = zipEntry(bytes, "word/document.xml");
  if (!xml) return "";
  return xml
    .replace(/<w:p\b[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pdfText(bytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(bytes);
  const parts: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let text = match[1];
    try {
      text = new TextDecoder("latin1").decode(inflateRawSync(Buffer.from(match[1], "latin1")));
    } catch {
      // The stream was already plain text.
    }
    const pieces = text.match(/\((?:\\.|[^\\)])*\)/g) ?? [];
    if (pieces.length > 0) {
      parts.push(pieces.map((piece) => piece.slice(1, -1).replace(/\\n/g, "\n").replace(/\\(.)/g, "$1")).join(" "));
    }
  }
  return parts.join("\n").replace(/[^\S\n]+/g, " ").trim();
}

/** Reads one stored file out of a zip. DOCX files from Word include the compressed size, which this needs. */
function zipEntry(bytes: Uint8Array, wanted: string): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 30 < bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    const data = bytes.subarray(dataStart, dataStart + size);
    if (name === wanted) {
      if (method === 0) return new TextDecoder().decode(data);
      if (method === 8) return new TextDecoder().decode(inflateRawSync(data));
      return null;
    }
    offset = dataStart + size;
  }
  return null;
}
