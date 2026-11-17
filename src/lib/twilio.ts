// Minimal Twilio Verify REST client — plain fetch, no SDK dependency.
//
// Twilio Verify owns the OTP lifecycle end-to-end: it generates the code,
// sends the SMS, handles resend/attempt limits, and we only ask it to check
// the code the user typed. Nothing secret is stored in our database.
//
// Docs: https://www.twilio.com/docs/verify/api
//
// Required environment variables:
//   TWILIO_ACCOUNT_SID          — AC... from the Twilio console
//   TWILIO_AUTH_TOKEN           — from the Twilio console
//   TWILIO_VERIFY_SERVICE_SID   — VA... from a Verify service named e.g. "Tulkit"

const VERIFY_BASE = "https://verify.twilio.com/v2";

interface TwilioVerifyCreds {
  accountSid: string;
  authToken: string;
  serviceSid: string;
}

// Returns the configured credentials, or null when env vars are missing
// (the app then reports "verification not configured" instead of crashing).
export function getTwilioVerifyCreds(): TwilioVerifyCreds | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !serviceSid) return null;
  return { accountSid, authToken, serviceSid };
}

type TwilioCallResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; message: string };

async function twilioPost(
  creds: TwilioVerifyCreds,
  path: string,
  params: Record<string, string>,
): Promise<TwilioCallResult> {
  let res: Response;
  try {
    res = await fetch(`${VERIFY_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString(
            "base64",
          ),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : "Network error",
    };
  }
  const data = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!res.ok) {
    const message =
      (data && typeof data.message === "string" && data.message) ||
      `Twilio request failed (${res.status})`;
    return { ok: false, status: res.status, message };
  }
  return { ok: true, data: data ?? {} };
}

// Start a verification: Twilio generates the code and sends the SMS.
export type SendVerificationResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "twilio_error"; message: string };

export async function sendMobileVerification(
  toE164: string,
): Promise<SendVerificationResult> {
  const creds = getTwilioVerifyCreds();
  if (!creds) {
    return {
      ok: false,
      reason: "not_configured",
      message: "SMS verification is not configured.",
    };
  }
  const r = await twilioPost(
    creds,
    `/Services/${creds.serviceSid}/Verifications`,
    { To: toE164, Channel: "sms" },
  );
  if (!r.ok) return { ok: false, reason: "twilio_error", message: r.message };
  return { ok: true };
}

// Check the code the user typed. Only status "approved" counts as verified.
export type CheckVerificationResult =
  | { ok: true; approved: boolean }
  | { ok: false; reason: "not_configured" | "twilio_error"; message: string };

export async function checkMobileVerification(
  toE164: string,
  code: string,
): Promise<CheckVerificationResult> {
  const creds = getTwilioVerifyCreds();
  if (!creds) {
    return {
      ok: false,
      reason: "not_configured",
      message: "SMS verification is not configured.",
    };
  }
  // Twilio returns 200 + "pending" for a wrong-but-valid attempt and an
  // error status for expired/unknown checks — both mean "not approved".
  const r = await twilioPost(
    creds,
    `/Services/${creds.serviceSid}/VerificationCheck`,
    { To: toE164, Code: code },
  );
  if (!r.ok) return { ok: false, reason: "twilio_error", message: r.message };
  return { ok: true, approved: r.data.status === "approved" };
}
