import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { FEATURE_KEYS } from "@/lib/types";
import { daysRemaining } from "@/lib/features";
import { listAllAuthUsers } from "@/lib/supabase/admin";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// GET /api/admin/users — list app profiles for users that still exist in Supabase Auth.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  try {
    const [authUsers, profiles] = await Promise.all([
      listAllAuthUsers(),
      db.businessProfile.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          role: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
          subscriptionActivatedAt: true,
          allocatedFeatures: true,
          createdAt: true,
        },
      }),
    ]);

    const authUsersById = new Map(authUsers.map((authUser) => [authUser.id, authUser]));
    const users = profiles
      .filter((profile) => authUsersById.has(profile.userId))
      .map((profile) => {
        const authUser = authUsersById.get(profile.userId)!;
        return {
          id: profile.id,
          userId: profile.userId,
          name: profile.name,
          email: profile.email || authUser.email || "",
          role: profile.role,
          subscriptionStatus: profile.subscriptionStatus,
          subscriptionExpiresAt: profile.subscriptionExpiresAt?.toISOString(),
          subscriptionActivatedAt: profile.subscriptionActivatedAt?.toISOString(),
          allocatedFeatures: profile.allocatedFeatures
            ? profile.allocatedFeatures.split(",").filter((feature) =>
                FEATURE_KEYS.includes(feature as (typeof FEATURE_KEYS)[number]),
              )
            : [],
          daysRemaining: daysRemaining(profile.subscriptionExpiresAt?.toISOString()),
          createdAt: profile.createdAt.toISOString(),
        };
      });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Failed to load admin users:", error);
    return NextResponse.json(
      { error: "Could not load users. Check the Supabase admin key and try again." },
      { status: 500 },
    );
  }
}
