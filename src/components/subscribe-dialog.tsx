"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Crown, Loader2, CheckCircle2, AlertTriangle, MessageCircle, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { OttLogo } from "@/components/ott-logo";

interface SubscriptionInfo {
  amount: number;
  days: number;
  methods: {
    id: string;
    label: string;
    logoSrc?: string;
    description: string;
    configured: boolean;
  }[];
  cashVisible: boolean;
  mobileVerified: boolean;
  role: string;
}

type Phase =
  | { kind: "form" }
  | { kind: "busy"; label: string }
  | { kind: "success"; expiresAt: string; message: string }
  | { kind: "processing"; reference: string; message: string }
  | { kind: "error"; message: string; reference?: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // Optional jump to the Settings tab (for mobile verification).
  onGoToSettings?: () => void;
}

// Subscribe dialog: the user-facing payment flow. Renders whatever payment
// methods the registry offers (today: OTT voucher only) and always offers
// the cash/manual fallback for users the voucher rail doesn't suit.
export function SubscribeDialog({ open, onOpenChange, onGoToSettings }: Props) {
  const fetchAuthUser = useStore((s) => s.fetchAuthUser);
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [pin, setPin] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInfo(null);
    setPhase({ kind: "form" });
    setPin("");
    fetch("/api/subscription/info")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => setInfo(data))
      .catch(() =>
        setInfo({
          amount: 100,
          days: 30,
          methods: [],
          cashVisible: true,
          mobileVerified: false,
          role: "user",
        }),
      );
  }, [open]);

  const voucherMethod = info?.methods.find((m) => m.id === "ott_voucher");
  const cashVisible = info?.cashVisible ?? true;
  const price = info?.amount ?? 100;
  const days = info?.days ?? 30;

  async function redeem() {
    if (!pin.trim()) return;
    setPhase({ kind: "busy", label: "Validating voucher…" });
    try {
      const res = await fetch("/api/subscription/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setPhase({ kind: "success", expiresAt: data.expiresAt, message: data.message });
        void fetchAuthUser();
        toast({ title: "Pro activated", description: data.message });
      } else if (data.status === "processing") {
        setPhase({ kind: "processing", reference: data.reference, message: data.message });
      } else {
        setPhase({
          kind: "error",
          message: data.message || "The voucher could not be redeemed.",
          reference: data.reference,
        });
      }
    } catch {
      setPhase({
        kind: "error",
        message: "Something went wrong. Check your connection and try again.",
      });
    }
  }

  async function checkStatus(reference: string) {
    setChecking(true);
    try {
      const res = await fetch("/api/subscription/redeem-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setPhase({ kind: "success", expiresAt: data.expiresAt, message: data.message });
        void fetchAuthUser();
        toast({ title: "Pro activated", description: data.message });
      } else {
        setPhase({
          kind: "processing",
          reference,
          message: data.message || data.error || "Still waiting for confirmation.",
        });
        toast({
          title: "Still processing",
          description: data.message || data.error,
        });
      }
    } catch {
      toast({ title: "Could not check status", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  }

  function formatExpiry(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" /> Upgrade to Pro
          </DialogTitle>
          <DialogDescription>
            Unlock all features for {days} days. No accumulation — pay once, use for {days} days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Price summary */}
          <div className="rounded-md bg-muted/50 p-4 space-y-2">
            <div className="font-semibold">Pro — R{price} / {days} days</div>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✅ Unlimited documents</li>
              <li>✅ Unlimited clients</li>
              <li>✅ PDF download</li>
              <li>✅ WhatsApp &amp; Email sharing</li>
              <li>✅ Custom logo &amp; branding</li>
              <li>✅ Banking details on invoices</li>
              <li>✅ Convert quotes to invoices</li>
            </ul>
          </div>

          {info?.role === "admin" ? (
            <div className="rounded-md border border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-900 p-3 text-sm text-purple-800 dark:text-purple-200">
              Admin accounts always have full access — no subscription needed.
            </div>
          ) : (
            <>
              {/* Every payment option hidden — say so instead of a bare dialog */}
              {!voucherMethod && !cashVisible && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm text-amber-800 dark:text-amber-200">
                  No payment methods are available right now. Please check back
                  soon, or contact us to activate Pro manually.
                </div>
              )}

              {/* Payment method: OTT voucher (hidden when the switch is off) */}
              {voucherMethod && (
                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    {voucherMethod.logoSrc && <OttLogo />}
                    <div className="font-medium text-sm">{voucherMethod.label}</div>
                    <span className="ml-auto text-xs text-muted-foreground">Selected</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{voucherMethod.description}</p>

                  {!voucherMethod.configured && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-200">
                      Voucher payments aren&apos;t switched on yet. Please pay by cash below —
                      we&apos;ll activate you manually.
                    </div>
                  )}

                  {voucherMethod.configured && info && !info.mobileVerified && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-200 space-y-2">
                      <p>
                        Verify your South African mobile number in Settings first — OTT sends any
                        unused voucher balance to it by SMS.
                      </p>
                      {onGoToSettings && (
                        <Button variant="outline" size="sm" onClick={onGoToSettings}>
                          Open Settings
                        </Button>
                      )}
                    </div>
                  )}

                  {voucherMethod.configured && info?.mobileVerified && phase.kind === "form" && (
                    <div className="space-y-2">
                      <label htmlFor="voucher-pin" className="text-sm font-medium">
                        Voucher PIN
                      </label>
                      <input
                        id="voucher-pin"
                        type="text"
                        inputMode="numeric"
                        placeholder="e.g. 1234 5678 9012"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/[^\d\s]/g, ""))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && pin.trim()) redeem();
                        }}
                        className="w-full rounded-md border px-3 py-2.5 text-base tracking-wider focus:outline-none focus:ring-2 focus:ring-[#0E7C9C]/40 focus:border-[#0E7C9C]"
                      />
                      <p className="text-xs text-muted-foreground">
                        The exact R{price} is redeemed — any extra balance stays on your voucher and
                        arrives by SMS link from OTT.
                      </p>
                    </div>
                  )}

                  {phase.kind === "busy" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> {phase.label} Please don&apos;t
                      close this window.
                    </div>
                  )}

                  {phase.kind === "success" && (
                    <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-sm text-emerald-800 dark:text-emerald-200 space-y-1">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-4 w-4" /> Pro active until{" "}
                        {formatExpiry(phase.expiresAt)}
                      </div>
                      <p className="text-xs">{phase.message}</p>
                    </div>
                  )}

                  {phase.kind === "processing" && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm text-amber-800 dark:text-amber-200 space-y-2">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="h-4 w-4" /> Payment unconfirmed
                      </div>
                      <p className="text-xs">{phase.message}</p>
                      <p className="text-[11px] opacity-75">Reference: {phase.reference}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={checking}
                        onClick={() => checkStatus(phase.reference)}
                      >
                        {checking ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking…
                          </>
                        ) : (
                          "Check payment status"
                        )}
                      </Button>
                    </div>
                  )}

                  {phase.kind === "error" && (
                    <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-sm text-red-800 dark:text-red-200 space-y-1">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="h-4 w-4" /> Payment not completed
                      </div>
                      <p className="text-xs">{phase.message}</p>
                      {phase.reference && (
                        <p className="text-[11px] opacity-75">Reference: {phase.reference}</p>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setPhase({ kind: "form" })}>
                        Try again
                      </Button>
                    </div>
                  )}

                  {voucherMethod.configured && info?.mobileVerified && phase.kind === "form" && (
                    <Button
                      onClick={redeem}
                      disabled={!pin.trim()}
                      className="w-full bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
                    >
                      <Wallet className="h-4 w-4 mr-2" /> Redeem voucher &amp; activate
                    </Button>
                  )}
                </div>
              )}

              {/* Fallback: cash / manual — hidden when the switch is off;
                  also the path for non-SA users until card payments land. */}
              {cashVisible && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm space-y-2">
                <div className="font-semibold text-amber-800 dark:text-amber-200">
                  Or pay cash — R{price} / {days} days
                </div>
                <div className="text-amber-700 dark:text-amber-300 text-xs">
                  Outside South Africa or prefer cash? Contact us — after payment we&apos;ll
                  activate your {days}-day Pro access manually. Card payments are coming soon.
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    window.open(
                      `https://wa.me/27738239666?text=${encodeURIComponent(
                        `Hi I want to subscribe to Tulkit Pro (R${price} / ${days} days)`,
                      )}`,
                      "_blank",
                    );
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" /> Contact us on WhatsApp
                </Button>
              </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {phase.kind === "success" ? "Done" : "Maybe later"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
