import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { daysRemaining } from "@/lib/features";
import { FREE_TIER_LIMITS, FEATURE_KEYS } from "@/lib/types";
import type { FeatureKey } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Admin access required" }, { status: 403 });
}

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/users/[id] — detailed per-user view for the platform admin.
// Privacy: returns usage COUNTS only — never end-client PII (names, emails,
// VAT numbers) and never the business's banking details.
export async function GET(_request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const { id } = await params;

  const profile = await db.businessProfile.findUnique({ where: { id } });
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    clientCount,
    totalDocuments,
    documentsLast30Days,
    byTypeStatus,
    lastCreatedDoc,
    lastSentDoc,
    lastPaidDoc,
  ] = await Promise.all([
    db.client.count({ where: { userId: profile.userId } }),
    db.invoiceDocument.count({ where: { userId: profile.userId } }),
    db.invoiceDocument.count({
      where: { userId: profile.userId, createdAt: { gte: thirtyDaysAgo } },
    }),
    db.invoiceDocument.groupBy({
      by: ["type", "status"],
      where: { userId: profile.userId },
      _count: { _all: true },
    }),
    db.invoiceDocument.findFirst({
      where: { userId: profile.userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.invoiceDocument.findFirst({
      where: { userId: profile.userId, sentAt: { not: null } },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
    db.invoiceDocument.findFirst({
      where: { userId: profile.userId, paidAt: { not: null } },
      orderBy: { paidAt: "desc" },
      select: { paidAt: true },
    }),
  ]);

  // Aggregate type/status counts from the grouped rows
  const invoices = byTypeStatus
    .filter((g) => g.type === "invoice")
    .reduce((sum, g) => sum + g._count._all, 0);
  const quotes = byTypeStatus
    .filter((g) => g.type === "quote")
    .reduce((sum, g) => sum + g._count._all, 0);
  const byStatus: Record<string, number> = {};
  for (const g of byTypeStatus) {
    byStatus[g.status] = (byStatus[g.status] ?? 0) + g._count._all;
  }

  const allocatedFeatures = (profile.allocatedFeatures ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter((f) => FEATURE_KEYS.includes(f as FeatureKey));

  // Estimated spend: R99 per 30 days of Pro time consumed so far
  const now = Date.now();
  const activatedAt = profile.subscriptionActivatedAt?.getTime() ?? null;
  const expiresAt = profile.subscriptionExpiresAt?.getTime() ?? null;
  let proDays = 0;
  if (activatedAt) {
    const end = expiresAt && expiresAt < now ? expiresAt : now;
    proDays = Math.max(0, Math.round((end - activatedAt) / (1000 * 60 * 60 * 24)));
  }
  const estimatedSpendRands = Math.round((proDays / 30) * 99);

  // Business profile completeness (booleans only — no bank values exposed)
  const profileItems = [
    Boolean(profile.logoDataUrl),
    Boolean(profile.address),
    Boolean(profile.vatNumber),
    Boolean(profile.bankName || profile.bankAccount),
    Boolean(profile.phone),
  ];
  const completenessScore = profileItems.filter(Boolean).length;

  // Risk flags for the admin dashboard
  const flags: string[] = [];
  if (totalDocuments === 0) {
    flags.push("never_used");
  }
  if (
    profile.subscriptionStatus === "trial" &&
    (profile.trialExpiresAt?.getTime() ?? Infinity) - now <= 7 * 24 * 60 * 60 * 1000
  ) {
    flags.push("trial_ending_soon");
  }
  if (profile.subscriptionStatus === "expired" && documentsLast30Days > 0) {
    flags.push("expired_with_activity");
  }
  if (
    !allocatedFeatures.includes("unlimited_clients") &&
    clientCount >= FREE_TIER_LIMITS.maxClients
  ) {
    flags.push("hitting_client_limit");
  }
  if (
    totalDocuments > 0 &&
    lastCreatedDoc &&
    lastCreatedDoc.createdAt.getTime() < thirtyDaysAgo.getTime()
  ) {
    flags.push("dormant_30d");
  }

  return NextResponse.json({
    user: {
      id: profile.id,
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      createdAt: profile.createdAt.toISOString(),
    },
    subscription: {
      status: profile.subscriptionStatus,
      activatedAt: profile.subscriptionActivatedAt?.toISOString() ?? null,
      expiresAt: profile.subscriptionExpiresAt?.toISOString() ?? null,
      trialExpiresAt: profile.trialExpiresAt?.toISOString() ?? null,
      daysRemaining: daysRemaining(profile.subscriptionExpiresAt?.toISOString()),
      allocatedFeatures,
    },
    usage: {
      clientCount,
      totalDocuments,
      invoices,
      quotes,
      byStatus,
      documentsLast30Days,
      lastDocumentAt: lastCreatedDoc?.createdAt.toISOString() ?? null,
      lastSentAt: lastSentDoc?.sentAt?.toISOString() ?? null,
      lastPaidAt: lastPaidDoc?.paidAt?.toISOString() ?? null,
      estimatedSpendRands,
    },
    profile: {
      hasLogo: profileItems[0],
      hasAddress: profileItems[1],
      hasVatNumber: profileItems[2],
      hasBanking: profileItems[3],
      hasPhone: profileItems[4],
      completenessScore, // 0-5
    },
    flags,
  });
}

// DELETE /api/admin/users/[id] — delete a user + all their data + Supabase auth account
export async function DELETE(_request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();
  if (admin.role !== "admin") return forbidden();

  const { id } = await params;

  // Find the user's profile
  const profile = await db.businessProfile.findUnique({ where: { id } });
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Don't allow admin to delete themselves
  if (profile.userId === admin.id) {
    return NextResponse.json(
      { error: "You cannot delete your own admin account" },
      { status: 400 },
    );
  }

  const supabaseUserId = profile.userId;
  const userEmail = profile.email ?? "unknown";

  // Impact counts for the audit trail
  const [clientCount, documentCount] = await Promise.all([
    db.client.count({ where: { userId: supabaseUserId } }),
    db.invoiceDocument.count({ where: { userId: supabaseUserId } }),
  ]);

  // 1. Delete all app data + profile.
  //    NOTE: Client and InvoiceDocument reference the user by userId only (no
  //    FK to BusinessProfile), so a profile delete does NOT cascade — delete
  //    them explicitly.
  await db.$transaction(async (tx) => {
    await tx.invoiceDocument.deleteMany({ where: { userId: supabaseUserId } });
    await tx.client.deleteMany({ where: { userId: supabaseUserId } });
    await tx.businessProfile.delete({ where: { id } });
  });

  // 2. Delete from Supabase Auth (requires service role key)
  let authDeleted = false;
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(supabaseUserId);
    authDeleted = !authError;
    if (authError) {
      console.error("Failed to delete Supabase auth user:", authError);
      // DB profile is already deleted — auth user is orphaned but harmless
    }
  } catch (e) {
    console.error("Supabase auth deletion error:", e);
  }

  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    action: "delete_user",
    targetUserId: supabaseUserId,
    targetEmail: profile.email,
    details: {
      clients: clientCount,
      documents: documentCount,
      authDeleted,
    },
  });

  return NextResponse.json({
    success: true,
    deletedUser: { email: userEmail, id: supabaseUserId },
  });
}
