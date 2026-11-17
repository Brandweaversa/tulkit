import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// Escape hatch for users outside South Africa: they continue without
// verifying a mobile number. They can use the app normally, but voucher
// payments stay locked until a South African mobile is verified (OTT sends
// any unused voucher balance to that number by SMS). The admin panel's
// manual activation covers their subscription until card payments arrive.
export async function POST() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.businessProfile.update({
    where: { userId: user.id },
    data: { phoneGateSkippedAt: new Date() },
  });

  return NextResponse.json({ skipped: true });
}
