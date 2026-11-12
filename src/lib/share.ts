import type { BusinessProfile, InvoiceDocument } from "./types";
import { computeTotals, formatCurrency, formatDate, phoneForWa, todayISO } from "./format";

interface ShareContext {
  business: BusinessProfile;
  doc: InvoiceDocument;
}

function friendlyDocType(doc: InvoiceDocument): string {
  return doc.type === "invoice" ? "invoice" : "quote";
}

// Build a friendly, WhatsApp-style message that includes the doc number,
// amount and due date. This is what gets pre-filled into WhatsApp / email body.
export function buildShareMessage({ business, doc }: ShareContext): string {
  const totals = computeTotals(doc);
  const isInvoice = doc.type === "invoice";
  const label = isInvoice ? "Invoice" : "Quote";
  const clientName = doc.clientSnapshot.company || doc.clientSnapshot.name;

  // With a deposit, tell the client what to pay NOW, not just the total.
  const amountLines: string[] = [
    `Amount: ${formatCurrency(totals.total, business.currencySymbol)}`,
  ];
  if (totals.depositAmount > 0) {
    amountLines.push(
      `Pay now (${doc.depositPercent}% deposit): ${formatCurrency(totals.depositAmount, business.currencySymbol)}`,
      `Balance: ${formatCurrency(totals.balanceDue, business.currencySymbol)}`,
    );
  }

  const lines = [
    `Hi ${clientName},`,
    "",
    `Here is your ${label.toLowerCase()} ${doc.number} from ${business.name}.`,
    ...amountLines,
    isInvoice
      ? `Due: ${formatDate(doc.dueDate)}`
      : `Valid until: ${formatDate(doc.dueDate)}`,
    "",
    "Thank you for your business!",
    `- ${business.name}`,
  ];

  return lines.join("\n");
}

// Build a short subject line for email.
export function buildShareSubject({ business, doc }: ShareContext): string {
  const label = doc.type === "invoice" ? "Invoice" : "Quote";
  const totals = computeTotals(doc);
  return `${label} ${doc.number} from ${business.name} — ${formatCurrency(
    totals.total,
    business.currencySymbol,
  )}`;
}

// WhatsApp deep link using wa.me — opens WhatsApp with the message pre-filled.
// If the client has no phone number, returns the web.whatsapp.com send URL
// without a recipient (the user picks the contact in WhatsApp).
function waUrl(phone: string, message: string): string {
  const text = encodeURIComponent(message);
  const p = phoneForWa(phone);
  if (p) {
    return `https://wa.me/${p}?text=${text}`;
  }
  // No phone — let the user pick the chat
  return `https://wa.me/?text=${text}`;
}

export function whatsappShareUrl({ business, doc }: ShareContext): string {
  return waUrl(doc.clientSnapshot.phone ?? "", buildShareMessage({ business, doc }));
}

// Mailto URL — works without any backend or API key. Opens the user's email
// client with subject + body pre-filled. The PDF must be attached manually
// after the email client opens (browsers cannot attach files to mailto for
// security reasons). We make this very clear in the UI.
export function emailShareUrl({ business, doc }: ShareContext): string {
  const subject = encodeURIComponent(buildShareSubject({ business, doc }));
  const body = encodeURIComponent(buildShareMessage({ business, doc }));
  const to = doc.clientSnapshot.email || "";
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

// ---------------------------------------------------------------------------
// Reminders — gentle payment nudges for invoices that are out or overdue.
// Same channels as sharing (WhatsApp / mailto), different message.
// ---------------------------------------------------------------------------

export function buildReminderMessage({ business, doc }: ShareContext): string {
  const totals = computeTotals(doc);
  const clientName = doc.clientSnapshot.company || doc.clientSnapshot.name;
  const overdue = Boolean(doc.dueDate) && doc.dueDate < todayISO();

  const lines = [
    `Hi ${clientName},`,
    "",
    `Just a friendly reminder about invoice ${doc.number} for ${formatCurrency(
      totals.total,
      business.currencySymbol,
    )}.`,
    overdue
      ? `It was due on ${formatDate(doc.dueDate)} — if it's already been paid, please ignore this message.`
      : `It's due on ${formatDate(doc.dueDate)} — if it's already been paid, please ignore this message.`,
    "",
    "Otherwise, could you let me know when I can expect payment?",
    "",
    "Thank you for your business!",
    `- ${business.name}`,
  ];

  return lines.join("\n");
}

export function buildReminderSubject({ business, doc }: ShareContext): string {
  const totals = computeTotals(doc);
  return `Reminder: Invoice ${doc.number} — ${formatCurrency(
    totals.total,
    business.currencySymbol,
  )}`;
}

export function whatsappReminderUrl(ctx: ShareContext): string {
  return waUrl(ctx.doc.clientSnapshot.phone ?? "", buildReminderMessage(ctx));
}

export function emailReminderUrl(ctx: ShareContext): string {
  const subject = encodeURIComponent(buildReminderSubject(ctx));
  const body = encodeURIComponent(buildReminderMessage(ctx));
  const to = ctx.doc.clientSnapshot.email || "";
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

// Copy a plain-text summary of the invoice to the clipboard (fallback when
// WhatsApp/email clients aren't installed).
export async function copySummaryToClipboard({
  business,
  doc,
}: ShareContext): Promise<void> {
  const totals = computeTotals(doc);
  const isInvoice = doc.type === "invoice";
  const client = doc.clientSnapshot;

  const lines = [
    `${isInvoice ? "INVOICE" : "QUOTE"}: ${doc.number}`,
    `From: ${business.name}`,
    `To: ${client.company || client.name}`,
    `Date: ${formatDate(doc.issueDate)}`,
    isInvoice ? `Due: ${formatDate(doc.dueDate)}` : `Valid until: ${formatDate(doc.dueDate)}`,
    "",
    "Items:",
    ...doc.items.map((it) => {
      const gross = it.quantity * it.unitPrice;
      const net = gross * (1 - (it.discountPercent ?? 0) / 100);
      return `  - ${it.description || "(no description)"} × ${it.quantity} = ${formatCurrency(
        net,
        business.currencySymbol,
      )}`;
    }),
    "",
    `Subtotal: ${formatCurrency(totals.subtotal, business.currencySymbol)}`,
    totals.globalDiscountAmount > 0
      ? `Discount (${doc.globalDiscountPercent}%): -${formatCurrency(totals.globalDiscountAmount, business.currencySymbol)}`
      : "",
    `Tax (${doc.taxRate}%${doc.taxInclusive ? " incl." : ""}): ${formatCurrency(totals.taxAmount, business.currencySymbol)}`,
    `TOTAL: ${formatCurrency(totals.total, business.currencySymbol)}`,
    totals.depositAmount > 0
      ? `Deposit now (${doc.depositPercent}%): -${formatCurrency(totals.depositAmount, business.currencySymbol)}`
      : "",
    totals.depositAmount > 0
      ? `BALANCE DUE: ${formatCurrency(totals.balanceDue, business.currencySymbol)}`
      : "",
  ].filter(Boolean);

  await navigator.clipboard.writeText(lines.join("\n"));
}
