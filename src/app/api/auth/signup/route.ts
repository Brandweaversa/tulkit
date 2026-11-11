import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSiteUrl(request: Request): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");

  // Vercel provides this for production and preview deployments.
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  // Local development fallback.
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: "Enter your email address and password." },
      { status: 400 },
    );
  }

  const email = String(body.email).trim().toLowerCase();
  const password = String(body.password);

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json(
      { error: "Password must include uppercase and lowercase letters and a number." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const emailRedirectTo = `${getSiteUrl(request)}/auth/callback`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });

    if (error) {
      console.error("Supabase signup failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      console.error("Supabase signup returned no user and no error.");
      return NextResponse.json(
        { error: "Account creation did not complete. Please try again." },
        { status: 502 },
      );
    }

    // BusinessProfile is created on the first authenticated /api/auth/me request.
    // This lets signup succeed even if the app database is temporarily unavailable;
    // ensureBusinessProfile handles creation after confirmation/sign-in.
    return NextResponse.json({
      user: data.user,
      requiresEmailConfirmation: !data.session,
    });
  } catch (error) {
    console.error("Signup endpoint failed:", error);
    return NextResponse.json(
      {
        error:
          "Signup service is not configured correctly. Please contact the site administrator.",
      },
      { status: 500 },
    );
  }
}
