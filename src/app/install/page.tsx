"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type SwState =
  | "checking"
  | "unsupported"
  | "none"
  | "activating"
  | "active";

/**
 * Self-diagnostic + one-tap install page for the Tulkit PWA.
 * Shows exactly what this device sees: manifest, service worker, and whether
 * Chrome's install prompt is available. If everything is green but no prompt
 * fired, fall back to the browser menu instructions.
 */
export default function InstallHelpPage() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [swState, setSwState] = useState<SwState>("checking");
  const [manifestState, setManifestState] = useState("checking…");
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const checkSw = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      setSwState("unsupported");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) setSwState("none");
    else setSwState(reg.active ? "active" : "activating");
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);

    fetch("/manifest.webmanifest")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((m) => setManifestState(`loaded — "${m.name ?? "Tulkit"}" with ${m.icons?.length ?? 0} icons`))
      .catch(() => setManifestState("could not load (network or server issue)"));

    checkSw();

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [checkSw]);

  // Signed-in visitors usually landed here by accident (e.g. after
  // diagnosing an install problem). Offer a way back to the app that also
  // replaces this page's history entry — otherwise /install lingers one
  // step behind the dashboard and browser/system Back lands on it.
  // `pageshow` re-checks after back/forward-cache restores, which skip
  // effects entirely.
  useEffect(() => {
    const check = () =>
      createClient()
        .auth.getUser()
        .then(({ data }) => setSignedIn(!!data.user))
        .catch(() => setSignedIn(false));
    check();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) check();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const registerNow = async () => {
    try {
      await navigator.serviceWorker.register("/sw.js");
      setSwState("activating");
      // give the browser a moment, then re-read the real state
      setTimeout(checkSw, 1500);
    } catch {
      setSwState("none");
    }
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setStandalone(true);
    setPromptEvent(null);
  };

  const swLine: Record<SwState, string> = {
    checking: "checking…",
    unsupported: "not supported by this browser",
    none: "not registered yet",
    activating: "registered — activating…",
    active: "registered & active",
  };

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-5 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Install Tulkit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status of this device — everything below should be green before the
          install option appears.
        </p>
      </div>

      {signedIn && (
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">You&apos;re signed in</p>
            <p className="text-xs text-muted-foreground">
              Continue to your dashboard — this page is removed from your
              back history.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => window.location.replace("/")}
            className="shrink-0"
          >
            Open Tulkit
          </Button>
        </div>
      )}

      <ul className="space-y-2 rounded-xl border p-4 text-sm">
        <li className="flex justify-between gap-3">
          <span className="text-muted-foreground">Connection</span>
          <span className={online ? "font-medium" : "font-medium text-destructive"}>
            {online ? "online" : "offline"}
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-muted-foreground">App manifest</span>
          <span className={manifestState.startsWith("loaded") ? "font-medium" : "font-medium text-destructive"}>
            {manifestState}
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-muted-foreground">Service worker</span>
          <span className={swState === "active" ? "font-medium" : swState === "checking" ? "font-medium" : "font-medium text-destructive"}>
            {swLine[swState]}
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-muted-foreground">Running as installed app</span>
          <span className={standalone ? "font-medium" : "font-medium text-muted-foreground"}>
            {standalone ? "yes" : "not yet"}
          </span>
        </li>
      </ul>

      <div className="flex flex-col gap-3">
        {standalone ? (
          <p className="text-center text-sm text-muted-foreground">
            Tulkit is installed on this device — you&apos;re using it right now.
          </p>
        ) : promptEvent ? (
          <Button onClick={install} className="w-full">
            Install Tulkit now
          </Button>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            No automatic install prompt available on this visit yet. Use your
            browser menu → <strong>Add to Home screen</strong> (Chrome:
            ⋮ button, top-right). If service worker above says
            &quot;not registered yet&quot;, tap the button below, wait a few
            seconds, then try the menu again.
          </p>
        )}

        {swState === "none" && (
          <Button variant="outline" onClick={registerNow} className="w-full">
            Register service worker now
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Still stuck? Note down the four lines above and send them over — they
        say exactly which part your device is missing.
      </p>
    </main>
  );
}
