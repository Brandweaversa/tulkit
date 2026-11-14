"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    /** Captured by the inline script in layout.tsx before React hydrates. */
    __tulkitBip?: BeforeInstallPromptEvent;
  }
}

const DISMISS_KEY = "tulkit-install-banner-dismissed";

/**
 * Floating "Install Tulkit" banner. Shows whenever Chrome reports the app is
 * installable (beforeinstallprompt) and the user hasn't dismissed it or is
 * not already running the installed app. Tapping Install opens Chrome's
 * native install dialog directly — no menu hunting.
 */
export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true); // hidden until effects confirm

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (window.localStorage.getItem(DISMISS_KEY)) return;
    setDismissed(false);

    // The event usually fires before React hydrates (cold load with an
    // active service worker — typical on the login screen), so the live
    // listener below would miss it. The inline capture script in layout.tsx
    // stashed it; pick it up here.
    if (window.__tulkitBip) {
      setPromptEvent(window.__tulkitBip);
    }

    const onPrompt = (event: Event) => {
      event.preventDefault(); // take over from the browser UI
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    // Re-dispatched by the capture script — covers an event that fired
    // between parse time and this effect running.
    const onRedispatch = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | BeforeInstallPromptEvent
        | undefined;
      if (detail) setPromptEvent(detail);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setDismissed(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("tulkit:bip", onRedispatch);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("tulkit:bip", onRedispatch);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      window.localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    }
    setPromptEvent(null);
  };

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (!promptEvent || dismissed) return null;

  return (
    <div className="fixed inset-x-4 bottom-16 z-50 flex items-center gap-3 rounded-xl border bg-card p-3 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192.png"
        alt=""
        draggable={false}
        className="h-10 w-10 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">Install Tulkit</p>
        <p className="text-xs text-muted-foreground">
          Add to your home screen — opens full-screen.
        </p>
      </div>
      <Button size="sm" onClick={install}>
        Install
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dismiss install banner"
        className="shrink-0 text-muted-foreground"
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
