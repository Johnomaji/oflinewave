/**
 * Zips the source code for hosts that build it themselves (Hostinger Node.js apps…):
 *   npm run zip:source   →   dist/oflinewave-source-<date>.zip
 *
 * Leaves out node_modules, build output, local uploads and every .env file except
 * .env.example. Secrets go in the host's environment variable settings instead.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
// Windows: use its built-in bsdtar, not a GNU tar from Git Bash (which reads "C:" as a remote host).
const TAR = process.platform === "win32" ? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";

const EXCLUDE = [
  "./node_modules", "./.next", "./dist", "./uploads", "./public/uploads", "./.git", "./.vercel", "./.claude",
  "./.env", "./.env.local", "./.env.*.local", "./.env.development", "./.env.production",
  "./lib/generated", "*.tsbuildinfo", "./next-env.d.ts",
];

const dist = path.join(root, "dist");
mkdirSync(dist, { recursive: true });
const zip = path.join(dist, `oflinewave-source-${new Date().toISOString().slice(0, 10)}.zip`);
rmSync(zip, { force: true });
execFileSync(TAR, ["-a", "-c", "-f", zip, ...EXCLUDE.flatMap((p) => ["--exclude", p]), "-C", root, "."], { stdio: "inherit" });

const listing = execFileSync(TAR, ["-t", "-f", zip]).toString();
const leaked = listing.split(/\r?\n/).filter((f) => /(^|\/)\.env(?!\.example$)/.test(f) || f.includes("node_modules/"));
if (leaked.length) {
  rmSync(zip);
  console.error("Stopped: the zip would have included", leaked.slice(0, 5));
  process.exit(1);
}
console.log(`\nUpload this file: ${path.relative(root, zip)}  (${(statSync(zip).size / 1e6).toFixed(1)} MB)`);
console.log("Then follow DEPLOY.md (option A).");
