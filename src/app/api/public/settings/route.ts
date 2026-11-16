import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/app-settings";

// No auth: the login screen and install banner need these before any user
// session exists. Only non-sensitive on/off switches are exposed — nothing
// here is a secret or a per-user value.
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json({ settings });
}
