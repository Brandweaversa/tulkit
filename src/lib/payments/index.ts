import { ottPaymentReady } from "@/lib/platform-settings";
import type {
  PaymentMethodDescriptor,
  PaymentMethodInfo,
} from "./types";

// The registry. Today: OTT voucher only. Tomorrow: append a descriptor for
// card payments (PayFast/Yoco), EFT, anything — the subscribe dialog and
// the admin payment-methods card render this list as-is.

export const PAYMENT_METHODS: PaymentMethodDescriptor[] = [
  {
    id: "ott_voucher",
    label: "OTT Voucher",
    logoSrc: "/ott-voucher-logo.png",
    description:
      "Buy a voucher at any retail point (Boxer, Shoprite, Usave, PEP, Spar, OK) and enter the PIN here.",
    isConfigured: (s) => ottPaymentReady(s),
  },
];

// Client-safe projection for the subscribe dialog.
export function paymentMethodInfos(
  settings: import("@/lib/platform-settings").PlatformSettingsResolved,
): PaymentMethodInfo[] {
  return PAYMENT_METHODS.map((m) => ({
    id: m.id,
    label: m.label,
    logoSrc: m.logoSrc,
    description: m.description,
    configured: m.isConfigured(settings),
  }));
}

export type { PaymentMethodDescriptor, PaymentMethodInfo } from "./types";
