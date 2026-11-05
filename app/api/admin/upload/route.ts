import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { getCurrentUser, isAdmin } from "@/lib/dal";
import { uploadDir } from "@/lib/uploads";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

/**
 * Poster/gallery uploads. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set;
 * otherwise files go to disk (UPLOAD_DIR) and are served by app/uploads.
 * Disk is fine on a VPS or cPanel, but not on Vercel, where it is wiped.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return Response.json({ error: "Not allowed" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: "Use JPG, PNG, WebP or AVIF" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Max 5 MB" }, { status: 400 });

  const name = `posters/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(name, file, { access: "public", contentType: file.type });
    return Response.json({ url: blob.url });
  }
  if (process.env.VERCEL) {
    return Response.json({ error: "Uploads need BLOB_READ_WRITE_TOKEN" }, { status: 500 });
  }

  const target = path.join(uploadDir(), name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return Response.json({ url: `/uploads/${name}` });
}
