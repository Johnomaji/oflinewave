/**
 * Builds the upload for a Node host (cPanel "Setup Node.js App", a VPS…):
 *   npm run package   →   dist/oflinewave-<date>.zip
 *
 * The zip is the standalone server (server.js + only the node_modules it needs)
 * plus public/ and .next/static. Unzip it into the app root and start server.js.
 * Secrets are NOT included: set them as environment variables on the host.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
// Windows: use its built-in bsdtar, not a GNU tar from Git Bash (which reads "C:" as a remote host).
const TAR = process.platform === "win32" ? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });

// The build prerenders public pages from the database and bakes in APP_URL, so it must see the
// LIVE values. Next reads .env.production.local over .env for builds; put them there.
const { combinedEnv } = createRequire(import.meta.url)("@next/env").loadEnvConfig(root, false, { info() {}, error: console.error });
const isLocal = (url) => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url || "http://localhost").hostname);
if ((isLocal(combinedEnv.DATABASE_URL) || isLocal(combinedEnv.APP_URL)) && !process.argv.includes("--allow-local")) {
  console.error(`DATABASE_URL or APP_URL points at this computer, so the upload would show your local test data and localhost links.

Create .env.production.local next to .env with the live values:
  DATABASE_URL="postgresql://…your live database…"
  APP_URL="https://oflinewave.com"
(plus any NEXT_PUBLIC_… values you use). It stays on your computer and isn't put in the zip.

To package against local data anyway (testing only): npm run package -- --allow-local`);
  process.exit(1);
}

if (!process.argv.includes("--skip-build")) run("npm", ["run", "build"], { env: { ...process.env, STANDALONE: "1" } });
if (!existsSync(path.join(standalone, "server.js"))) {
  console.error('No .next/standalone/server.js. Did the build run with STANDALONE=1?');
  process.exit(1);
}

// 1. Static files: server.js serves these itself when they sit next to it.
cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
rmSync(path.join(standalone, "public", "uploads"), { recursive: true, force: true });

// 2. Never ship local secrets (Next copies .env files in). Some server code reads files from
//    the project folder, so the tracer also copies source and docs; drop those too. (Trimming
//    with outputFileTracingExcludes instead made the tracer miss Prisma and pg dependencies.)
const DROP = ["app", "components", "scripts", "dist", "uploads", "tsconfig.tsbuildinfo", "eslint.config.mjs"];
for (const f of readdirSync(standalone)) {
  if (f.startsWith(".env") || f.endsWith(".md") || DROP.includes(f)) rmSync(path.join(standalone, f), { recursive: true, force: true });
}

// 3. Windows builds can leave symlinks/junctions with absolute paths. Replace them with real copies.
function dereference(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) {
      const target = realpathSync(p);
      rmSync(p, { recursive: true, force: true });
      cpSync(target, p, { recursive: true, dereference: true });
      console.log("  copied link", path.relative(standalone, p));
    } else if (st.isDirectory()) dereference(p);
  }
}
dereference(standalone);

// 4. Image optimisation needs sharp's Linux binary on the server (most cPanel hosts are Linux x64).
const sharpPkg = JSON.parse(readFileSync(path.join(root, "node_modules", "sharp", "package.json"), "utf8"));
const linuxPkgs = ["@img/sharp-linux-x64", "@img/sharp-libvips-linux-x64"];
const tmp = mkdtempSync(path.join(os.tmpdir(), "ow-sharp-"));
for (const name of linuxPkgs) {
  const spec = `${name}@${sharpPkg.optionalDependencies[name]}`;
  const tgz = execFileSync("npm", ["pack", spec, "--silent", "--pack-destination", tmp], { shell: process.platform === "win32" })
    .toString().trim().split(/\r?\n/).pop();
  const dest = path.join(standalone, "node_modules", ...name.split("/"));
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  run(TAR, ["-xzf", path.join(tmp, tgz), "-C", dest, "--strip-components=1"]);
  console.log("  added", spec);
}
rmSync(tmp, { recursive: true, force: true });

// 5. Zip with forward-slash paths (bsdtar ships with Windows 10+, macOS and most Linux).
const dist = path.join(root, "dist");
mkdirSync(dist, { recursive: true });
const zip = path.join(dist, `oflinewave-${new Date().toISOString().slice(0, 10)}.zip`);
rmSync(zip, { force: true });
run(TAR, ["-a", "-c", "-f", zip, "-C", standalone, "."]);
console.log(`\nUpload this file: ${path.relative(root, zip)}  (${(lstatSync(zip).size / 1e6).toFixed(1)} MB)`);
console.log("Then follow DEPLOY.md (option B).");
