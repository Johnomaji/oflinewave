import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    // Role is read from the database per request (lib/dal.ts), not stored in the session.
    user: { id: string } & DefaultSession["user"];
    /** User.sessionVersion when this session signed in. lib/dal.ts rejects it once that changes. */
    sessionVersion: number;
    /** Signed in with a staff password, rather than an email link or Google. */
    viaPassword: boolean;
  }
}
