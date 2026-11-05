"use client";

import { useEffect } from "react";

/** Registers the service worker (production only, so dev never serves stale pages). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      console.warn("[sw] registration failed", error);
    });
  }, []);
  return null;
}
