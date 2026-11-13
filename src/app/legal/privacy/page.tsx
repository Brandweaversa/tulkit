import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Tulkit",
  description:
    "Privacy Policy for Tulkit, a product of BrandweaverSA (Pty) Ltd.",
};

const sections: { title: string; paragraphs: string[] }[] = [
  {
    title: "1. Who we are",
    paragraphs: [
      "Tulkit (\"the Service\") is a product of BrandweaverSA (Pty) Ltd (\"BrandweaverSA\", \"we\", \"us\", or \"our\"), a company registered in South Africa. We are the responsible party for the personal information processed through the Service, as described in this Privacy Policy.",
      "We handle personal information in accordance with the Protection of Personal Information Act, 2013 (\"POPIA\") and other applicable South African law.",
    ],
  },
  {
    title: "2. Our data privacy promise",
    paragraphs: [
      "Your business records belong to you. Our staff can never view your invoices, quotes, clients, banking details, or business profile at any time. The Service is built so that this data is accessible only to your own account when you sign in.",
      "We do not read, analyse, mine, or share the content of your documents for marketing, profiling, or any other purpose. This is a deliberate best-practice commitment, not just a technical detail.",
    ],
  },
  {
    title: "3. What information we collect",
    paragraphs: [
      "Account information: your email address and a hashed password, used to create and secure your account.",
      "Your business content: the information you enter while using the Service — your business profile, clients, invoices, quotes, and line items. This is stored for you and is not visible to our staff.",
      "Operational records: minimal records needed to run the Service, such as the date your account was created and, where applicable, the status of your subscription. If you are a paying subscriber, we keep a record of subscription activations performed by our administrators.",
    ],
  },
  {
    title: "4. How your information is stored and secured",
    paragraphs: [
      "Your data is stored in a managed cloud database (Supabase / PostgreSQL) and the Service is hosted on managed infrastructure (Vercel). Both use encryption in transit (TLS).",
      "Access to production systems is restricted to what is strictly necessary to operate the Service. Your document and client content is never displayed to our team in the normal course of operations.",
      "We apply reasonable technical and organisational measures to protect personal information against loss, unauthorised access, or disclosure. No system is perfectly secure, and we cannot guarantee absolute security.",
    ],
  },
  {
    title: "5. Cookies",
    paragraphs: [
      "The Service uses a single strictly necessary session cookie to keep you signed in. We do not use advertising, tracking, or analytics cookies.",
    ],
  },
  {
    title: "6. Sharing of information",
    paragraphs: [
      "We do not sell your personal information, and we do not share your business content with anyone.",
      "We rely on a small number of service providers to operate the Service (currently Supabase for authentication and database hosting, and Vercel for application hosting). These providers process data on our behalf under their own privacy and security obligations.",
      "We may disclose information where required by law, court order, or to protect our legal rights.",
    ],
  },
  {
    title: "7. Your rights under POPIA",
    paragraphs: [
      "You have the right to access the personal information we hold about you, to request correction of inaccurate information, to request deletion, to object to processing, and to lodge a complaint with the Information Regulator of South Africa.",
      "You can exercise most of these rights yourself inside the Service: view and edit your details in Settings, download your documents at any time, and permanently delete your account and all associated data via Settings \u2192 \u201CDelete your account\u201D.",
      "For anything else, contact us using the details in section 10.",
    ],
  },
  {
    title: "8. Retention and deletion",
    paragraphs: [
      "We keep your information for as long as your account is active. When you delete your account, your profile, clients, documents, and line items are permanently deleted and cannot be recovered.",
      "Basic operational records (for example, audit entries recording administrative subscription actions) may be retained where needed for legal, accounting, or security purposes.",
    ],
  },
  {
    title: "9. Changes to this policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. The latest version is always available on this page. Material changes will be highlighted in the Service.",
    ],
  },
  {
    title: "10. Contact",
    paragraphs: [
      "Privacy questions, requests, or complaints can be sent to us using the contact options shown in the app or through our website at brandweaver.co.za.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-muted/20">
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-[#0E7C9C] hover:underline font-medium"
          >
            &larr; Back to Tulkit
          </Link>
        </div>

        <div className="bg-background rounded-xl border shadow-sm p-6 sm:p-10 space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">
              Tulkit is a product of <strong>BrandweaverSA (Pty) Ltd</strong>.
              Last updated: November 2025.
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
            <strong>In short:</strong> our team can never view your invoices,
            quotes, clients, or business data at any time. Your records are
            yours alone, stored securely, and you can delete everything
            yourself at any time in Settings.
          </div>

          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.paragraphs.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-foreground/90">
                  {p}
                </p>
              ))}
            </section>
          ))}

          <div className="border-t pt-6 text-xs text-muted-foreground">
            Tulkit is a product of BrandweaverSA (Pty) Ltd. See also our{" "}
            <Link href="/legal/terms" className="text-[#0E7C9C] hover:underline font-medium">
              Terms &amp; Conditions
            </Link>
            .
          </div>
        </div>
      </main>
    </div>
  );
}
