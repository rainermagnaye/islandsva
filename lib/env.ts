import "server-only";

// Server-only configuration. Values are read per call so a missing variable fails the request that
// needs it (logged + 503), not the whole site. Shared defaults are in .env; see its comments for every key (real values go in .env.local).
export const env = {
  supabaseUrl: () => process.env.SUPABASE_URL,
  /** sb_publishable_… — respects RLS; used with the visitor's session cookie. */
  supabasePublishableKey: () => process.env.SUPABASE_PUBLISHABLE_KEY,
  /** sb_secret_… — bypasses RLS; lib/supabase/admin.ts only. */
  supabaseSecretKey: () => process.env.SUPABASE_SECRET_KEY,
  turnstileSecretKey: () => process.env.TURNSTILE_SECRET_KEY,
  resendApiKey: () => process.env.RESEND_API_KEY,
  leadsNotifyEmail: () => process.env.LEADS_NOTIFY_EMAIL,
  emailFrom: () => process.env.EMAIL_FROM,
  ipHashSecret: () => process.env.IP_HASH_SECRET,
  isProduction: () => process.env.NODE_ENV === "production",
  /** The live site on Vercel — false for preview deployments and local production builds. */
  isLiveDeployment: () => process.env.VERCEL_ENV === "production",
};
