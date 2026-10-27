import { getClientNoteAttachment } from "@/features/clients/notes-dal";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";

const TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg", "application/pdf", "image/jpeg", "image/png"]);

// Not a JSON API: an admin opens one file they can already see on a client note.
export async function GET(_request: Request, context: { params: Promise<{ id: string; noteId: string }> }) {
  await requireRole(["admin"]);
  const { id, noteId } = await context.params;

  try {
    const file = await getClientNoteAttachment(id, noteId);
    if (!file || !TYPES.has(file.type)) return new Response(null, { status: 404 });
    const filename = file.name.replace(/["\r\n]/g, "");
    return new Response(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": file.type,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Client attachment failed", { service: error.service, error });
    return new Response(null, { status: 404 });
  }
}
