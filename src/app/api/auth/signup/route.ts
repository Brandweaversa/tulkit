import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { FEATURE_KEYS } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const email = String(body.email).trim().toLowerCase();
  const password = String(body.password);

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Create a BusinessProfile for the new user with 30-day free trial
  if (data.user) {
    try {
      const userCount = await db.businessProfile.count();
      const role = userCount === 0 ? "admin" : "user";
      const now = new Date();
      const trialExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await db.businessProfile.create({
        data: {
          userId: data.user.id,
          role,
          // Start 30-day free trial with ALL features unlocked
          subscriptionStatus: role === "admin" ? "active" : "trial",
          subscriptionExpiresAt: role === "admin" ? null : trialExpiresAt,
          trialExpiresAt: role === "admin" ? null : trialExpiresAt,
          allocatedFeatures: [...FEATURE_KEYS].join(","),
        },
      });
    } catch (e) {
      console.error("Failed to create business profile:", e);
    }
  }

  const requiresEmailConfirmation = !data.session;

  return NextResponse.json({
    user: data.user,
    requiresEmailConfirmation,
  });
}
