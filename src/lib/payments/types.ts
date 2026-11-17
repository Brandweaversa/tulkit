import type { PlatformSettingsResolved } from "@/lib/platform-settings";

// Payment method registry.
//
// Adding a future provider (card via PayFast/Yoco, EFT, crypto, ...) means
// implementing its flow and appending one descriptor to PAYMENT_METHODS in
// ./index.ts — the subscribe dialog and the admin panel render whatever
// this list contains, so no UI rewrite is needed later.

export interface PaymentMethodDescriptor {
  id: string;
  label: string;
  logoSrc?: string;
  description: string;
  // Whether the platform currently has everything needed to take this
  // payment (credentials configured, account active, ...).
  isConfigured: (s: PlatformSettingsResolved) => boolean;
  // Admin visibility switch (Platform settings → Payment methods).
  // Omitted = always visible. A hidden method disappears from the
  // subscribe screen and is rejected at the API level too.
  isVisible?: (s: PlatformSettingsResolved) => boolean;
}

// Client-safe shape sent to the subscribe dialog.
export interface PaymentMethodInfo {
  id: string;
  label: string;
  logoSrc?: string;
  description: string;
  configured: boolean;
}
