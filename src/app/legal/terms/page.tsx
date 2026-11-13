import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions — Tulkit",
  description:
    "Terms and Conditions for Tulkit, a product of BrandweaverSA (Pty) Ltd.",
};

const sections: { title: string; paragraphs: string[] }[] = [
  {
    title: "1. About these terms",
    paragraphs: [
      "These Terms and Conditions (\"Terms\") govern your use of Tulkit (\"the Service\"), an online tool for creating, managing, and sharing invoices and quotes. Tulkit is a product of BrandweaverSA (Pty) Ltd (\"BrandweaverSA\", \"we\", \"us\", or \"our\"), a company registered in South Africa.",
      "By creating an account or using the Service in any way, you agree to these Terms. If you do not agree, please do not use the Service.",
      "We may update these Terms from time to time. Material changes will be communicated on the Service. Continued use after changes take effect constitutes acceptance of the updated Terms.",
    ],
  },
  {
    title: "2. Your account",
    paragraphs: [
      "To use the Service you must register an account with a valid email address and a password. You must provide accurate information and keep it up to date.",
      "You are responsible for maintaining the confidentiality of your password and for all activity that takes place under your account. Notify us immediately if you suspect unauthorised access.",
      "You must be at least 18 years old, or use the Service under the supervision and with the consent of a parent or legal guardian.",
    ],
  },
  {
    title: "3. Subscriptions and payment",
    paragraphs: [
      "The Service offers a free tier with limited functionality (for example, a maximum number of documents and clients) and a paid plan (\"Pro\") that unlocks additional features.",
      "New accounts may receive a free trial period (currently 30 days). After the trial ends, accounts revert to the free tier unless a Pro subscription is activated.",
      "Pro access is offered at R99 per 30-day period unless otherwise agreed in writing. Payment is made by arrangement with us (for example, via the contact options shown in the app). Access is activated manually by us after payment is confirmed.",
      "Subscriptions do not auto-renew and are not cumulative: each activation grants 30 days of access from the date of activation. We may change pricing before a new activation; existing active periods are not affected.",
    ],
  },
  {
    title: "4. Your content and data",
    paragraphs: [
      "You retain full ownership of all content you create in the Service, including your business profile, client details, invoices, quotes, line items, and notes (\"Your Content\").",
      "We act only as a processor and host of Your Content. Our staff do not view, read, or inspect Your Content at any time, except where strictly necessary to operate the Service, to comply with a legal obligation, or with your explicit request for support that requires it.",
      "You may export Your Content at any time (for example, by downloading PDFs of your documents) and you may permanently delete your account and all associated data from the Settings page.",
      "You are solely responsible for the accuracy of the invoices and quotes you create, including any tax (VAT) amounts, and for issuing them lawfully.",
    ],
  },
  {
    title: "5. Acceptable use",
    paragraphs: [
      "You agree not to use the Service for any unlawful purpose, including the creation of fraudulent, misleading, or fictitious invoices.",
      "You agree not to attempt to access other users' data, probe or breach the Service's security, reverse-engineer the Service, or resell access to the Service without our written permission.",
      "We may suspend or terminate accounts that violate these Terms or that we reasonably believe are being used for unlawful or abusive purposes.",
    ],
  },
  {
    title: "6. Availability and changes to the Service",
    paragraphs: [
      "We aim to keep the Service available at all times but do not guarantee uninterrupted or error-free operation. The Service is provided on an \"as is\" and \"as available\" basis.",
      "We may add, change, or remove features. Where a change materially reduces the functionality of a paid subscription, we will offer a proportionate remedy.",
    ],
  },
  {
    title: "7. Limitation of liability",
    paragraphs: [
      "To the maximum extent permitted by law, BrandweaverSA (Pty) Ltd will not be liable for any indirect, incidental, special, or consequential damages, including loss of profits, revenue, data, or business opportunities, arising from your use of the Service.",
      "Our total aggregate liability for all claims relating to the Service is limited to the amount you paid us for the Service in the 30 days immediately preceding the event giving rise to the claim.",
      "Nothing in these Terms limits liability that cannot be limited under South African law, including liability for gross negligence or intentional misconduct.",
    ],
  },
  {
    title: "8. Termination",
    paragraphs: [
      "You may stop using the Service and delete your account at any time from the Settings page. Deleting your account permanently removes your account and all associated data.",
      "We may suspend or terminate your account if you materially breach these Terms, with notice where reasonably practicable.",
    ],
  },
  {
    title: "9. Governing law",
    paragraphs: [
      "These Terms are governed by the laws of the Republic of South Africa, and the courts of South Africa have exclusive jurisdiction over any dispute arising from them.",
    ],
  },
  {
    title: "10. Contact",
    paragraphs: [
      "Questions about these Terms can be sent to us using the contact options shown in the app or through our website at brandweaver.co.za.",
    ],
  },
];

export default function TermsPage() {
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
            <h1 className="text-3xl font-bold tracking-tight">
              Terms &amp; Conditions
            </h1>
            <p className="text-sm text-muted-foreground">
              Tulkit is a product of <strong>BrandweaverSA (Pty) Ltd</strong>.
              Last updated: November 2025.
            </p>
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
            <Link href="/legal/privacy" className="text-[#0E7C9C] hover:underline font-medium">
              Privacy Policy
            </Link>
            .
          </div>
        </div>
      </main>
    </div>
  );
}
