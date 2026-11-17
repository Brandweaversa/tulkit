import { db } from "@/lib/db";
import {
  getPlatformSettings,
  ottPaymentReady,
  type PlatformSettingsResolved,
} from "@/lib/platform-settings";
import { ALL_FEATURES } from "@/lib/features";
import {
  isOttSuccess,
  ottCheckRemitVoucher,
  ottCheckVoucher,
  ottFriendlyError,
  ottRemitVoucher,
} from "@/lib/ott";

// OTT voucher redemption for Pro subscriptions.
//
// Spec iron rules baked in:
//   1. RemitVoucher is NEVER retried on timeout — recovery goes through
//      CheckRemitVoucher keyed by uniqueReference, which is persisted BEFORE
//      the remit is attempted.
//   2. No partial redemptions: the required subscription amount is remitted
//     exactly; OTT sends any unused balance to the verified mobile by SMS.
//   3. A verified South African mobile is mandatory (vault SMS + spec code 14).

const REFERENCE_PREFIX = "TUL-";

export function buildUniqueReference(): string {
  // Short, unique, traceable: TUL-<time36><random> (<= 30 chars).
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 36 ** 10).toString(36).padStart(10, "0");
  return `${REFERENCE_PREFIX}${t}${r}`.toUpperCase().slice(0, 30);
}

function digitsFromE164(e164: string): string {
  return e164.replace(/^\+/, "").replace(/\D/g, "");
}

// Common field names for the voucher value across OTT deployments — probe
// defensively rather than assume one shape.
const VOUCHER_VALUE_FIELDS = [
  "voucherValue",
  "voucherAmount",
  "value",
  "amount",
  "balance",
];

function readVoucherValue(body: Record<string, unknown>): number | null {
  for (const field of VOUCHER_VALUE_FIELDS) {
    const n = Number(body[field]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export type RedeemOutcome =
  | {
      status: "success";
      reference: string;
      amount: number;
      expiresAt: string;
      message: string;
    }
  | {
      status: "failed";
      reference?: string;
      message: string;
    }
  | {
      status: "processing";
      reference: string;
      message: string;
    }
  | {
      status: "mobile_required" | "not_configured" | "admin" | "rate_limited";
      reference?: string;
      message: string;
    };

// Idempotently flip a payment to success and extend the subscription once.
async function markSuccessAndExtend(
  paymentId: string,
  userId: string,
  ottResponse?: string,
): Promise<string> {
  const payment = await db.subscriptionPayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) throw new Error("Payment row vanished");
  const settings = await getPlatformSettings();
  const profile = await db.businessProfile.findUnique({ where: { userId } });

  const now = new Date();
  const base =
    profile?.subscriptionExpiresAt && profile.subscriptionExpiresAt > now
      ? profile.subscriptionExpiresAt
      : now;
  const expiresAt = new Date(
    base.getTime() + settings.subscriptionDays * 24 * 60 * 60 * 1000,
  );

  const alreadySuccess = payment.status === "success";
  await db.subscriptionPayment.update({
    where: { id: paymentId },
    data: {
      status: "success",
      errorMessage: null,
      ...(ottResponse !== undefined ? { ottResponse } : {}),
    },
  });
  // Extend exactly once per payment.
  if (!alreadySuccess) {
    await db.businessProfile.update({
      where: { userId },
      data: {
        subscriptionStatus: "active",
        subscriptionActivatedAt: profile?.subscriptionActivatedAt ?? now,
        subscriptionExpiresAt: expiresAt,
        allocatedFeatures: ALL_FEATURES.join(","),
      },
    });
  }
  return (expiresAt).toISOString();
}

// Resolve a pending/unknown payment by asking OTT what actually happened to
// its uniqueReference. Returns the settled status.
async function settlePayment(
  paymentId: string,
  userId: string,
): Promise<"success" | "failed" | "unknown"> {
  const payment = await db.subscriptionPayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) return "unknown";
  if (payment.status === "success" || payment.status === "failed") {
    return payment.status;
  }
  const settings = await getPlatformSettings();
  const check = await ottCheckRemitVoucher(settings, payment.uniqueReference);

  if (isOttSuccess(check.httpCode, check.body)) {
    await markSuccessAndExtend(
      paymentId,
      userId,
      JSON.stringify(check.body).slice(0, 4000),
    );
    return "success";
  }
  if (check.httpCode === 0) {
    // OTT unreachable — stay unresolved and try again later.
    return "unknown";
  }
  // Explicit answer: OTT has no record of this remit, so the voucher was
  // never consumed. Mark failed (the errorCode is kept for support).
  await db.subscriptionPayment.update({
    where: { id: paymentId },
    data: {
      status: "failed",
      errorCode: String(check.body.errorCode ?? ""),
      errorMessage: check.message || "OTT has no record of this payment.",
      ottResponse: JSON.stringify(check.body).slice(0, 4000),
    },
  });
  return "failed";
}

export async function redeemWithVoucher(
  userId: string,
  rawPin: string,
): Promise<RedeemOutcome> {
  const profile = await db.businessProfile.findUnique({
    where: { userId },
  });
  if (!profile) {
    return { status: "failed", message: "Unauthorized." };
  }
  if (profile.role === "admin") {
    return {
      status: "admin",
      message: "Admin accounts always have full access — no subscription needed.",
    };
  }
  if (!profile.mobileVerifiedAt) {
    return {
      status: "mobile_required",
      message:
        "Verify your South African mobile number in Settings first — OTT sends any unused voucher balance to it by SMS.",
    };
  }

  const settings: PlatformSettingsResolved = await getPlatformSettings();
  if (!ottPaymentReady(settings)) {
    return {
      status: "not_configured",
      message:
        "Voucher payments aren't fully set up yet. Please try again later or pay by other arrangement.",
    };
  }

  const pin = String(rawPin ?? "").replace(/\D/g, "");
  if (!pin || pin.length < 4) {
    return {
      status: "failed",
      message:
        "Enter the voucher PIN — the long number printed on the voucher slip.",
    };
  }

  // Resolve any stuck payment first. A previous attempt that timed out MUST
  // be settled (CheckRemitVoucher) before a new RemitVoucher is attempted.
  const stuck = await db.subscriptionPayment.findFirst({
    where: { userId, status: { in: ["pending", "unknown"] } },
    orderBy: { createdAt: "desc" },
  });
  if (stuck) {
    if (Date.now() - stuck.createdAt.getTime() < 90_000) {
      return {
        status: "rate_limited",
        reference: stuck.uniqueReference,
        message:
          "Your previous payment is still being processed. Please wait a moment and check its status before trying again.",
      };
    }
    const settled = await settlePayment(stuck.id, userId);
    if (settled === "success") {
      const settledPayment = await db.subscriptionPayment.findUnique({
        where: { id: stuck.id },
      });
      const profile2 = await db.businessProfile.findUnique({
        where: { userId },
      });
      return {
        status: "success",
        reference: stuck.uniqueReference,
        amount: settledPayment?.amount ?? settings.subscriptionAmount,
        expiresAt:
          profile2?.subscriptionExpiresAt?.toISOString() ??
          new Date().toISOString(),
        message: "Your earlier payment was confirmed — Pro is active.",
      };
    }
    if (settled === "unknown") {
      return {
        status: "processing",
        reference: stuck.uniqueReference,
        message:
          "An earlier payment is still being confirmed with OTT. Please check its status in a minute before trying another voucher.",
      };
    }
    // settled === "failed" → the earlier voucher was never consumed; fall
    // through and let the user try this one.
  }

  // 1) Validate the voucher (read-only — costs nothing).
  const check = await ottCheckVoucher(settings, pin);
  if (!isOttSuccess(check.httpCode, check.body)) {
    if (check.httpCode === 0) {
      return {
        status: "failed",
        message:
          "Could not reach the voucher service. Please try again in a moment.",
      };
    }
    return {
      status: "failed",
      message: ottFriendlyError(
        check.body,
        "This voucher could not be validated. Double-check the PIN and try again.",
      ),
    };
  }
  const voucherValue = readVoucherValue(check.body);
  const required = settings.subscriptionAmount;
  if (voucherValue !== null && voucherValue + 1e-9 < required) {
    return {
      status: "failed",
      message: `This voucher is worth R${voucherValue.toFixed(2)} — less than the R${required.toFixed(2)} needed. Use a voucher of at least R${required.toFixed(2)}.`,
    };
  }

  // 2) Persist BEFORE remitting — the uniqueReference exists in our DB
  //    before OTT ever sees it, so recovery is always possible.
  const reference = buildUniqueReference();
  const payment = await db.subscriptionPayment.create({
    data: {
      userId,
      businessProfileId: profile.id,
      provider: "ott_voucher",
      amount: required,
      voucherPinLast4: pin.slice(-4),
      uniqueReference: reference,
      status: "pending",
    },
  });

  // 3) Remit the exact subscription amount. On timeout: DO NOT retry —
  //    mark unknown and recover via CheckRemitVoucher.
  const remit = await ottRemitVoucher(settings, {
    account: settings.ottAccount,
    amount: required,
    clientId: `TUL-${profile.id}`.slice(0, 30),
    mobile: digitsFromE164(profile.mobileNumber ?? ""),
    pin,
    uniqueReference: reference,
  });

  if (remit.httpCode === 0) {
    await db.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: "unknown", errorMessage: remit.message },
    });
    return {
      status: "processing",
      reference,
      message:
        "The voucher service didn't respond in time. Your payment may still have gone through — do not retry the same voucher yet; check the payment status in a minute.",
    };
  }

  if (!isOttSuccess(remit.httpCode, remit.body)) {
    // "Already used" (code 7): ask OTT what happened to OUR reference —
    // the PIN may have been consumed by an earlier attempt of ours.
    if (String(remit.body.errorCode ?? "") === "7") {
      const settled = await settlePayment(payment.id, userId);
      if (settled === "success") {
        const profile2 = await db.businessProfile.findUnique({
          where: { userId },
        });
        return {
          status: "success",
          reference,
          amount: required,
          expiresAt:
            profile2?.subscriptionExpiresAt?.toISOString() ??
            new Date().toISOString(),
          message: "Payment confirmed — Pro is active.",
        };
      }
    }
    await db.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "failed",
        errorCode: String(remit.body.errorCode ?? ""),
        errorMessage: remit.message,
        ottResponse: JSON.stringify(remit.body).slice(0, 4000),
      },
    });
    return {
      status: "failed",
      reference,
      message: ottFriendlyError(
        remit.body,
        "The voucher could not be redeemed and no money has left it. Please try again or contact support.",
      ),
    };
  }

  // Success — extend the subscription.
  const expiresAt = await markSuccessAndExtend(
    payment.id,
    userId,
    JSON.stringify(remit.body).slice(0, 4000),
  );
  return {
    status: "success",
    reference,
    amount: required,
    expiresAt,
    message: "Payment successful — Pro is active.",
  };
}

// Used by the status endpoint: settle a payment if unresolved and report.
export async function getPaymentStatus(
  userId: string,
  reference: string,
): Promise<
  | { found: false }
  | {
      found: true;
      status: "pending" | "success" | "failed" | "unknown";
      message: string;
      expiresAt?: string;
    }
> {
  const payment = await db.subscriptionPayment.findFirst({
    where: { userId, uniqueReference: reference },
  });
  if (!payment) return { found: false };

  let status = payment.status as
    | "pending"
    | "success"
    | "failed"
    | "unknown";
  if (status === "pending" || status === "unknown") {
    status = await settlePayment(payment.id, userId);
  }

  if (status === "success") {
    const profile = await db.businessProfile.findUnique({
      where: { userId },
    });
    return {
      found: true,
      status,
      expiresAt: profile?.subscriptionExpiresAt?.toISOString(),
      message: "Payment confirmed — Pro is active.",
    };
  }
  if (status === "failed") {
    return {
      found: true,
      status,
      message:
        payment.errorMessage ||
        "OTT has no record of this payment — the voucher was not consumed. You can try again.",
    };
  }
  return {
    found: true,
    status,
    message:
      "Still waiting for confirmation from OTT. Check again in a minute — do not retry the same voucher yet.",
  };
}
