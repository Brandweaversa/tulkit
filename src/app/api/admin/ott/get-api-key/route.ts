import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "@/lib/platform-settings";
import { ottGetApiKey } from "@/lib/ott";
import { logAdminAction } from "@/lib/audit";

// POST /api/admin/ott/get-api-key — the admin panel's "Get / Confirm API
// Key" button. Mirrors the WordPress behaviour: call GetAPIKey; a 200 means
// a NEW key was issued and is stored; 201 + errorCode 2 means keep the
// existing key.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getPlatformSettings();
  const result = await ottGetApiKey(settings, { force: true });

  if (result.ok) {
    // Persist the key unless it's provided via env (env would win anyway,
    // but the stored value stays in sync for when the env var is removed).
    if (result.apiKey !== settings.ottApiKey) {
      await updatePlatformSettings({ ottApiKey: result.apiKey });
      await logAdminAction({
        adminUserId: admin.id,
        adminEmail: admin.email,
        action: "update_platform_settings",
        targetUserId: admin.id,
        targetEmail: admin.email,
        details: { ottApiKey: "(rotated via GetAPIKey)" },
      });
    }
    return NextResponse.json({
      ok: true,
      message: result.message,
      isNew: Boolean(result.isNew),
      keptExisting: Boolean(result.keptExisting),
    });
  }

  return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
}
