"use client";

import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192.png"
        alt=""
        className="mb-2 h-16 w-16"
        draggable={false}
      />
      <h1 className="text-2xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Tulkit needs an internet connection to load your invoices, quotes and
        client details. Check your connection and try again.
      </p>
      <Button onClick={() => window.location.reload()}>Try again</Button>
    </main>
  );
}
