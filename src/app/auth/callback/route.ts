import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  // Optional `next` param — where to send the user after the exchange.
  // Only local paths are allowed to prevent open redirects.
  const next = requestUrl.searchParams.get("next");
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_confirmation_code", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Email confirmation failed:", error.message);
    return NextResponse.redirect(new URL("/?error=confirmation_failed", requestUrl.origin));
  }

  if (safeNext) {
    return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/?verified=true", requestUrl.origin));
}
