import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { FEATURE_KEYS } from "@/lib/types";
import type { FeatureKey } from "@/lib/types";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

type Params = { params: Promise<{ id: string }> };

// POST /api/admin/users/[id]/subscribe — activate or extend a subscription.
// Body: { durationDays: number, features: FeatureKey[] }
// REPLACES any existing subscription (no accumulation), matching the admin UI.
// [id] is the BusinessProfile id (same id shown in the admin users list).
export async function POST(request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const durationDays = Number(body?.durationDays);
  const features: unknown[] = Array.isArray(body?.features) ? body.features : [];

  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
    return badRequest("durationDays must be a whole number between 1 and 365");
  }
  const validFeatures = [...new Set(features)].filter((f): f is FeatureKey =>
    FEATURE_KEYS.includes(f as FeatureKey),
  );
  if (validFeatures.length === 0) {
    return badRequest("At least one valid feature must be allocated");
  }

  const profile = await db.businessProfile.findUnique({ where: { id } });
  if (!profile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (profile.role === "admin") {
    return NextResponse.json(
      { error: "Admin accounts always have full access — no subscription needed." },
      { status: 403 },
    );
  }

  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  const updated = await db.businessProfile.update({
    where: { id },
    data: {
      subscriptionStatus: "active",
      subscriptionActivatedAt: new Date(),
      subscriptionExpiresAt: expiresAt,
      allocatedFeatures: validFeatures.join(","),
    },
  });

  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    action: "activate_subscription",
    targetUserId: profile.userId,
    targetEmail: profile.email,
    details: {
      durationDays,
      features: validFeatures,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return NextResponse.json({
    success: true,
    subscriptionExpiresAt: updated.subscriptionExpiresAt?.toISOString() ?? null,
  });
}

// DELETE /api/admin/users/[id]/subscribe — revoke a subscription.
// Sets the user back to the free tier. Does NOT delete the user or their data.
export async function DELETE(_request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const { id } = await params;

  const profile = await db.businessProfile.findUnique({ where: { id } });
  if (!profile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (profile.subscriptionStatus === "none") {
    return badRequest("User has no subscription to revoke.");
  }

  const previousStatus = profile.subscriptionStatus;
  await db.businessProfile.update({
    where: { id },
    data: {
      subscriptionStatus: "expired",
      allocatedFeatures: null,
    },
  });

  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    action: "revoke_subscription",
    targetUserId: profile.userId,
    targetEmail: profile.email,
    details: { previousStatus },
  });

  return NextResponse.json({ success: true });
}
