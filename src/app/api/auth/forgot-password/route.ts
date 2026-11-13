import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/auth/forgot-password — email a password reset link.
// Always returns success so we never reveal whether an account exists.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const email = String(body.email).trim().toLowerCase();
  const requestUrl = new URL(request.url);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // The email link lands on our callback, which exchanges the code and
    // forwards the user to /reset-password (see auth/callback/route.ts).
    redirectTo: `${requestUrl.origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error("Password reset email failed:", error.message);
    const message = error.message.toLowerCase().includes("rate limit")
      ? "Too many reset emails requested. Please wait a while before trying again."
      : "Could not send the reset email. Please try again in a moment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
