import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/platform-settings";
import { paymentMethodInfos } from "@/lib/payments";

// Client-safe subscription info for the subscribe dialog: the configured
// price, the payment methods available, and whether the user can pay by
// voucher (needs a verified SA mobile). No secrets cross this boundary.
export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getPlatformSettings();
  // The OTT voucher rail is South-Africa-only: SA retail vouchers, SA mobile
  // for the vault SMS. Non-SA users never see the option, and the redeem API
  // rejects them server-side as well.
  const isSouthAfrican = (user.country ?? "ZA") === "ZA";
  const methods = isSouthAfrican
    ? paymentMethodInfos(settings)
    : paymentMethodInfos(settings).filter((m) => m.id !== "ott_voucher");
  return NextResponse.json({
    amount: settings.subscriptionAmount,
    days: settings.subscriptionDays,
    methods,
    // The cash/WhatsApp fallback is hard-coded UI, so its visibility flag
    // travels separately — hidden here = the dialog drops that block.
    cashVisible: settings.cashVisible,
    country: user.country ?? "ZA",
    mobileVerified: Boolean(user.mobileVerifiedAt),
    role: user.role,
  });
}
