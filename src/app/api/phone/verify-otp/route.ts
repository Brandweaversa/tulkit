import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeSaMobile } from "@/lib/phone";
import { checkMobileVerification } from "@/lib/twilio";

export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    mobile?: unknown;
    code?: unknown;
  } | null;
  const normalized = normalizeSaMobile(
    typeof body?.mobile === "string" ? body.mobile : "",
  );
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }
  const code =
    typeof body?.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (!code || code.length < 4) {
    return NextResponse.json(
      { error: "Enter the code from the SMS." },
      { status: 400 },
    );
  }

  const profile = await db.businessProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The check must be for the number we actually sent a code to — otherwise
  // a stale code for an old number could verify a new one.
  if (
    profile.mobileNumber !== normalized.e164 ||
    !profile.mobileLastOtpSentAt
  ) {
    return NextResponse.json(
      { error: "Request a new code first." },
      { status: 400 },
    );
  }

  const result = await checkMobileVerification(normalized.e164, code);
  if (!result.ok) {
    console.error("Twilio verification check failed:", result.message);
    return NextResponse.json(
      { error: "That code is incorrect or has expired." },
      { status: 400 },
    );
  }
  if (!result.approved) {
    return NextResponse.json(
      { error: "That code is incorrect or has expired." },
      { status: 400 },
    );
  }

  await db.businessProfile.update({
    where: { userId: user.id },
    data: { mobileVerifiedAt: new Date() },
  });

  return NextResponse.json({ verified: true, mobile: normalized.e164 });
}
