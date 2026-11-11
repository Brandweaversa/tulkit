import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

type Params = { params: Promise<{ userId: string }> };

// DELETE /api/admin/users/[userId] — permanently delete a non-admin user and their app data.
export async function DELETE(_request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const { userId } = await params;
  if (!userId || userId === admin.id) {
    return NextResponse.json(
      { error: "You cannot delete your own admin account." },
      { status: 403 },
    );
  }

  try {
    const profile = await db.businessProfile.findUnique({
      where: { userId },
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

    // Remove the Auth identity first. The service-role key is server-only.
    const supabase = createSupabaseAdminClient();
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error("Supabase admin user deletion failed:", authDeleteError.message);
      return NextResponse.json(
        { error: "Could not delete the user's authentication account." },
        { status: 502 },
      );
    }

    // Remove the user's Tulkit records. Deleting documents cascades to line items;
    // deleting clients also cascades any remaining linked documents.
    await db.$transaction(async (tx) => {
      await tx.invoiceDocument.deleteMany({ where: { userId } });
      await tx.client.deleteMany({ where: { userId } });
      await tx.businessProfile.deleteMany({ where: { userId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin user deletion failed:", error);
    return NextResponse.json(
      {
        error:
          "The Auth account was deleted, but Tulkit could not finish removing its data. Please retry or contact support.",
      },
      { status: 500 },
    );
  }
}
