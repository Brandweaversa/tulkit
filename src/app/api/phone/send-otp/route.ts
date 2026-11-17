import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeSaMobile } from "@/lib/phone";
import { sendMobileVerification } from "@/lib/twilio";

// Each SMS costs money, so a resend cooldown is enforced server-side —
// the client countdown is only a courtesy.
const RESEND_COOLDOWN_MS = 60_000;

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

  if (profile.mobileLastOtpSentAt) {
    const since = Date.now() - profile.mobileLastOtpSentAt.getTime();
    if (since < RESEND_COOLDOWN_MS) {
      const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - since) / 1000);
      return NextResponse.json(
        {
          error: `Please wait ${retryAfter} second${retryAfter === 1 ? "" : "s"} before requesting another code.`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }

  const result = await sendMobileVerification(normalized.e164);
  if (!result.ok) {
    console.error("Twilio verification send failed:", result.message);
    if (result.reason === "not_configured") {
      return NextResponse.json(
        {
          error:
            "Mobile verification isn't switched on yet. Please try again later.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error:
          "Could not send the SMS right now. Please try again in a moment.",
      },
      { status: 502 },
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
