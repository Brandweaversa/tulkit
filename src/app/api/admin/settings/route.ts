import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAppSettings, updateAppSettings } from "@/lib/app-settings";
import { logAdminAction } from "@/lib/audit";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// GET /api/admin/settings — current global switches for the control panel.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const settings = await getAppSettings();
  return NextResponse.json({ settings });
}

// PUT /api/admin/settings — update any subset of the switches. Every real
// change is written to the admin audit log with before/after values.
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

  const previous = await getAppSettings();
  const settings = await updateAppSettings(body);

  const changes: Record<string, { from: boolean; to: boolean }> = {};
  for (const key of Object.keys(previous) as (keyof typeof previous)[]) {
    const from = previous[key];
    const to = settings[key];
    // Only the boolean switches are editable via this route — the pricing
    // numbers ride along read-only and change via platform settings.
    if (typeof from === "boolean" && typeof to === "boolean" && from !== to) {
      changes[key] = { from, to };
    }
  }

  if (Object.keys(changes).length > 0) {
    await logAdminAction({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: "update_settings",
      targetUserId: admin.id,
      targetEmail: admin.email,
      details: { changes },
    });
  }

  return NextResponse.json({ settings });
}
