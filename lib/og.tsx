import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { tokens } from "@/lib/tokens";

const c = tokens.colors;

/** Satori needs image data: inline local /public files, pass remote URLs through. */
export async function imageSrc(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  const file = await readFile(path.join(process.cwd(), "public", url.replace(/^\//, "")));
  const mime = url.endsWith(".svg") ? "image/svg+xml" : url.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${file.toString("base64")}`;
}

/** The logo, inlined for Satori. Await it before rendering: `const logo = await logoSrc()`. */
export const logoSrc = () => imageSrc("/brand/logo.png");

export function Wordmark({ src, height = 56 }: { src: string; height?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Oflinewave" height={height} width={Math.round((height * 462) / 136)} />;
}

/** The orange wave at the bottom of every share card. */
export function OgWave() {
  return (
    <svg width="1200" height="120" viewBox="0 0 1200 120" style={{ position: "absolute", bottom: 0, left: 0 }}>
      <path d="M0 70 C 150 20, 300 120, 450 70 S 750 20, 900 70 S 1100 110, 1200 60" fill="none" stroke={c.orange} strokeWidth="6" />
    </svg>
  );
}
