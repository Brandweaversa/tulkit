// Minimal SMSPortal bulk SMS REST client — plain fetch, no SDK dependency.
//
// Mirrors the proven WordPress integration (Helpa Shared SMS OTP V3)
// endpoint-for-endpoint: POST https://rest.smsportal.com/bulkmessages with
// Basic auth (Client ID : Client Secret) and a JSON body of
// { messages: [{ content, destination }] } where destination is the number
// in digit form without the plus (e.g. "27721234567").
//
// Credentials come from platform settings (admin panel), optionally
// overridden by the SMSPORTAL_CLIENT_ID / SMSPORTAL_CLIENT_SECRET env vars.

const BULK_ENDPOINT = "https://rest.smsportal.com/bulkmessages";
const SEND_TIMEOUT_MS = 30_000;

export type SmsSendResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; message: string };

// E.164 (+27721234567) → SMSPortal destination ("27721234567").
export function smsDestinationFromE164(e164: string): string {
  return e164.replace(/^\+/, "").replace(/\D/g, "");
}

export async function sendSms(
  clientId: string,
  clientSecret: string,
  destinationE164: string,
  message: string,
): Promise<SmsSendResult> {
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      status: 0,
      message: "SMSPortal credentials are not configured.",
    };
  }
  const destination = smsDestinationFromE164(destinationE164);
  if (!destination) {
    return { ok: false, status: 0, message: "Missing destination number." };
  }

  let res: Response;
  try {
    res = await fetch(BULK_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [{ content: message, destination }],
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : "Network error",
    };
  }

  const data = (await res.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (res.ok) {
    return { ok: true, data: data ?? {} };
  }
  const msg =
    (data && typeof data.message === "string" && data.message) ||
    `SMSPortal request failed (${res.status})`;
  return { ok: false, status: res.status, message: msg };
}
