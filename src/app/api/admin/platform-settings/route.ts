import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getPlatformSettingsView,
  updatePlatformSettings,
} from "@/lib/platform-settings";
import { logAdminAction } from "@/lib/audit";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// GET /api/admin/platform-settings — client-safe view (secrets as booleans).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const settings = await getPlatformSettingsView();
  return NextResponse.json({ settings });
}

// PUT /api/admin/platform-settings — update any subset. Secret fields left
// blank keep their stored value; values are never echoed back. Every save
// lands in the admin audit log (secret values masked).
export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const settings = await updatePlatformSettings(body);

  // Audit: which fields changed — never the secret values themselves.
  const changedSecrets: string[] = [];
  for (const key of [
    "ottUsername",
    "ottPassword",
    "ottApiKey",
    "smsPortalClientId",
    "smsPortalClientSecret",
  ]) {
    if (typeof body[key] === "string" && (body[key] as string).trim() !== "") {
      changedSecrets.push(key);
    }
  }
  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    action: "update_platform_settings",
    targetUserId: admin.id,
    targetEmail: admin.email,
    details: {
      plainChanges: {
        ...(body.ottMode !== undefined ? { ottMode: body.ottMode } : {}),
        ...(body.subscriptionAmount !== undefined
          ? { subscriptionAmount: body.subscriptionAmount }
          : {}),
        ...(body.subscriptionDays !== undefined
          ? { subscriptionDays: body.subscriptionDays }
          : {}),
        ...(body.ottVendorId !== undefined ? { ottVendorId: "(updated)" } : {}),
        ...(body.ottAccount !== undefined ? { ottAccount: "(updated)" } : {}),
        ...(body.ottTestBaseUrl !== undefined
          ? { ottTestBaseUrl: "(updated)" }
          : {}),
        ...(body.ottLiveBaseUrl !== undefined
          ? { ottLiveBaseUrl: "(updated)" }
          : {}),
        ...(body.ottTimeoutSeconds !== undefined
          ? { ottTimeoutSeconds: body.ottTimeoutSeconds }
          : {}),
      },
      secretFieldsUpdated: changedSecrets,
    },
  });

  return NextResponse.json({ settings });
}
