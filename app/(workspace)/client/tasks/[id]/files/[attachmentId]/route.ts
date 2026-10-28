import { getTaskAttachment } from "@/features/tasks/dal";
import { requireRole } from "@/lib/auth/session";
import { isUuid } from "@/lib/uuid";
import { UpstreamError } from "@/lib/upstream-error";

const TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "application/pdf", "image/jpeg", "image/png"]);

/** A file on a task the signed-in client can already read. */
export async function GET(_request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  await requireRole(["client"]);
  const { id, attachmentId } = await context.params;
  if (!isUuid(id) || !isUuid(attachmentId)) return new Response(null, { status: 404 });

  try {
    const file = await getTaskAttachment(id, attachmentId);
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
    console.error("Task attachment failed", { service: error.service, error });
    return new Response(null, { status: 404 });
  }
}
