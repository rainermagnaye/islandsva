import { appRoutes } from "@/content/routes";
import { getStaffAvatar } from "@/features/users/dal";
import { parseStaffId } from "@/features/users/validation";
import { needsSecondFactor, requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { UpstreamError } from "@/lib/upstream-error";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// The picture bytes are not granted to the signed-in role, so this is a small authenticated download
// rather than a column on the profile query. It is not a JSON API, so it does not use createHandler.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (needsSecondFactor(user)) redirect(appRoutes.mfa);
  const { id } = await context.params;
  if (!parseStaffId({ userId: id }).ok) return new Response(null, { status: 404 });
  if (user.id !== id && !user.roles.includes("admin")) return new Response(null, { status: 404 });

  try {
    const avatar = await getStaffAvatar(id);
    if (!avatar || !TYPES.has(avatar.type)) return new Response(null, { status: 404 });
    return new Response(Buffer.from(avatar.bytes), {
      headers: {
        "Content-Type": avatar.type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Profile picture failed", { service: error.service, error });
    return new Response(null, { status: 404 });
  }
}
