export type InviteFailure = "exists" | "rate";

/** Turns a Supabase Auth invite error into a result the form can explain. Anything else is an outage. */
export function classifyInviteError(error: { code?: string | null; message: string }): InviteFailure | null {
  const code = error.code ?? "";
  if (code === "email_exists") return "exists";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return "rate";
  return null;
}
