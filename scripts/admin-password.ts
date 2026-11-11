/**
 * Creates a super admin, or resets an admin's password, straight in the database. This is how the
 * first admin gets in (staff sign in with passwords only, and there's nobody yet to add them).
 *
 *   npm run admin:password -- you@email.com           (live database: .env.production.local)
 *   npm run admin:password -- you@email.com --local   (database in .env)
 */
import { createInterface } from "node:readline";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "../lib/generated/prisma/client";
import { MIN_PASSWORD_LENGTH, hashPassword } from "../lib/password";

const args = process.argv.slice(2);
const local = args.includes("--local");
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:password -- you@email.com [--local]");
  process.exit(1);
}

loadEnvConfig(process.cwd(), local, { info() {}, error: console.error });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error(local ? "DATABASE_URL isn't set in .env." : "DATABASE_URL isn't set. Put the live one in .env.production.local.");
  process.exit(1);
}

// One reader for every question: a second one would miss lines the first already buffered.
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const out = rl as unknown as { _writeToOutput: (s: string) => void };
const write = out._writeToOutput.bind(rl);
let masked = false;
// While a password is being typed, echo stars instead of the characters.
out._writeToOutput = (s) => write(masked ? s.replace(/[^\r\n]/g, "*") : s);

// The iterator queues lines, so answers piped in all at once aren't dropped.
const lines = rl[Symbol.asyncIterator]();

async function ask(question: string, hidden = false) {
  write(question);
  masked = hidden;
  const { value } = await lines.next();
  masked = false;
  if (hidden && process.stdin.isTTY) write("\n");
  return (value as string | undefined) ?? "";
}

async function main() {
  const host = new URL(url!).hostname;
  console.log(`Database: ${host}${local ? " (local)" : " (LIVE)"}`);
  console.log(`Account:  ${email} → super admin`);
  if ((await ask("Continue? (y/N) ")).trim().toLowerCase() !== "y") return console.log("Cancelled.");

  const password = await ask("New password: ", true);
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  if ((await ask("Same password again: ", true)) !== password) throw new Error("The passwords don't match.");

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const passwordHash = await hashPassword(password);
    const data = { role: "SUPER_ADMIN" as const, passwordHash, mustChangePassword: false };
    // Raising sessionVersion signs this account out everywhere: the fix for a leaked password.
    await db.user.upsert({ where: { email }, update: { ...data, sessionVersion: { increment: 1 } }, create: { email: email!, ...data } });
    await db.staffMember.upsert({
      where: { email },
      update: { role: "SUPER_ADMIN" },
      create: { email: email!, role: "SUPER_ADMIN", acceptedAt: new Date() },
    });
  } finally {
    await db.$disconnect();
  }
  console.log(`Done. Any existing sessions for ${email} are signed out. Sign in at /login → Staff with that password.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
