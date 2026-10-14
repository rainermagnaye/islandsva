import "server-only";
import { inflateRawSync } from "node:zlib";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF = "application/pdf";

// The file is untrusted: a few hundred kilobytes of compressed data can expand to gigabytes (a zip bomb).
// Each decompression stops at MAX_INFLATED, and the text kept stops at MAX_TEXT before the section regexes
// run over it. A résumé's text is a few kilobytes, so neither limit affects a real one.
const MAX_INFLATED = 4 * 1024 * 1024;
const MAX_TEXT = 200_000;

/** Decompresses raw deflate data, or null if it is corrupt or would exceed MAX_INFLATED. */
function inflate(data: Uint8Array): Buffer | null {
  try {
    return inflateRawSync(data, { maxOutputLength: MAX_INFLATED });
  } catch {
    return null;
  }
}

/**
 * Plain text from a DOCX or a PDF whose text is stored as ordinary strings. Empty when the file has none,
 * is malformed, or is oversized once decompressed — the résumé is still saved, just not read.
 */
export function resumeText(bytes: Uint8Array, type: string): string {
  try {
    const text = type === DOCX ? docxText(bytes) : type === PDF ? pdfText(bytes) : "";
    return text.slice(0, MAX_TEXT);
  } catch {
    // A truncated or hand-crafted file can make the zip walk read past the end of the buffer.
    return "";
  }
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
  const bounded = text.slice(0, MAX_TEXT);
  const section = (labels: string[], max: number) => {
    const pattern = new RegExp(`(?:^|\\n)\\s*(?:${labels.join("|")})\\s*[:\\-]?\\s*\\n([\\s\\S]*?)(?=\\n\\s*[A-Z][^\\n]{0,48}\\s*\\n|$)`, "i");
    return (bounded.match(pattern)?.[1] ?? "").replace(/[^\S\n]+/g, " ").trim().slice(0, max);
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
  let total = 0;
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    if (total >= MAX_TEXT) break;
    // Not deflate, corrupt or over the limit: treat the stream as plain text.
    const inflated = inflate(Buffer.from(match[1], "latin1"));
    const text = inflated ? new TextDecoder("latin1").decode(inflated) : match[1];
    const pieces = text.match(/\((?:\\.|[^\\)])*\)/g) ?? [];
    if (pieces.length > 0) {
      const part = pieces.map((piece) => piece.slice(1, -1).replace(/\\n/g, "\n").replace(/\\(.)/g, "$1")).join(" ");
      parts.push(part);
      total += part.length;
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
      if (method === 8) {
        const inflated = inflate(data);
        return inflated ? new TextDecoder().decode(inflated) : null;
      }
      return null;
    }
    offset = dataStart + size;
  }
  return null;
}
