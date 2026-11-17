import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/platform-settings";
import { redeemWithVoucher } from "@/lib/payments/ott-voucher";

// Redeem an OTT voucher for a Pro subscription. The whole OTT flow (status
// codes, idempotency, recovery) lives in src/lib/payments/ott-voucher.ts —
// this route only authenticates and serializes the outcome.
export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin visibility switch: a hidden payment method is also refused here,
  // so hiding it in Platform settings is a real kill switch, not cosmetic.
  const settings = await getPlatformSettings();
  if (!settings.ottVoucherVisible) {
    return NextResponse.json(
      {
        status: "not_configured",
        message: "Voucher payments are currently unavailable. Please use another payment option.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    pin?: unknown;
  } | null;

  const outcome = await redeemWithVoucher(
    user.id,
    typeof body?.pin === "string" ? body.pin : "",
  );

  const statusToHttp: Record<string, number> = {
    success: 200,
    processing: 202,
    failed: 400,
    mobile_required: 403,
    not_configured: 503,
    admin: 403,
    rate_limited: 429,
  };

  return NextResponse.json(outcome, {
    status: statusToHttp[outcome.status] ?? 400,
  });
}
