"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (/sw.js) once the page has loaded.
 * Runs only in secure contexts (HTTPS, or localhost for development).
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures (e.g. embedded browsers) must never break the app
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
