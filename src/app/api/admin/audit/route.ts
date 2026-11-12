import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// GET /api/admin/audit — latest admin actions for the audit trail.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const entries = await db.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    entries: entries.map((e) => {
      let details: Record<string, unknown> | null = null;
      if (e.details) {
        try {
          details = JSON.parse(e.details) as Record<string, unknown>;
        } catch {
          details = null;
        }
      }
      return {
        id: e.id,
        action: e.action,
        adminEmail: e.adminEmail,
        targetEmail: e.targetEmail,
        details,
        createdAt: e.createdAt.toISOString(),
      };
    }),
  });
}
