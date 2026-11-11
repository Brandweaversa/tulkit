import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

type Params = { params: Promise<{ id: string }> };

// DELETE /api/admin/users/[id] — permanently delete a non-admin user and their app data.
export async function DELETE(_request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const { id } = await params;

  if (!id || id === admin.id) {
    return NextResponse.json(
      { error: "You cannot delete your own admin account." },
      { status: 403 },
    );
  }

  try {
    const profile = await db.businessProfile.findUnique({
      where: { userId: id },
      select: { role: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (profile.role === "admin") {
      return NextResponse.json(
        { error: "Admin accounts cannot be deleted from this screen." },
        { status: 403 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.auth.admin.deleteUser(id);

    if (error) {
      console.error("Supabase admin user deletion failed:", error.message);
      return NextResponse.json(
        { error: "Could not delete the user's authentication account." },
        { status: 502 },
      );
    }

    await db.$transaction(async (tx) => {
      await tx.invoiceDocument.deleteMany({ where: { userId: id } });
      await tx.client.deleteMany({ where: { userId: id } });
      await tx.businessProfile.deleteMany({ where: { userId: id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin user deletion failed:", error);
    return NextResponse.json(
      { error: "Failed to complete user deletion. Check the server logs." },
      { status: 500 },
    );
  }
}