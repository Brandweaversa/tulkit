import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tulkit — Invoices & Quotes Made Easy",
  description: "Tulkit helps freelancers and small businesses create invoices and quotes, generate PDFs, and share via WhatsApp or email.",
  keywords: ["Tulkit", "invoice", "quote", "PDF", "WhatsApp", "email", "freelancer", "small business", "South Africa"],
  authors: [{ name: "Brandweaver" }],
  icons: {
    icon: "/tulkit-icon-main.png",
    apple: "/tulkit-icon-main.png",
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
