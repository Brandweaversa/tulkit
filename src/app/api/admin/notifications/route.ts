import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// GET /api/admin/notifications — recent platform activity for the admin
// header bell: latest signups and latest subscription events.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [signups, subEvents] = await Promise.all([
    db.businessProfile.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        email: true,
        role: true,
        subscriptionStatus: true,
        createdAt: true,
      },
    }),
    db.adminAuditLog.findMany({
      where: { action: { in: ["activate_subscription", "revoke_subscription"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        adminEmail: true,
        targetEmail: true,
        createdAt: true,
      },
    }),
  ]);

  // Counts for the last 7 days (used for the bell badge)
  const [signups7d, activations7d, revocations7d] = await Promise.all([
    db.businessProfile.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.adminAuditLog.count({
      where: { action: "activate_subscription", createdAt: { gte: sevenDaysAgo } },
    }),
    db.adminAuditLog.count({
      where: { action: "revoke_subscription", createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  return NextResponse.json({
    signups: signups.map((s) => ({
      id: s.id,
      email: s.email,
      role: s.role,
      subscriptionStatus: s.subscriptionStatus,
      createdAt: s.createdAt.toISOString(),
    })),
    subEvents: subEvents.map((e) => ({
      id: e.id,
      action: e.action,
      adminEmail: e.adminEmail,
      targetEmail: e.targetEmail,
      createdAt: e.createdAt.toISOString(),
    })),
    counts: {
      signups7d,
      activations7d,
      revocations7d,
    },
  });
}
