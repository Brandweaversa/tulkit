import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCountry } from "@/lib/countries";
import { normalizeMobile } from "@/lib/phone";

// Saves a mobile number captured OUTSIDE South Africa — no OTP, no SMS.
// South African numbers must go through the verification flow instead
// (send-otp + verify-otp). Voucher payments stay South-Africa-only: enforced
// again in src/lib/payments/ott-voucher.ts, and the voucher option is
// filtered out of /api/subscription/info for non-SA users.
export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    mobile?: unknown;
    country?: unknown;
  } | null;

  const country =
    typeof body?.country === "string" ? body.country.toUpperCase() : "";
  if (country === "ZA") {
    return NextResponse.json(
      { error: "South African numbers must be verified by SMS." },
      { status: 400 },
    );
  }
  if (!getCountry(country)) {
    return NextResponse.json(
      { error: "Choose a country from the list." },
      { status: 400 },
    );
  }

  const normalized = normalizeMobile(
    typeof body?.mobile === "string" ? body.mobile : "",
    country,
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

  await db.businessProfile.update({
    where: { userId: user.id },
    data: {
      mobileNumber: normalized.e164,
      country,
      mobileVerifiedAt: null,
      phoneGateSkippedAt: null,
    },
  });

  return NextResponse.json({
    saved: true,
    mobile: normalized.e164,
    country,
  });
}
