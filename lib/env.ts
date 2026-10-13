import "server-only";

// Server-only configuration. Values are read per call so a missing variable fails the request that
// needs it (logged + 503), not the whole site. See .env.example for every key.
export const env = {
  supabaseUrl: () => process.env.SUPABASE_URL,
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
