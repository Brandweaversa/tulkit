import { db } from "@/lib/db";

// Platform settings service — the server-side source of truth for OTT and
// SMSPortal credentials plus subscription pricing.
//
// Precedence (mirrors the WordPress pattern where wp-config constants
// overrode the options table):
//   1. environment variable  (OTT_USERNAME, SMSPORTAL_CLIENT_SECRET, ...)
//   2. database row          (admin panel → Platform settings card)
//   3. hard default          (below)
//
// Secrets are NEVER returned to the client — the admin UI receives
// has* booleans and saves with "leave blank to keep" semantics.

const SETTINGS_ID = "app";

export interface PlatformSettingsResolved {
  ottMode: "test" | "live";
  ottTestBaseUrl: string;
  ottLiveBaseUrl: string;
  ottVendorId: string;
  ottAccount: string;
  ottUsername: string;
  ottPassword: string;
  ottApiKey: string;
  ottTimeoutSeconds: number;
  smsPortalClientId: string;
  smsPortalClientSecret: string;
  subscriptionAmount: number;
  subscriptionDays: number;
}

const DEFAULTS: PlatformSettingsResolved = {
  ottMode: "test",
  ottTestBaseUrl: "https://test-api.ott-mobile.com",
  ottLiveBaseUrl: "https://api.ott-mobile.com",
  ottVendorId: "11",
  ottAccount: "",
  ottUsername: "",
  ottPassword: "",
  ottApiKey: "",
  ottTimeoutSeconds: 45,
  smsPortalClientId: "",
  smsPortalClientSecret: "",
  subscriptionAmount: 100,
  subscriptionDays: 30,
};

type EnvOverride = Partial<Record<keyof PlatformSettingsResolved, string>>;

function envOverrides(): EnvOverride {
  const env: EnvOverride = {};
  const pick = (key: keyof PlatformSettingsResolved, name: string) => {
    const v = process.env[name];
    if (v !== undefined && v.trim() !== "") env[key] = v.trim();
  };
  pick("ottMode", "OTT_MODE");
  pick("ottTestBaseUrl", "OTT_TEST_BASE_URL");
  pick("ottLiveBaseUrl", "OTT_LIVE_BASE_URL");
  pick("ottVendorId", "OTT_VENDOR_ID");
  pick("ottAccount", "OTT_ACCOUNT");
  pick("ottUsername", "OTT_USERNAME");
  pick("ottPassword", "OTT_PASSWORD");
  pick("ottApiKey", "OTT_API_KEY");
  pick("smsPortalClientId", "SMSPORTAL_CLIENT_ID");
  pick("smsPortalClientSecret", "SMSPORTAL_CLIENT_SECRET");
  pick("subscriptionAmount", "SUBSCRIPTION_AMOUNT");
  pick("subscriptionDays", "SUBSCRIPTION_DAYS");
  return env;
}

// Environment variable names for each setting — surfaced to the admin UI so
// the owner can see which fields are locked by Vercel env vars.
export const SETTING_ENV_NAMES: Partial<Record<keyof PlatformSettingsResolved, string>> = {
  ottMode: "OTT_MODE",
  ottTestBaseUrl: "OTT_TEST_BASE_URL",
  ottLiveBaseUrl: "OTT_LIVE_BASE_URL",
  ottVendorId: "OTT_VENDOR_ID",
  ottAccount: "OTT_ACCOUNT",
  ottUsername: "OTT_USERNAME",
  ottPassword: "OTT_PASSWORD",
  ottApiKey: "OTT_API_KEY",
  smsPortalClientId: "SMSPORTAL_CLIENT_ID",
  smsPortalClientSecret: "SMSPORTAL_CLIENT_SECRET",
  subscriptionAmount: "SUBSCRIPTION_AMOUNT",
  subscriptionDays: "SUBSCRIPTION_DAYS",
};

function normalizeMode(mode: string): "test" | "live" {
  return mode === "live" ? "live" : "test";
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeSettings(raw: PlatformSettingsResolved): PlatformSettingsResolved {
  return {
    ...raw,
    ottMode: normalizeMode(raw.ottMode),
    ottTimeoutSeconds: clampInt(raw.ottTimeoutSeconds, 10, 120),
    subscriptionAmount: clampInt(raw.subscriptionAmount, 1, 100000),
    subscriptionDays: clampInt(raw.subscriptionDays, 1, 365),
  };
}

// Reads the singleton row (creating it on first touch) and applies env
// overrides. A DB hiccup falls back to defaults + env so payments code can
// still decide cleanly what to report.
export async function getPlatformSettings(): Promise<PlatformSettingsResolved> {
  let dbValues: PlatformSettingsResolved = { ...DEFAULTS };
  try {
    const row = await db.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
    dbValues = {
      ottMode: normalizeMode(row.ottMode),
      ottTestBaseUrl: row.ottTestBaseUrl,
      ottLiveBaseUrl: row.ottLiveBaseUrl,
      ottVendorId: row.ottVendorId,
      ottAccount: row.ottAccount,
      ottUsername: row.ottUsername,
      ottPassword: row.ottPassword,
      ottApiKey: row.ottApiKey,
      ottTimeoutSeconds: row.ottTimeoutSeconds,
      smsPortalClientId: row.smsPortalClientId,
      smsPortalClientSecret: row.smsPortalClientSecret,
      subscriptionAmount: row.subscriptionAmount,
      subscriptionDays: row.subscriptionDays,
    };
  } catch (e) {
    console.error("Failed to read platform settings:", e);
  }
  const env = envOverrides();
  const merged = { ...dbValues } as Record<string, unknown>;
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      merged[key] =
        key === "ottTimeoutSeconds" ||
        key === "subscriptionAmount" ||
        key === "subscriptionDays"
          ? Number(value)
          : value;
    }
  }
  return normalizeSettings(merged as unknown as PlatformSettingsResolved);
}

// Client-safe view for the admin panel — booleans instead of secrets.
export interface PlatformSettingsView {
  ottMode: "test" | "live";
  ottTestBaseUrl: string;
  ottLiveBaseUrl: string;
  ottVendorId: string;
  ottAccount: string;
  ottTimeoutSeconds: number;
  subscriptionAmount: number;
  subscriptionDays: number;
  hasOttUsername: boolean;
  hasOttPassword: boolean;
  hasOttApiKey: boolean;
  hasSmsPortalClientId: boolean;
  hasSmsPortalClientSecret: boolean;
  // Fields whose value currently comes from a Vercel env var (read-only in the UI).
  envOverridden: string[];
}

export function toView(s: PlatformSettingsResolved): PlatformSettingsView {
  const env = envOverrides();
  return {
    ottMode: s.ottMode,
    ottTestBaseUrl: s.ottTestBaseUrl,
    ottLiveBaseUrl: s.ottLiveBaseUrl,
    ottVendorId: s.ottVendorId,
    ottAccount: s.ottAccount,
    ottTimeoutSeconds: s.ottTimeoutSeconds,
    subscriptionAmount: s.subscriptionAmount,
    subscriptionDays: s.subscriptionDays,
    hasOttUsername: Boolean(s.ottUsername),
    hasOttPassword: Boolean(s.ottPassword),
    hasOttApiKey: Boolean(s.ottApiKey),
    hasSmsPortalClientId: Boolean(s.smsPortalClientId),
    hasSmsPortalClientSecret: Boolean(s.smsPortalClientSecret),
    envOverridden: Object.keys(env),
  };
}

// OTT connection basics present (vendor ID + username + password). With an
// API key too, redemption can actually run.
export function ottConnectionReady(s: PlatformSettingsResolved): boolean {
  return Boolean(s.ottVendorId && s.ottUsername && s.ottPassword);
}

export function ottPaymentReady(s: PlatformSettingsResolved): boolean {
  return ottConnectionReady(s) && Boolean(s.ottApiKey) && Boolean(s.ottAccount);
}

export function smsReady(s: PlatformSettingsResolved): boolean {
  return Boolean(s.smsPortalClientId && s.smsPortalClientSecret);
}

// Applies an admin patch. Secret fields ("", undefined) mean "keep the
// stored value"; everything else is trimmed and clamped. Returns the fresh
// client-safe view.
const SECRET_KEYS = [
  "ottUsername",
  "ottPassword",
  "ottApiKey",
  "smsPortalClientId",
  "smsPortalClientSecret",
] as const;

export async function updatePlatformSettings(
  patch: Record<string, unknown>,
): Promise<PlatformSettingsView> {
  const data: Record<string, string | number> = {};

  if (patch.ottMode === "test" || patch.ottMode === "live") {
    data.ottMode = patch.ottMode;
  }
  for (const key of ["ottTestBaseUrl", "ottLiveBaseUrl", "ottVendorId", "ottAccount"] as const) {
    if (typeof patch[key] === "string") {
      const v = (patch[key] as string).trim();
      if (key === "ottTestBaseUrl" || key === "ottLiveBaseUrl") {
        if (v !== "" && !/^https:\/\/.+/i.test(v)) continue; // ignore junk URLs
      }
      data[key] = v;
    }
  }
  if (patch.ottTimeoutSeconds !== undefined && patch.ottTimeoutSeconds !== "") {
    data.ottTimeoutSeconds = clampInt(Number(patch.ottTimeoutSeconds), 10, 120);
  }
  if (patch.subscriptionAmount !== undefined && patch.subscriptionAmount !== "") {
    data.subscriptionAmount = clampInt(Number(patch.subscriptionAmount), 1, 100000);
  }
  if (patch.subscriptionDays !== undefined && patch.subscriptionDays !== "") {
    data.subscriptionDays = clampInt(Number(patch.subscriptionDays), 1, 365);
  }
  for (const key of SECRET_KEYS) {
    if (typeof patch[key] === "string") {
      const v = (patch[key] as string).trim();
      if (v !== "") data[key] = v;
    }
  }

  if (Object.keys(data).length > 0) {
    await db.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: data,
      create: { id: SETTINGS_ID, ...data },
    });
  }
  return toView(await getPlatformSettings());
}
