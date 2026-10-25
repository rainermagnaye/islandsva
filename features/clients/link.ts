import "server-only";
import { headers } from "next/headers";
import { registrationHref } from "@/content/routes";

const LOCAL = "http://localhost:3000";

/**
 * The app the admin has open, not the marketing site. Local work is localhost.
 * On Vercel the host is that deployment, so the same token is copied with that address.
 */
export function originFrom(host: string | null, proto: string | null) {
  if (!host || host.length > 255 || /[\s/@\\]/.test(host)) return LOCAL;
  const protocol = proto === "http" || proto === "https" ? proto : host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function registrationOrigin() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-proto");
  return originFrom(headerList.get("x-forwarded-host") ?? headerList.get("host"), forwarded);
}

/** Absolute registration URL. The token is the only secret. */
export function onboardingUrl(token: string, origin: string) {
  return `${origin.replace(/\/$/, "")}${registrationHref(token)}`;
}
