import "server-only";
import { after } from "next/server";

/** Run work after the response when inside a request, inline otherwise (scripts). */
export function defer(task: () => Promise<unknown>) {
  const run = () => task().catch((error) => console.error("[deferred task failed]", error));
  try {
    after(run);
  } catch {
    void run();
  }
}
