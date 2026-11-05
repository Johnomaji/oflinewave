import { ImageResponse } from "next/og";
import { OgWave, Wordmark, logoSrc } from "@/lib/og";
import { tokens } from "@/lib/tokens";

export const alt = "Oflinewave: Get offline. Get loud.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const c = tokens.colors;

export default async function Image() {
  const logo = await logoSrc();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: c.black, color: c.white, position: "relative" }}>
        <Wordmark src={logo} height={80} />
        <div style={{ display: "flex", flexDirection: "column", fontSize: 128, fontWeight: 800, lineHeight: 0.9, letterSpacing: -5, marginTop: 40 }}>
          <span>Get offline.</span>
          <span style={{ color: c.orange }}>Get loud.</span>
        </div>
        <OgWave />
      </div>
    ),
    size,
  );
}
