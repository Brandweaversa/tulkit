"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import type { AppSettingsState } from "@/lib/types";
import { DEFAULT_APP_SETTINGS } from "@/lib/types";

interface SwitchRow {
  key: keyof AppSettingsState;
  label: string;
  description: string;
}

interface SwitchGroup {
  title: string;
  note?: string;
  rows: SwitchRow[];
}

const GROUPS: SwitchGroup[] = [
  {
    title: "Sign-up & sign-in",
    rows: [
      {
        key: "signupOpen",
        label: "New sign-ups",
        description:
          "When off, the sign-up form is replaced with a notice and the server rejects new registrations. Existing users are unaffected.",
      },
      {
        key: "googleSigninEnabled",
        label: "Sign in with Google",
        description:
          "Shows the Continue with Google button on the login screen. Turn off while Google OAuth isn't configured or if you want password-only sign-in.",
      },
    ],
  },
  {
    title: "User experience",
    rows: [
      {
        key: "privacyNoticeEnabled",
        label: "Privacy notice popup",
        description:
          "The once-per-browser notice shown right after sign-in. The Terms & Privacy links in the footer always stay available.",
      },
      {
        key: "installBannerEnabled",
        label: "Install banner",
        description:
          "The floating Add to home screen banner. The /install diagnostics page stays reachable regardless.",
      },
      {
        key: "poweredByVisible",
        label: "Powered by Tulkit",
        description:
          "The branding line at the bottom of the login screen and the app footer.",
      },
    ],
  },
  {
    title: "Feature master switches",
    note: "App-wide kill switches — a feature works only when the master switch is on AND the user has it allocated (Users list → Subscribe). Admin is bound by these too.",
    rows: [
      {
        key: "whatsappShareEnabled",
        label: "WhatsApp sharing",
        description: "Attaching the PDF to the WhatsApp share sheet.",
      },
      {
        key: "emailShareEnabled",
        label: "Email sharing",
        description: "Attaching the PDF to the email share sheet.",
      },
      {
        key: "pdfDownloadEnabled",
        label: "PDF download & share",
        description: "Generating and downloading the PDF, including share-sheet hand-offs.",
      },
    ],
  },
];

/**
 * Admin control panel: global on/off switches for the whole platform.
 * Toggles save immediately (optimistic, reverted on failure) and every
 * change lands in the admin audit log with before/after values.
 */
export function AdminControlPanel() {
  const [settings, setSettings] = useState<AppSettingsState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (!cancelled) setSettings({ ...DEFAULT_APP_SETTINGS, ...(data.settings ?? {}) });
      })
      .catch(() => {
        if (!cancelled) setSettings({ ...DEFAULT_APP_SETTINGS });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(key: keyof AppSettingsState, value: boolean) {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, [key]: value }); // optimistic
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setSettings(previous);
      toast({
        title: "Could not save setting",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Control panel</CardTitle>
        <CardDescription>
          Global switches for the whole platform. Changes apply immediately and
          are recorded in Admin activity below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!settings ? (
          <p className="text-sm text-muted-foreground">Loading settings…</p>
        ) : (
          GROUPS.map((group) => (
            <div key={group.title} className="space-y-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </h3>
                {group.note && (
                  <p className="mt-1 text-xs text-muted-foreground/80">{group.note}</p>
                )}
              </div>
              <div className="divide-y rounded-lg border">
                {group.rows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-4 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{row.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {row.description}
                      </p>
                    </div>
                    <Switch
                      checked={settings[row.key] as boolean}
                      onCheckedChange={(value) => toggle(row.key, value)}
                      disabled={!settings}
                      aria-label={row.label}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
