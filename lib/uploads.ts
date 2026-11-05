import "server-only";
import path from "node:path";

/**
 * Where uploads live when Vercel Blob isn't used. Point UPLOAD_DIR outside the
 * app folder in production so a redeploy doesn't delete them.
 */
export function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
}
