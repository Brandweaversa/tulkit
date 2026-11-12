import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

// Bucket dates into `weeks` weekly buckets, oldest first.
function bucketByWeek(dates: Date[], weeks: number, now: number): number[] {
  const buckets = new Array<number>(weeks).fill(0);
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  for (const d of dates) {
    const age = now - d.getTime();
    if (age < 0) continue;
    const idx = weeks - 1 - Math.floor(age / weekMs);
    if (idx >= 0 && idx < weeks) buckets[idx] += 1;
  }
  return buckets;
}

// GET /api/admin/stats — dashboard stats for admin
export async function GET() {
  await requireAdmin();

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const eightWeeksAgo = new Date(now - 8 * 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeSubscriptions,
    trialUsers,
    expiredSubscriptions,
    freeUsers,
    totalDocuments,
    totalClients,
    activeUsers7d,
    activeUsers30d,
    recentSignups,
    recentDocuments,
    everTrialed,
    convertedTrials,
    recentlyExpired,
  ] = await Promise.all([
    db.businessProfile.count(),
    db.businessProfile.count({
      where: { subscriptionStatus: "active" },
    }),
    db.businessProfile.count({
      where: { subscriptionStatus: "trial" },
    }),
    db.businessProfile.count({
      where: { subscriptionStatus: "expired" },
    }),
    db.businessProfile.count({
      where: { subscriptionStatus: "none" },
    }),
    db.invoiceDocument.count(),
    db.client.count(),
    // Users who created at least one document in the window (engagement)
    db.invoiceDocument.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    db.invoiceDocument.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    // Weekly buckets (last 8 weeks)
    db.businessProfile.findMany({
      where: { createdAt: { gte: eightWeeksAgo } },
      select: { createdAt: true },
    }),
    db.invoiceDocument.findMany({
      where: { createdAt: { gte: eightWeeksAgo } },
      select: { createdAt: true },
    }),
    // Trial -> Pro conversion. trialExpiresAt is set at signup, so its
    // presence marks accounts that ever had a trial.
    db.businessProfile.count({
      where: { trialExpiresAt: { not: null } },
    }),
    db.businessProfile.count({
      where: { trialExpiresAt: { not: null }, subscriptionStatus: "active" },
    }),
    // Subscriptions that expired within the last 30 days (approximate churn)
    db.businessProfile.count({
      where: {
        subscriptionStatus: "expired",
        subscriptionExpiresAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  // Count users with active subs created in the last 30 days
  const recentActivations = await db.businessProfile.count({
    where: {
      subscriptionStatus: "active",
      subscriptionActivatedAt: { gte: thirtyDaysAgo },
    },
  });

  const trialConversionRate =
    everTrialed > 0 ? Math.round((convertedTrials / everTrialed) * 100) : null;

  return NextResponse.json({
    totalUsers,
    activeSubscriptions,
    trialUsers,
    expiredSubscriptions,
    freeUsers,
    totalDocuments,
    totalClients,
    recentActivations,
    // Revenue estimate (R99 per active sub)
    estimatedMonthlyRevenue: activeSubscriptions * 99,

    // Engagement: users who actually created documents in the window
    activeUsers7d: activeUsers7d.length,
    activeUsers30d: activeUsers30d.length,

    // Trial -> Pro conversion
    trialConversionRate,
    trialConverted: convertedTrials,
    trialTotal: everTrialed,

    // Approximate churn: subs that expired in the last 30 days
    expiredLast30d: recentlyExpired,

    // Weekly history, oldest -> newest (8 buckets)
    signupsPerWeek: bucketByWeek(recentSignups.map((u) => u.createdAt), 8, now),
    documentsPerWeek: bucketByWeek(recentDocuments.map((d) => d.createdAt), 8, now),
  });
}
