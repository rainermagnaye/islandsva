import { appRoutes } from "@/content/routes";
import { listActiveAssignments } from "@/features/clients/assignment-dal";
import { getOwnClientId } from "@/features/clients/dal";
import { maySeeAvatar } from "@/features/users/avatar-access";
import { getEmployeeAvatar } from "@/features/users/employee-dal";
import { parseEmployeeId } from "@/features/users/validation";
import { needsSecondFactor, requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { UpstreamError } from "@/lib/upstream-error";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function assignedVaIds(userId: string, roles: readonly string[]) {
  if (!roles.includes("client")) return [];
  const clientId = await getOwnClientId(userId);
  if (!clientId) return [];
  const assignments = await listActiveAssignments(clientId);
  return assignments.map((assignment) => assignment.vaId);
}

// The picture bytes are not granted to the signed-in role, so this is a small authenticated download
// rather than a column on the profile query. It is not a JSON API, so it does not use createHandler.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (needsSecondFactor(user)) redirect(appRoutes.mfa);
  const { id } = await context.params;
  if (!parseEmployeeId({ userId: id }).ok) return new Response(null, { status: 404 });
  // The person, an admin, or a client who is actively assigned to this VA. Anyone else gets the same 404.
  const assigned = user.id === id || user.roles.includes("admin") ? [] : await assignedVaIds(user.id, user.roles);
  if (!maySeeAvatar({ viewerId: user.id, roles: user.roles, subjectId: id, assignedVaIds: assigned })) return new Response(null, { status: 404 });

  try {
    const avatar = await getEmployeeAvatar(id);
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
