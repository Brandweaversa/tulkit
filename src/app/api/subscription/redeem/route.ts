import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { redeemWithVoucher } from "@/lib/payments/ott-voucher";

// Redeem an OTT voucher for a Pro subscription. The whole OTT flow (status
// codes, idempotency, recovery) lives in src/lib/payments/ott-voucher.ts —
// this route only authenticates and serializes the outcome.
export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
