import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// POST /api/auth/reset-password — set a new password.
// The user arrives here with a session created by the recovery link
// (auth callback exchanged the code), so requireAuth succeeds.
export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json(
      {
        error:
          "Your reset link has expired or is invalid. Please request a new one.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const password = String(body.password);
  if (password.length < 6 || password.length > 72) {
    return NextResponse.json(
      { error: "Password must be between 6 and 72 characters" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("Password update failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
