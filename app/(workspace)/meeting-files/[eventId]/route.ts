import { getBookingAttachment } from "@/features/meetings/dal";
import { requireUser } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";

const TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg", "application/pdf", "image/jpeg", "image/png"]);

// Not a JSON API. The signed-in person downloads a file only when they can already see that booking.
export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  await requireUser();
  const { eventId } = await context.params;

  try {
    const file = await getBookingAttachment(eventId);
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
    console.error("Booking attachment failed", { service: error.service, error });
    return new Response(null, { status: 404 });
  }
}
