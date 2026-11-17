import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPaymentStatus } from "@/lib/payments/ott-voucher";

// Poll the status of a voucher payment by its unique reference. Unresolved
// payments are settled against CheckRemitVoucher here — this is the ONLY
// sanctioned recovery path; RemitVoucher itself is never retried.
export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    reference?: unknown;
  } | null;
  const reference =
    typeof body?.reference === "string" ? body.reference.trim() : "";
  if (!reference) {
    return NextResponse.json(
      { error: "Missing payment reference." },
      { status: 400 },
    );
  }

  const result = await getPaymentStatus(user.id, reference);
  if (!result.found) {
    return NextResponse.json(
      { error: "No such payment reference." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    status: result.status,
    message: result.message,
    expiresAt: result.expiresAt ?? null,
  });
}
