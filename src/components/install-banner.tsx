"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
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

    const onPrompt = (event: Event) => {
      event.preventDefault(); // take over from the browser UI
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setDismissed(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
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
