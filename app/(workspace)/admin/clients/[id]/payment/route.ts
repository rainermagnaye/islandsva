import { getClient } from "@/features/clients/dal";
import { getClientPaymentProof } from "@/features/clients/onboarding-dal";
import { parseClientId } from "@/features/clients/validation";
import { requireRole } from "@/lib/auth/session";
import { UpstreamError } from "@/lib/upstream-error";

const TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

// Proof bytes are not granted to the signed-in role. The client read above is the access check.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await context.params;
  if (!parseClientId({ clientId: id }).ok) return new Response(null, { status: 404 });

  try {
    const client = await getClient(id);
    if (!client) return new Response(null, { status: 404 });
    const proof = await getClientPaymentProof(id);
    if (!proof || !TYPES.has(proof.type)) return new Response(null, { status: 404 });
    const filename = proof.name.replace(/["\r\n]/g, "");
    return new Response(Buffer.from(proof.bytes), {
      headers: {
        "Content-Type": proof.type,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error("Payment proof failed", { service: error.service, error });
    return new Response(null, { status: 404 });
  }
}
