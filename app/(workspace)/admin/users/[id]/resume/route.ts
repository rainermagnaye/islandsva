import { getStaffResume } from "@/features/users/dal";
import { contentDisposition } from "@/lib/api/content-disposition";
import { parseStaffId } from "@/features/users/validation";
import { needsSecondFactor, requireUser } from "@/lib/auth/session";
import { appRoutes } from "@/content/routes";
import { redirect } from "next/navigation";
import { UpstreamError } from "@/lib/upstream-error";

const TYPES = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

// Résumé bytes are not granted to the signed-in role, so this is an authenticated download after the admin check.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (needsSecondFactor(user)) redirect(appRoutes.mfa);
  const { id } = await context.params;
  if (!parseStaffId({ userId: id }).ok) return new Response(null, { status: 404 });
  if (user.id !== id && !user.roles.includes("admin")) return new Response(null, { status: 404 });

  try {
    const resume = await getStaffResume(id);
    if (!resume || !TYPES.has(resume.type)) return new Response(null, { status: 404 });
    return new Response(Buffer.from(resume.bytes), {
      headers: {
        "Content-Type": resume.type,
        "Content-Disposition": contentDisposition(resume.name),
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
