import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { listAllAuthUsers } from "@/lib/supabase/admin";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Admin access required" }, { status: 403 });
}

// GET /api/admin/stats — dashboard stats for admin
export async function GET() {
  const user = await requireAdmin();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  try {
    const authUsers = await listAllAuthUsers();
    const liveUserIds = new Set(authUsers.map((u) => u.id));

    const profiles = await db.businessProfile.findMany({
      where: {
        userId: {
          in: [...liveUserIds],
        },
      },
      select: {
        subscriptionStatus: true,
        subscriptionActivatedAt: true,
      },
    });

    const totalUsers = profiles.length;
    const activeSubscriptions = profiles.filter(
      (p) => p.subscriptionStatus === "active",
    ).length;
    const expiredSubscriptions = profiles.filter(
      (p) => p.subscriptionStatus === "expired",
    ).length;
    const freeUsers = profiles.filter(
      (p) => p.subscriptionStatus === "none",
    ).length;

    const totalDocuments = await db.invoiceDocument.count();
    const totalClients = await db.client.count();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentActivations = profiles.filter(
      (p) =>
        p.subscriptionStatus === "active" &&
        p.subscriptionActivatedAt &&
        new Date(p.subscriptionActivatedAt) >= thirtyDaysAgo,
    ).length;

    return NextResponse.json({
      totalUsers,
      activeSubscriptions,
      expiredSubscriptions,
      freeUsers,
      totalDocuments,
      totalClients,
      recentActivations,
      estimatedMonthlyRevenue: activeSubscriptions * 99,
    });
  } catch (error) {
    console.error("Failed to load admin stats:", error);
    return NextResponse.json(
      { error: "Could not load stats. Check Supabase admin credentials." },
      { status: 500 },
    );
  }
}