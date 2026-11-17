import { db } from "@/lib/db";
import { DEFAULT_APP_SETTINGS, type AppSettingsState } from "./types";
import { getPlatformSettings } from "./platform-settings";

const SETTINGS_ID = "app";

// Singleton settings row: reading creates it on first touch. Read failures
// fall back to all-on defaults so a DB hiccup never bricks the app.
// proPriceAmount/proDays are sourced from the PlatformSettings singleton
// (the admin's pricing card) and ride along in the same response.
export async function getAppSettings(): Promise<AppSettingsState> {
  let price = { amount: DEFAULT_APP_SETTINGS.proPriceAmount, days: DEFAULT_APP_SETTINGS.proDays };
  try {
    const platform = await getPlatformSettings();
    price = { amount: platform.subscriptionAmount, days: platform.subscriptionDays };
  } catch (e) {
    console.error("Failed to read platform settings for pricing:", e);
  }
  try {
    const row = await db.appSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
    return {
      signupOpen: row.signupOpen,
      googleSigninEnabled: row.googleSigninEnabled,
      privacyNoticeEnabled: row.privacyNoticeEnabled,
      installBannerEnabled: row.installBannerEnabled,
      poweredByVisible: row.poweredByVisible,
      whatsappShareEnabled: row.whatsappShareEnabled,
      emailShareEnabled: row.emailShareEnabled,
      pdfDownloadEnabled: row.pdfDownloadEnabled,
      proPriceAmount: price.amount,
      proDays: price.days,
    };
  } catch (e) {
    console.error("Failed to read app settings:", e);
    return { ...DEFAULT_APP_SETTINGS };
  }
}

const SETTING_KEYS = Object.keys(DEFAULT_APP_SETTINGS) as (keyof AppSettingsState)[];

// Applies only known boolean keys from the patch — unknown or non-boolean
// values in the request body are ignored.
export async function updateAppSettings(
  patch: Record<string, unknown>,
): Promise<AppSettingsState> {
  const data: Partial<Record<keyof AppSettingsState, boolean>> = {};
  for (const key of SETTING_KEYS) {
    if (typeof patch[key] === "boolean") data[key] = patch[key] as boolean;
  }
  if (Object.keys(data).length > 0) {
    await db.appSettings.upsert({
      where: { id: SETTINGS_ID },
      update: data,
      create: { id: SETTINGS_ID, ...data },
    });
  }
  return getAppSettings();
}
