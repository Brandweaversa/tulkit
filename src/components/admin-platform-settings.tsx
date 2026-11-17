"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertTriangle, Lock, KeyRound, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { OttLogo } from "@/components/ott-logo";

interface PlatformSettingsView {
  ottMode: "test" | "live";
  ottTestBaseUrl: string;
  ottLiveBaseUrl: string;
  ottVendorId: string;
  ottAccount: string;
  ottTimeoutSeconds: number;
  subscriptionAmount: number;
  subscriptionDays: number;
  hasOttUsername: boolean;
  hasOttPassword: boolean;
  hasOttApiKey: boolean;
  hasSmsPortalClientId: boolean;
  hasSmsPortalClientSecret: boolean;
  envOverridden: string[];
}

// Where each field's stored value comes from — "Panel" (editable here) or
// a Vercel env var (shown read-only, matching the wp-config override pattern).
function sourceNote(field: string, envOverridden: string[]): string | null {
  const envNames: Record<string, string> = {
    ottMode: "OTT_MODE",
    ottTestBaseUrl: "OTT_TEST_BASE_URL",
    ottLiveBaseUrl: "OTT_LIVE_BASE_URL",
    ottVendorId: "OTT_VENDOR_ID",
    ottAccount: "OTT_ACCOUNT",
    ottUsername: "OTT_USERNAME",
    ottPassword: "OTT_PASSWORD",
    ottApiKey: "OTT_API_KEY",
    smsPortalClientId: "SMSPORTAL_CLIENT_ID",
    smsPortalClientSecret: "SMSPORTAL_CLIENT_SECRET",
    subscriptionAmount: "SUBSCRIPTION_AMOUNT",
    subscriptionDays: "SUBSCRIPTION_DAYS",
  };
  const env = envNames[field];
  return env && envOverridden.includes(env) ? env : null;
}

function EnvLock({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
      <Lock className="h-3 w-3" /> Overridden by the Vercel env var <code>{note}</code> — the
      panel value is ignored until it is removed.
    </p>
  );
}

// Admin platform settings: subscription pricing, payment methods, OTT API
// credentials and SMSPortal credentials. Secrets save with "leave blank to
// keep" semantics and are never echoed back to the browser.
export function AdminPlatformSettings() {
  const [view, setView] = useState<PlatformSettingsView | null>(null);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingOtt, setSavingOtt] = useState(false);
  const [savingSms, setSavingSms] = useState(false);
  const [gettingKey, setGettingKey] = useState(false);

  // Pricing draft
  const [amount, setAmount] = useState("100");
  const [days, setDays] = useState("30");

  // OTT draft
  const [ottMode, setOttMode] = useState<"test" | "live">("test");
  const [ottTestBaseUrl, setOttTestBaseUrl] = useState("");
  const [ottLiveBaseUrl, setOttLiveBaseUrl] = useState("");
  const [ottVendorId, setOttVendorId] = useState("");
  const [ottAccount, setOttAccount] = useState("");
  const [ottUsername, setOttUsername] = useState("");
  const [ottPassword, setOttPassword] = useState("");
  const [ottApiKey, setOttApiKey] = useState("");
  const [ottTimeout, setOttTimeout] = useState("45");

  // SMS draft
  const [smsClientId, setSmsClientId] = useState("");
  const [smsClientSecret, setSmsClientSecret] = useState("");

  useEffect(() => {
    fetch("/api/admin/platform-settings")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        const v: PlatformSettingsView = data.settings;
        setView(v);
        setAmount(String(v.subscriptionAmount));
        setDays(String(v.subscriptionDays));
        setOttMode(v.ottMode);
        setOttTestBaseUrl(v.ottTestBaseUrl);
        setOttLiveBaseUrl(v.ottLiveBaseUrl);
        setOttVendorId(v.ottVendorId);
        setOttAccount(v.ottAccount);
        setOttTimeout(String(v.ottTimeoutSeconds));
      })
      .catch(() => {
        toast({
          title: "Could not load platform settings",
          variant: "destructive",
        });
      });
  }, []);

  const ottConnectionReady =
    !!view && view.hasOttUsername && view.hasOttPassword && !!view.ottVendorId;
  const ottPaymentReady = ottConnectionReady && view?.hasOttApiKey && !!view?.ottAccount;
  const smsReady = !!view && view.hasSmsPortalClientId && view.hasSmsPortalClientSecret;

  async function save(fields: Record<string, unknown>, setter: (v: boolean) => void, label: string) {
    setter(true);
    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setView(data.settings);
      toast({ title: label, description: "Saved." });
    } catch (e) {
      toast({
        title: `Could not save ${label.toLowerCase()}`,
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setter(false);
    }
  }

  async function getApiKey() {
    setGettingKey(true);
    try {
      const res = await fetch("/api/admin/ott/get-api-key", { method: "POST" });
      const data = await res.json();
      toast({
        title: data.ok ? "OTT API key" : "OTT API key failed",
        description: data.message,
        variant: data.ok ? "default" : "destructive",
      });
      if (data.ok) {
        const r = await fetch("/api/admin/platform-settings");
        if (r.ok) setView((await r.json()).settings);
      }
    } catch {
      toast({ title: "Could not reach OTT", variant: "destructive" });
    } finally {
      setGettingKey(false);
    }
  }

  if (!view) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Subscription pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription pricing</CardTitle>
          <CardDescription>
            The Pro price shown everywhere in the app — subscribe dialog, banners,
            share dialogs, landing copy and revenue estimates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub-amount">Price (ZAR)</Label>
              <Input
                id="sub-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <EnvLock note={sourceNote("subscriptionAmount", view.envOverridden)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-days">Days of access</Label>
              <Input
                id="sub-days"
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
              <EnvLock note={sourceNote("subscriptionDays", view.envOverridden)} />
            </div>
          </div>
          <Button
            size="sm"
            disabled={savingPricing}
            onClick={() =>
              save({ subscriptionAmount: amount, subscriptionDays: days }, setSavingPricing, "Pricing")
            }
          >
            {savingPricing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save pricing
          </Button>
        </CardContent>
      </Card>

      {/* Payment methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment methods</CardTitle>
          <CardDescription>
            What customers can pay with on the subscribe screen. More providers
            (card payments via PayFast/Yoco) plug into this list later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-3 min-w-0">
              <OttLogo />
              <div className="min-w-0">
                <p className="text-sm font-medium">OTT Voucher</p>
                <p className="text-xs text-muted-foreground">
                  Voucher PIN redemption via the OTT Redemption API.
                </p>
              </div>
            </div>
            {ottPaymentReady ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="h-4 w-4" /> Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-4 w-4" />
                {ottConnectionReady ? "Missing API key or account" : "Credentials missing"}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3 opacity-60">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">Card payments</p>
                <p className="text-xs text-muted-foreground">
                  PayFast / Yoco — coming soon.
                </p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">Planned</span>
          </div>
        </CardContent>
      </Card>

      {/* OTT API credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> OTT Voucher API
          </CardTitle>
          <CardDescription>
            The same credentials your existing OTT integration uses. Use test
            mode first; switch to live only after a successful test redemption.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={ottMode} onValueChange={(v) => setOttMode(v as "test" | "live")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test (test-api.ott-mobile.com)</SelectItem>
                  <SelectItem value="live">Live (api.ott-mobile.com)</SelectItem>
                </SelectContent>
              </Select>
              <EnvLock note={sourceNote("ottMode", view.envOverridden)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ott-vendor">Vendor ID</Label>
              <Input
                id="ott-vendor"
                value={ottVendorId}
                onChange={(e) => setOttVendorId(e.target.value)}
                placeholder="e.g. 11"
              />
              <EnvLock note={sourceNote("ottVendorId", view.envOverridden)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ott-test-url">Test base URL</Label>
              <Input
                id="ott-test-url"
                value={ottTestBaseUrl}
                onChange={(e) => setOttTestBaseUrl(e.target.value)}
                placeholder="https://test-api.ott-mobile.com"
              />
              <EnvLock note={sourceNote("ottTestBaseUrl", view.envOverridden)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ott-live-url">Live base URL</Label>
              <Input
                id="ott-live-url"
                value={ottLiveBaseUrl}
                onChange={(e) => setOttLiveBaseUrl(e.target.value)}
                placeholder="https://api.ott-mobile.com"
              />
              <EnvLock note={sourceNote("ottLiveBaseUrl", view.envOverridden)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ott-account">Account</Label>
              <Input
                id="ott-account"
                value={ottAccount}
                onChange={(e) => setOttAccount(e.target.value)}
                placeholder="The account value your RemitVoucher calls send"
              />
              <EnvLock note={sourceNote("ottAccount", view.envOverridden)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ott-timeout">Timeout (seconds)</Label>
              <Input
                id="ott-timeout"
                type="number"
                min={10}
                max={120}
                value={ottTimeout}
                onChange={(e) => setOttTimeout(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ott-username">API username</Label>
              <Input
                id="ott-username"
                value={ottUsername}
                onChange={(e) => setOttUsername(e.target.value)}
                placeholder={view.hasOttUsername ? "Saved — leave blank to keep" : "Enter API username"}
              />
              <EnvLock note={sourceNote("ottUsername", view.envOverridden)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ott-password">API password</Label>
              <Input
                id="ott-password"
                type="password"
                autoComplete="new-password"
                value={ottPassword}
                onChange={(e) => setOttPassword(e.target.value)}
                placeholder={view.hasOttPassword ? "Saved — leave blank to keep" : "Enter API password"}
              />
              <EnvLock note={sourceNote("ottPassword", view.envOverridden)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ott-api-key">API key</Label>
              <Input
                id="ott-api-key"
                type="password"
                autoComplete="new-password"
                value={ottApiKey}
                onChange={(e) => setOttApiKey(e.target.value)}
                placeholder={
                  view.hasOttApiKey
                    ? "Saved — leave blank to keep, or use Get / Confirm API Key"
                    : "Paste the API key, or use Get / Confirm API Key"
                }
              />
              <EnvLock note={sourceNote("ottApiKey", view.envOverridden)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={savingOtt}
              onClick={() =>
                save(
                  {
                    ottMode,
                    ottTestBaseUrl,
                    ottLiveBaseUrl,
                    ottVendorId,
                    ottAccount,
                    ottTimeoutSeconds: ottTimeout,
                    ...(ottUsername.trim() !== "" ? { ottUsername } : {}),
                    ...(ottPassword.trim() !== "" ? { ottPassword } : {}),
                    ...(ottApiKey.trim() !== "" ? { ottApiKey } : {}),
                  },
                  setSavingOtt,
                  "OTT settings",
                )
              }
            >
              {savingOtt && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save OTT settings
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={gettingKey || !ottConnectionReady}
              onClick={getApiKey}
            >
              {gettingKey && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Get / Confirm API Key
            </Button>
          </div>

          <p className="text-xs">
            <span className="text-muted-foreground">Status: </span>
            {ottPaymentReady ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                Configured — voucher payments can run
              </span>
            ) : ottConnectionReady ? (
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Connection saved — still needs an API key{!view.ottAccount ? " and the Account value" : ""}
              </span>
            ) : (
              <span className="font-medium text-red-700 dark:text-red-400">
                Missing username, password, or vendor ID
              </span>
            )}
          </p>

          {view.ottMode === "test" && (
            <div className="rounded-md border border-sky-200 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-900 p-3 text-xs text-sky-800 dark:text-sky-200">
              Test mode — get free test vouchers by SMS: text <strong>TESTPIN</strong> to{" "}
              <strong>45827</strong> for a R1 voucher, or <strong>TESTPIN 100</strong> for a R100
              voucher (up to R5000). Test vouchers only work in test mode.
            </div>
          )}
        </CardContent>
      </Card>

      {/* SMSPortal credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> SMSPortal (verification SMS)
          </CardTitle>
          <CardDescription>
            Sends the 6-digit mobile verification codes. Same account your
            previous platform used — credits and sender ID carry over.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sms-client-id">Client ID</Label>
              <Input
                id="sms-client-id"
                value={smsClientId}
                onChange={(e) => setSmsClientId(e.target.value)}
                placeholder={view.hasSmsPortalClientId ? "Saved — leave blank to keep" : "Enter SMSPortal Client ID"}
              />
              <EnvLock note={sourceNote("smsPortalClientId", view.envOverridden)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sms-client-secret">Client secret</Label>
              <Input
                id="sms-client-secret"
                type="password"
                autoComplete="new-password"
                value={smsClientSecret}
                onChange={(e) => setSmsClientSecret(e.target.value)}
                placeholder={view.hasSmsPortalClientSecret ? "Saved — leave blank to keep" : "Enter SMSPortal Client Secret"}
              />
              <EnvLock note={sourceNote("smsPortalClientSecret", view.envOverridden)} />
            </div>
          </div>
          <Button
            size="sm"
            disabled={savingSms}
            onClick={() =>
              save(
                {
                  ...(smsClientId.trim() !== "" ? { smsPortalClientId: smsClientId } : {}),
                  ...(smsClientSecret.trim() !== "" ? { smsPortalClientSecret: smsClientSecret } : {}),
                },
                setSavingSms,
                "SMS settings",
              )
            }
          >
            {savingSms && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save SMS settings
          </Button>
          <p className="text-xs">
            <span className="text-muted-foreground">Status: </span>
            {smsReady ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                Configured
              </span>
            ) : (
              <span className="font-medium text-red-700 dark:text-red-400">
                Missing Client ID or Client Secret
              </span>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
