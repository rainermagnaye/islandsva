import { getLeadAttachment } from "@/features/leads/timeline-dal";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";

const TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg", "application/pdf", "image/jpeg", "image/png"]);

// Not a JSON API: an admin downloads one file they can already see on the timeline.
export async function GET(_request: Request, context: { params: Promise<{ id: string; eventId: string }> }) {
  await requireRole(["admin"]);
  const { id, eventId } = await context.params;

  try {
    const file = await getLeadAttachment(id, eventId);
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
    console.error("Lead attachment failed", { service: error.service, error });
    return new Response(null, { status: 404 });
  }
}
