
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      `${origin}/?error=missing_confirmation_code`
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Email confirmation failed:", error.message);

    return NextResponse.redirect(
      `${origin}/?error=confirmation_failed`
    );
  }

  return NextResponse.redirect(
    `${origin}/?verified=true`
  );
}
