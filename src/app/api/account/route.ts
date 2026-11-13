import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// DELETE /api/account — self-service permanent account deletion.
// Removes the Supabase auth user plus every app record owned by the user
// (documents + line items, clients, business profile). Cannot be undone.
export async function DELETE() {
  const user = await requireAuth();
  if (!user) return unauthorized();

  if (user.role === "admin") {
    return NextResponse.json(
      {
        error:
          "Admin accounts cannot be deleted from Settings. Contact support if you need to remove an admin account.",
      },
      { status: 403 },
    );
  }

  // Step 1: delete the Supabase auth user first (service role). If this
  // fails, nothing else has been removed, so the account stays consistent
  // and the user can simply retry.
  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    console.error("Account deletion failed: missing service role key.");
    return NextResponse.json(
      {
        error:
          "The server is missing the SUPABASE_SERVICE_ROLE_KEY environment variable. Account deletion is unavailable until it is configured.",
      },
      { status: 503 },
    );
  }

  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(
    user.id,
  );
  if (deleteAuthError) {
    console.error("Supabase user deletion failed:", deleteAuthError.message);
    return NextResponse.json(
      {
        error:
          "Could not delete your account right now. Please try again in a moment.",
      },
      { status: 500 },
    );
  }

  // Step 2: delete all app data owned by the user. Line items are removed
  // automatically with their documents (cascade).
  try {
    await db.$transaction([
      db.invoiceDocument.deleteMany({ where: { userId: user.id } }),
      db.client.deleteMany({ where: { userId: user.id } }),
      db.businessProfile.deleteMany({ where: { userId: user.id } }),
    ]);
  } catch (e) {
    // The auth user is already gone, so the account is unusable either way;
    // surface the error so the orphaned rows can be cleaned up by an admin.
    console.error("Prisma cleanup failed after auth deletion:", e);
    return NextResponse.json(
      {
        error:
          "Your login was deleted but cleanup of your records failed. Please contact support so we can finish the removal.",
      },
      { status: 500 },
    );
  }

  // Step 3: clear the session cookies.
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Cookies will be rejected on the next request anyway once the auth
    // user is gone — safe to ignore.
  }

  return NextResponse.json({ success: true });
}
