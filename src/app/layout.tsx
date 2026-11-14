import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { PwaRegister } from "@/components/pwa-register";
import { InstallBanner } from "@/components/install-banner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  // Browser chrome / splash tint — matches the PWA icon brand colour
  themeColor: "#F58634",
};

export const metadata: Metadata = {
  title: "Tulkit — Invoices & Quotes Made Easy",
  description: "Tulkit helps freelancers and small businesses create invoices and quotes, generate PDFs, and share via WhatsApp or email.",
  keywords: ["Tulkit", "invoice", "quote", "PDF", "WhatsApp", "email", "freelancer", "small business", "South Africa"],
  authors: [{ name: "Brandweaver" }],
  applicationName: "Tulkit",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Tulkit",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Tulkit — Invoices & Quotes Made Easy",
    description: "Create invoices and quotes, generate PDFs, share via WhatsApp or email. Powered by Brandweaver.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tulkit — Invoices & Quotes Made Easy",
    description: "Create invoices and quotes, generate PDFs, share via WhatsApp or email.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Capture `beforeinstallprompt` BEFORE React hydrates. On cold loads
            (e.g. a returning user landing on the login screen, service worker
            already active) the event fires during initial page load — before
            any useEffect listener exists — and is lost forever. This inline
            script runs at HTML parse time: it stashes the event on window and
            re-dispatches it, so InstallBanner can pick it up when it mounts. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){var c=function(e){e.preventDefault();window.__tulkitBip=e;try{window.dispatchEvent(new CustomEvent("tulkit:bip",{detail:e}))}catch(_){}};window.addEventListener("beforeinstallprompt",c)})();',
          }}
        />
        {children}
        <Toaster />
        <PwaRegister />
        <InstallBanner />
      </body>
    </html>
  );
}
