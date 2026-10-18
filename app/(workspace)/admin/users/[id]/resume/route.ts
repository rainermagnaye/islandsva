import { getStaffResume } from "@/features/users/dal";
import { parseStaffId } from "@/features/users/validation";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";

const TYPES = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

// Résumé bytes are not granted to the signed-in role, so this is an authenticated download after the admin check.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await context.params;
  if (!parseStaffId({ userId: id }).ok) return new Response(null, { status: 404 });

  try {
    const resume = await getStaffResume(id);
    if (!resume || !TYPES.has(resume.type)) return new Response(null, { status: 404 });
    const filename = resume.name.replace(/["\r\n]/g, "");
    return new Response(Buffer.from(resume.bytes), {
      headers: {
        "Content-Type": resume.type,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Résumé failed", { service: error.service, error });
    return new Response(null, { status: 404 });
  }
}
