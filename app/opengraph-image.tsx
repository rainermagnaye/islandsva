import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import { site } from "@/content/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The logo file only changes with a deploy, so cache it for as long as possible (the default profile
// would regenerate this image every 15 minutes).
async function logoDataUri() {
  "use cache";
  cacheLife("max");
  const logo = await readFile(join(process.cwd(), "public/logo/lockup-night.png"));
  return `data:image/png;base64,${logo.toString("base64")}`;
}

// Social preview card, generated at build time from the logo and brand colours.
export default async function OpenGraphImage() {
  const logoSrc = await logoDataUri();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0e3a45",
          color: "#f5e8d3",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
        <img src={logoSrc} width={469} height={160} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>Your business, handled while you sleep</div>
          <div style={{ fontSize: 32, color: "#b9d3cf" }}>{`Dedicated virtual assistants — ${site.tagline.toLowerCase()}`}</div>
        </div>
        <div style={{ display: "flex", height: 12, width: "100%", borderRadius: 999, background: "linear-gradient(90deg, #7dd3c9, #ffb662)" }} />
      </div>
    ),
    size,
  );
}
