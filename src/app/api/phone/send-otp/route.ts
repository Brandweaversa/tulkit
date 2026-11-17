import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeSaMobile } from "@/lib/phone";
import { createAndSendOtp, extractRequestIp } from "@/lib/otp";

// Sends a 6-digit verification code via SMSPortal. Cooldown, daily caps and
// delivery are handled by src/lib/otp.ts — a resend is only counted against
// the daily allowance when a real send actually happens.
export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    mobile?: unknown;
  } | null;
  const normalized = normalizeSaMobile(
    typeof body?.mobile === "string" ? body.mobile : "",
  );
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const profile = await db.businessProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await createAndSendOtp(
    user.id,
    normalized.e164,
    extractRequestIp(request),
  );
  if (!result.ok) {
    const headers = result.retryAfterSeconds
      ? { "Retry-After": String(result.retryAfterSeconds) }
      : undefined;
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers },
    );
  }

  // Remember the number being verified. If it differs from the stored one,
  // any previous verification no longer applies — the user must re-verify.
  await db.businessProfile.update({
    where: { userId: user.id },
    data: {
      mobileNumber: normalized.e164,
      mobileLastOtpSentAt: new Date(),
      ...(profile.mobileNumber !== normalized.e164
        ? { mobileVerifiedAt: null }
        : {}),
    },
  });

  return NextResponse.json({ sent: true, mobile: normalized.e164 });
}
