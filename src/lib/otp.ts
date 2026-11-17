import { createHash, randomInt } from "crypto";
import { db } from "@/lib/db";
import { getPlatformSettings, smsReady } from "@/lib/platform-settings";
import { sendSms } from "@/lib/smsportal";

// Self-managed OTP verification over SMSPortal — the successor to the
// Twilio Verify flow. Twilio owned the whole code lifecycle; with a raw SMS
// pipe we own it: generate → hash → store → send → verify, with the same
// guard rails the WordPress integration had (resend wait, attempt cap,
// daily device/IP caps).
//
// The code itself is never stored — only a peppered SHA-256 hash, so a
// leaked database backup cannot reveal live codes.

export const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
export const OTP_RESEND_COOLDOWN_MS = 60_000; // 60 seconds between sends
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_DAILY_USER_LIMIT = 30; // per user per day
export const OTP_DAILY_IP_LIMIT = 100; // per IP per day
const OTP_LENGTH = 6;

function hashCode(
  code: string,
  userId: string,
  mobile: string,
): string {
  const pepper = process.env.OTP_HASH_PEPPER ?? "";
  return createHash("sha256")
    .update(`${code}:${userId}:${mobile}:${pepper}`)
    .digest("hex");
}

function hashIp(ip: string): string | null {
  if (!ip) return null;
  return createHash("md5").update(ip).digest("hex");
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Vercel puts the client IP in x-forwarded-for (first entry wins).
export function extractRequestIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "";
}

export type SendOtpResult =
  | { ok: true }
  | { ok: false; status: number; error: string; retryAfterSeconds?: number };

export async function createAndSendOtp(
  userId: string,
  e164: string,
  ip: string,
): Promise<SendOtpResult> {
  const settings = await getPlatformSettings();
  if (!smsReady(settings)) {
    return {
      ok: false,
      status: 503,
      error:
        "Mobile verification isn't switched on yet. Please try again later.",
    };
  }

  // Resend cooldown for the same user + number. Fast repeated clicks never
  // consume the daily allowance because this check runs first.
  const last = await db.otpCode.findFirst({
    where: { userId, mobile: e164 },
    orderBy: { sentAt: "desc" },
  });
  if (last) {
    const since = Date.now() - last.sentAt.getTime();
    if (since < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - since) / 1000,
      );
      return {
        ok: false,
        status: 429,
        error: `Please wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"} before requesting another code.`,
        retryAfterSeconds,
      };
    }
  }

  // Daily caps — protects the SMSPortal credit from abuse.
  const today = startOfToday();
  const ipHash = hashIp(ip);
  const [userCount, ipCount] = await Promise.all([
    db.otpCode.count({ where: { userId, sentAt: { gte: today } } }),
    ipHash
      ? db.otpCode.count({ where: { ipHash, sentAt: { gte: today } } })
      : Promise.resolve(0),
  ]);
  if (userCount >= OTP_DAILY_USER_LIMIT) {
    return {
      ok: false,
      status: 429,
      error:
        "Too many verification codes requested today. Please try again tomorrow or contact support.",
    };
  }
  if (ipCount >= OTP_DAILY_IP_LIMIT) {
    return {
      ok: false,
      status: 429,
      error:
        "Too many verification codes requested from this network. Please try again later or contact support.",
    };
  }

  // Housekeeping: codes only ever need to live 10 minutes; drop anything
  // older than two days so the table stays small.
  await db.otpCode.deleteMany({
    where: { sentAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
  });

  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
  const row = await db.otpCode.create({
    data: {
      userId,
      mobile: e164,
      codeHash: hashCode(code, userId, e164),
      ipHash,
      expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
    },
  });

  const result = await sendSms(
    settings.smsPortalClientId,
    settings.smsPortalClientSecret,
    e164,
    `Your Tulkit verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
  );
  if (!result.ok) {
    // No code was delivered — drop the row so the cooldown doesn't punish
    // the user for our SMS provider being down.
    await db.otpCode.delete({ where: { id: row.id } }).catch(() => {});
    console.error("SMSPortal send failed:", result.message);
    return {
      ok: false,
      status: 502,
      error:
        "Could not send the SMS right now. Please try again in a moment.",
    };
  }

  return { ok: true };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function verifyOtpCode(
  userId: string,
  e164: string,
  code: string,
): Promise<VerifyOtpResult> {
  const row = await db.otpCode.findFirst({
    where: { userId, mobile: e164 },
    orderBy: { sentAt: "desc" },
  });
  if (!row) {
    return { ok: false, status: 400, error: "Request a new code first." };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await db.otpCode.delete({ where: { id: row.id } }).catch(() => {});
    return {
      ok: false,
      status: 400,
      error: "That code has expired. Please request a new one.",
    };
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await db.otpCode.delete({ where: { id: row.id } }).catch(() => {});
    return {
      ok: false,
      status: 429,
      error: "Too many incorrect attempts. Please request a new code.",
    };
  }
  if (row.codeHash !== hashCode(code, userId, e164)) {
    await db.otpCode.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    return {
      ok: false,
      status: 400,
      error: "That code is incorrect. Please try again.",
    };
  }

  // One-time use — burn the row.
  await db.otpCode.delete({ where: { id: row.id } }).catch(() => {});
  return { ok: true };
}
