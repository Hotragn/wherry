"use client";

import { useEffect } from "react";

/** Registers the service worker that keeps /app and /play working offline after the first visit. */
export function OfflineShell() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Without a service worker the app still works online.
      });
    }
  }, []);
  return null;
}
