"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";

// Page the recovery email link lands on (after the auth callback exchanges
// the code). The user is already signed in via the recovery session — they
// pick a new password here.
export default function ResetPasswordPage() {
  const router = useRouter();
  const authUser = useStore((s) => s.authUser);
  const authLoading = useStore((s) => s.authLoading);
  const fetchAuthUser = useStore((s) => s.fetchAuthUser);
  const resetPassword = useStore((s) => s.resetPassword);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchAuthUser();
  }, [fetchAuthUser]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    } else if (password.length > 72) {
      newErrors.password = "Password must be 72 characters or fewer.";
    } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      newErrors.password = "Use at least one uppercase letter, one lowercase letter, and one number.";
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await resetPassword(password);
      setDone(true);
      toast({ title: "Password updated", description: "You can now use your new password." });
      setTimeout(() => router.push("/"), 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(message);
      toast({ title: "Could not update password", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const loading = authLoading && !authUser;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, #B0E0E6 0%, #E6F2F5 50%, #F0F7FA 100%)",
      }}
    >
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center rounded-xl px-4 py-3"
            style={{ backgroundColor: "#B0E0E6" }}
          >
            <img src="/tulkit.png" alt="Tulkit" className="h-12 w-auto" />
          </div>
        </div>

        <Card className="shadow-lg border-0">
          {loading ? (
            <CardContent className="p-8 text-center space-y-3">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Checking your reset link...</p>
            </CardContent>
          ) : !authUser ? (
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <AlertCircle className="h-7 w-7 text-red-600" />
              </div>
              <CardHeader className="space-y-1 p-0">
                <CardTitle className="text-xl">Link expired or invalid</CardTitle>
                <CardDescription>
                  This password reset link is no longer valid. Request a fresh
                  one from the sign-in page.
                </CardDescription>
              </CardHeader>
              <Button
                className="w-full bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
                onClick={() => router.push("/")}
              >
                Back to sign in
              </Button>
            </CardContent>
          ) : done ? (
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <CardHeader className="space-y-1 p-0">
                <CardTitle className="text-xl">Password updated</CardTitle>
                <CardDescription>
                  Your new password is active. Taking you back to the app...
                </CardDescription>
              </CardHeader>
            </CardContent>
          ) : (
            <>
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl">Choose a new password</CardTitle>
                <CardDescription>
                  Signed in as {authUser.email}. Set the new password for your
                  account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {submitError && (
                    <div
                      role="alert"
                      className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex gap-2 items-start"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          if (errors.password) setErrors({ ...errors, password: "" });
                        }}
                        className={`pl-9 pr-9 ${errors.password ? "border-red-400" : ""}`}
                        autoComplete="new-password"
                        aria-invalid={Boolean(errors.password)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password ? (
                      <p className="text-xs text-red-600">{errors.password}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        At least 8 characters, including uppercase, lowercase, and a number.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-new-password">Confirm new password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-new-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(event) => {
                          setConfirmPassword(event.target.value);
                          if (errors.confirmPassword)
                            setErrors({ ...errors, confirmPassword: "" });
                        }}
                        className={`pl-9 ${errors.confirmPassword ? "border-red-400" : ""}`}
                        autoComplete="new-password"
                        aria-invalid={Boolean(errors.confirmPassword)}
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-600">{errors.confirmPassword}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
                  >
                    {submitting ? "Updating..." : "Update password"}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        <div className="text-center text-xs text-neutral-500">
          Powered by{" "}
          <a
            href="https://brandweaver.co.za"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-neutral-700 hover:underline"
          >
            Brandweaver
          </a>
        </div>
      </div>
    </div>
  );
}
