import { createHash } from "crypto";
import type { PlatformSettingsResolved } from "@/lib/platform-settings";

// OTT Voucher Redemption API client (Specification v6 web services).
//
// Hash rule — mirrors the production WordPress implementation byte-for-byte:
//   SHA256( apiKey + the VALUES of all parameters except the hash itself,
//           concatenated in alphabetical order of PARAMETER NAME,
//           compared case-insensitively )
//
// Field-name quirks mirrored exactly:
//   - CheckVoucher      expects the hash field spelled "Hash"
//   - RemitVoucher      expects "hash"
//   - CheckRemitVoucher expects "hash"
//
// Endpoints:
//   POST {base}/api/v1/GetAPIKey         200 = new key, 201 + errorCode 2 = keep existing
//   POST {base}/api/v1/CheckVoucher      validate a PIN, read its value
//   POST {base}/api/v1/RemitVoucher      redeem (amount "0" = full voucher)
//   POST {base}/api/v1/CheckRemitVoucher status recovery by uniqueReference
//
// Transport: Basic Auth + x-www-form-urlencoded POST + TLS (1.2+).

export function buildOttHash(
  params: Record<string, string>,
  apiKey: string,
): string {
  const keys = Object.keys(params)
    .filter((k) => k.toLowerCase() !== "hash")
    .sort((a, b) => {
      const la = a.toLowerCase();
      const lb = b.toLowerCase();
      if (la < lb) return -1;
      if (la > lb) return 1;
      return 0;
    });
  let hashString = apiKey;
  for (const key of keys) {
    hashString += String(params[key]);
  }
  return createHash("sha256").update(hashString).digest("hex");
}

export function ottBaseUrl(settings: PlatformSettingsResolved): string {
  const base =
    settings.ottMode === "live"
      ? settings.ottLiveBaseUrl
      : settings.ottTestBaseUrl;
  return base.replace(/\/+$/, "");
}

export interface OttCallResult {
  // 0 = the request never completed (network/timeout). RemitVoucher calls
  // in this state are NEVER retried — recover via CheckRemitVoucher.
  httpCode: number;
  body: Record<string, unknown>;
  message: string;
}

export async function ottPost(
  settings: PlatformSettingsResolved,
  endpoint: string,
  body: Record<string, string>,
): Promise<OttCallResult> {
  const url = `${ottBaseUrl(settings)}/${endpoint.replace(/^\/+/, "")}`;
  const timeoutMs =
    Math.min(120, Math.max(10, settings.ottTimeoutSeconds)) * 1000;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${settings.ottUsername}:${settings.ottPassword}`,
          ).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    return {
      httpCode: 0,
      body: {},
      message: e instanceof Error ? e.message : "Network error",
    };
  }
  const raw = await res.text();
  let json: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    json = parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : { raw };
  } catch {
    json = { raw };
  }
  const message =
    typeof json.message === "string" ? json.message.trim() : "";
  return { httpCode: res.status, body: json, message };
}

// Success check mirrors the WordPress implementation: 2xx and either a
// success field in (true, 1, "true", "1", "yes") or an apiKey present.
export function isOttSuccess(
  httpCode: number,
  body: Record<string, unknown>,
): boolean {
  if (httpCode < 200 || httpCode >= 300) return false;
  const s: unknown = body.success;
  if (s === true || s === 1 || s === "true" || s === "1" || s === "yes") {
    return true;
  }
  return Boolean(body.apiKey);
}

// GetAPIKey is called with Basic Auth only (no hash — there is no key yet).
// 200 + apiKey = a NEW key was issued (store it). 201 + errorCode 2 = OTT
// says keep using the existing key.
export type OttGetKeyResult =
  | {
      ok: true;
      apiKey: string;
      isNew?: boolean;
      keptExisting?: boolean;
      message: string;
    }
  | { ok: false; message: string; httpCode: number };

export async function ottGetApiKey(
  settings: PlatformSettingsResolved,
  opts: { force?: boolean } = {},
): Promise<OttGetKeyResult> {
  if (!settings.ottUsername || !settings.ottPassword) {
    return {
      ok: false,
      httpCode: 0,
      message: "OTT username or password is missing.",
    };
  }
  if (!opts.force && settings.ottApiKey) {
    return {
      ok: true,
      apiKey: settings.ottApiKey,
      message: "Existing OTT API key is available.",
    };
  }
  const res = await ottPost(settings, "api/v1/GetAPIKey", {});
  if (res.httpCode === 200 && typeof res.body.apiKey === "string" && res.body.apiKey) {
    return {
      ok: true,
      apiKey: res.body.apiKey,
      isNew: true,
      message: "New OTT API key issued and saved.",
    };
  }
  if (
    res.httpCode === 201 &&
    String(res.body.errorCode ?? "") === "2" &&
    settings.ottApiKey
  ) {
    return {
      ok: true,
      apiKey: settings.ottApiKey,
      keptExisting: true,
      message: "OTT says to keep using your existing API key.",
    };
  }
  return {
    ok: false,
    httpCode: res.httpCode,
    message: res.message || "Could not get an OTT API key.",
  };
}

export async function ottCheckVoucher(
  settings: PlatformSettingsResolved,
  voucherPin: string,
): Promise<OttCallResult> {
  const body: Record<string, string> = {
    vendorID: String(settings.ottVendorId),
    voucherPIN: voucherPin.replace(/\D/g, ""),
  };
  body["Hash"] = buildOttHash(body, settings.ottApiKey);
  return ottPost(settings, "api/v1/CheckVoucher", body);
}

export async function ottRemitVoucher(
  settings: PlatformSettingsResolved,
  args: {
    account: string;
    amount: number; // rand amount; 0 redeems the full voucher value
    clientId: string;
    mobile: string; // digits, e.g. 27721234567 — vault SMS goes here
    pin: string;
    uniqueReference: string;
  },
): Promise<OttCallResult> {
  const amount =
    args.amount > 0 ? args.amount.toFixed(2) : "0";
  const body: Record<string, string> = {
    account: args.account,
    amount,
    clientID: args.clientId,
    mobile: args.mobile,
    pin: args.pin.replace(/\D/g, ""),
    uniqueReference: args.uniqueReference,
    vendorID: String(settings.ottVendorId),
  };
  body["hash"] = buildOttHash(body, settings.ottApiKey);
  return ottPost(settings, "api/v1/RemitVoucher", body);
}

export async function ottCheckRemitVoucher(
  settings: PlatformSettingsResolved,
  uniqueReference: string,
): Promise<OttCallResult> {
  const body: Record<string, string> = {
    uniqueReference,
  };
  body["hash"] = buildOttHash(body, settings.ottApiKey);
  return ottPost(settings, "api/v1/CheckRemitVoucher", body);
}

// Friendly copy for the error codes the spec defines. Unknown codes fall
// back to OTT's own message so nothing is lost when the spec evolves.
export function ottFriendlyError(
  body: Record<string, unknown>,
  fallback: string,
): string {
  const code = String(body.errorCode ?? "");
  const msg = typeof body.message === "string" ? body.message.trim() : "";
  switch (code) {
    case "7":
      return "This voucher has already been used.";
    case "14":
      return "A verified South African mobile number is required to redeem this voucher — verify your number in Settings and try again.";
    default:
      return msg || fallback;
  }
}
