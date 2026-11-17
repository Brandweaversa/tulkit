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
  return NextResponse.json({
    amount: settings.subscriptionAmount,
    days: settings.subscriptionDays,
    methods: paymentMethodInfos(settings),
    mobileVerified: Boolean(user.mobileVerifiedAt),
    role: user.role,
  });
}
