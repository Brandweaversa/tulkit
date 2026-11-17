// Strict South African mobile number handling.
//
// Accepts the formats people actually type — 072 123 4567, +27 72 123 4567,
// 27721234567, 721234567 — and normalizes them to E.164 (+27XXXXXXXXX) or
// rejects them with a friendly message.
//
// Valid SA mobile prefixes after the country code: 60-68, 71-79, 81-85.
// Landlines (01x/02x/03x...), toll-free (080x) and other service numbers are
// rejected — we only want numbers that OTT can deliver voucher vault SMS to.

const SA_MOBILE_E164 = /^\+27(6[0-9]|7[1-9]|8[1-5])[0-9]{7}$/;

const FRIENDLY_HINT =
  "Enter a valid South African mobile number, e.g. 072 123 4567.";

export type SaMobileResult =
  | { ok: true; e164: string }
  | { ok: false; error: string };

export function normalizeSaMobile(raw: string): SaMobileResult {
  if (!raw || !raw.trim()) {
    return { ok: false, error: "Enter your mobile number." };
  }

  // Keep digits and an optional leading plus; strip spaces, dashes, brackets.
  let cleaned = raw.trim().replace(/[\s\-().]/g, "");
  const hadPlus = cleaned.startsWith("+");
  if (hadPlus) cleaned = cleaned.slice(1);
  if (!/^\d+$/.test(cleaned)) {
    return { ok: false, error: "The mobile number can only contain digits." };
  }

  let candidate: string;
  if (hadPlus && cleaned.startsWith("27")) {
    // +27721234567 — already E.164
    candidate = "+" + cleaned;
  } else if (!hadPlus && cleaned.startsWith("27") && cleaned.length === 11) {
    // 27721234567 — country code typed without the plus
    candidate = "+" + cleaned;
  } else if (!hadPlus && cleaned.startsWith("0") && cleaned.length === 10) {
    // 0721234567 — local format
    candidate = "+27" + cleaned.slice(1);
  } else if (!hadPlus && cleaned.length === 9) {
    // 721234567 — bare number without 0 or 27
    candidate = "+27" + cleaned;
  } else {
    return { ok: false, error: FRIENDLY_HINT };
  }

  if (!SA_MOBILE_E164.test(candidate)) {
    return { ok: false, error: FRIENDLY_HINT };
  }
  return { ok: true, e164: candidate };
}

// Pretty display form: +27721234567 → +27 72 123 4567
export function displaySaMobile(e164: string): string {
  const m = /^\+27(\d{2})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `+27 ${m[1]} ${m[2]} ${m[3]}`;
}
