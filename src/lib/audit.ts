import { db } from "@/lib/db";

export type AdminAction = "activate_subscription" | "revoke_subscription" | "delete_user";

// Fire-and-forget audit logging for platform-admin actions.
// Logging failures are reported to the server console but never block
// the admin action itself.
export async function logAdminAction(params: {
  adminUserId: string;
  adminEmail?: string | null;
  action: AdminAction;
  targetUserId: string;
  targetEmail?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        adminUserId: params.adminUserId,
        adminEmail: params.adminEmail ?? null,
        action: params.action,
        targetUserId: params.targetUserId,
        targetEmail: params.targetEmail ?? null,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch (e) {
    console.error("Failed to write admin audit log:", e);
  }
}
