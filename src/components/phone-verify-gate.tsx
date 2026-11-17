"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/store";
import { normalizeSaMobile, displaySaMobile } from "@/lib/phone";

interface Props {
  email: string;
  // Number previously captured (may be unverified) — pre-fills the input.
  initialMobile?: string;
  // Called after the server confirms the OTP — the app refreshes and unlocks.
  onVerified: () => void;
  // Offered so a stuck user is never locked out of their session.
  onSignOut?: () => void;
}

// Full-screen mobile verification gate shown to signed-in users who have not
// verified a South African mobile number yet. Strictly required at
// onboarding; the number is later used for OTT voucher vault SMS.
export function PhoneVerifyGate({
  email,
  initialMobile,
  onVerified,
  onSignOut,
}: Props) {
  const [step, setStep] = useState<"number" | "code">("number");
  const [mobileInput, setMobileInput] = useState(initialMobile ?? "");
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [verifiedMobile, setVerifiedMobile] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  // 60-second resend countdown, mirrored from the server-side cooldown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  async function sendCode() {
    setError(null);
    const check = normalizeSaMobile(mobileInput);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/phone/send-otp", {
        method: "POST",
        body: JSON.stringify({ mobile: mobileInput }),
      });
      setVerifiedMobile(check.e164);
      setStep("code");
      setResendIn(60);
      setCodeInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/phone/verify-otp", {
        method: "POST",
        body: JSON.stringify({ mobile: verifiedMobile, code: codeInput }),
      });
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const parsed = normalizeSaMobile(mobileInput);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background:
          "linear-gradient(135deg, #B0E0E6 0%, #E6F2F5 50%, #F0F7FA 100%)",
      }}
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-md border p-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center rounded-xl px-4 py-3" style={{ backgroundColor: "#B0E0E6" }}>
            <img src="/tulkit.png" alt="Tulkit" className="h-10 w-auto" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center justify-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Verify your mobile number
          </h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium">{email}</span>. We verify
            South African mobile numbers to secure accounts and deliver
            voucher-payment SMS — it takes under a minute.
          </p>
        </div>

        {step === "number" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="mobile" className="text-sm font-medium">
                Mobile number
              </label>
              <input
                id="mobile"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="072 123 4567"
                value={mobileInput}
                onChange={(e) => {
                  setMobileInput(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && parsed.ok && !busy) sendCode();
                }}
                className="w-full rounded-md border px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#0E7C9C]/40 focus:border-[#0E7C9C]"
                autoFocus
              />
              {mobileInput.trim() && parsed.ok && (
                <p className="text-xs text-muted-foreground">
                  Will be saved as {displaySaMobile(parsed.e164)}
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              onClick={sendCode}
              disabled={busy || !parsed.ok}
              className="w-full bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending SMS...
                </>
              ) : (
                "Send verification code"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code by SMS to{" "}
              <span className="font-medium text-neutral-900">
                {verifiedMobile && displaySaMobile(verifiedMobile)}
              </span>
              .
            </p>

            <div className="space-y-1.5">
              <label htmlFor="code" className="text-sm font-medium">
                Verification code
              </label>
              <input
                id="code"
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="• • • • • •"
                maxLength={6}
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && codeInput.length >= 4 && !busy)
                    verifyCode();
                }}
                className="w-full rounded-md border px-3 py-2.5 text-center text-2xl font-semibold tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-[#0E7C9C]/40 focus:border-[#0E7C9C]"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              onClick={verifyCode}
              disabled={busy || codeInput.length < 4}
              className="w-full bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...
                </>
              ) : (
                "Verify and continue"
              )}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("number");
                  setError(null);
                }}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Change number
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || busy}
                onClick={sendCode}
                className="text-[#0E7C9C] hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </div>
        )}

        {onSignOut && (
          <div className="text-center">
            <button
              type="button"
              onClick={onSignOut}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Sign out instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
