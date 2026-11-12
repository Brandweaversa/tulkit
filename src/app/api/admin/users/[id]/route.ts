import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Admin access required" }, { status: 403 });
}

type Params = { params: Promise<{ id: string }> };

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

  // 1. Delete from database (cascades to clients, documents, line items)
  await db.businessProfile.delete({ where: { id } });

  // 2. Delete from Supabase Auth (requires service role key)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(supabaseUserId);
      if (authError) {
        console.error("Failed to delete Supabase auth user:", authError);
        // DB profile is already deleted — auth user is orphaned but harmless
      }
    } catch (e) {
      console.error("Supabase auth deletion error:", e);
    }
  } else {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set — auth user not deleted");
  }

  return NextResponse.json({
    success: true,
    deletedUser: { email: userEmail, id: supabaseUserId },
  });
}
