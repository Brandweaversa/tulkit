"use client";

import type { BusinessProfile, InvoiceDocument } from "@/lib/types";
import { computeTotals, displayWebsite, docHasTax, formatCurrency, formatDate, websiteHref } from "@/lib/format";

interface Props {
  business: BusinessProfile;
  doc: InvoiceDocument;
  showWatermark?: boolean;
}

export function InvoicePreview({ business, doc, showWatermark }: Props) {
  const totals = computeTotals(doc);
  const isInvoice = doc.type === "invoice";
  const accent = business.accentColor || "#0E7C9C";
  const client = doc.clientSnapshot;

  return (
    <div className="bg-white text-neutral-900 shadow-sm border rounded-lg overflow-hidden relative">
      {/* accent top band */}
      <div className="h-1.5" style={{ backgroundColor: accent }} />

      <div className="p-6 sm:p-8 space-y-6">
        {/* Header band 1 — logo (left) + document meta (right), mirrors the PDF header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: logo */}
          <div className="shrink-0 min-w-0">
            {business.logoDataUrl ? (
              <img
                src={business.logoDataUrl}
                alt="Logo"
                className="max-h-[140px] max-w-[140px] w-auto object-contain"
                style={{ aspectRatio: "auto" }}
              />
            ) : null}
          </div>

          {/* Right: title, number and dates — right-aligned like the PDF, with
              each date shown as a small grey label above a bold value */}
          <div className="text-left sm:text-right min-w-0">
            <div
              className="text-2xl font-bold tracking-tight"
              style={{ color: accent }}
            >
              {isInvoice ? "INVOICE" : "QUOTE"}
            </div>
            <div className="text-xs font-medium text-neutral-600 mt-0.5">
              {doc.number}
            </div>
            <div className="mt-4 space-y-2">
              <div>
                <div className="text-[10px] text-neutral-400">Issue Date</div>
                <div className="text-xs font-bold text-neutral-800">
                  {formatDate(doc.issueDate)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-400">
                  {isInvoice ? "Due Date" : "Valid Until"}
                </div>
                <div className="text-xs font-bold text-neutral-800">
                  {formatDate(doc.dueDate)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rule closing band 1 */}
        <div className="border-t border-neutral-200" />

        {/* Header band 2 — business details (left) | BILL TO / QUOTE FOR (right)
            with a vertical divider, mirrors the PDF two-column parties block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-0">
          {/* Left column: business details */}
          <div className="min-w-0 sm:pr-6">
            <div className="text-base font-bold text-neutral-900 break-words">
              {business.name}
            </div>
            <div className="text-xs text-neutral-500 space-y-1 mt-1">
              {business.address && (
                <div className="break-words whitespace-pre-wrap">{business.address}</div>
              )}
              {business.email && (
                <div className="break-words">{business.email}</div>
              )}
              {business.phone && <div>{business.phone}</div>}
              {business.vatNumber && <div>VAT: {business.vatNumber}</div>}
            </div>
          </div>

          {/* Right column: client details, divider on sm+ like the PDF */}
          <div className="min-w-0 sm:border-l sm:border-neutral-200 sm:pl-6">
            <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
              {isInvoice ? "Bill To" : "Quote For"}
            </div>
            <div className="mt-1 text-base font-bold text-neutral-900 break-words">
              {client.company || client.name}
            </div>
            <div className="text-xs text-neutral-500 space-y-1 mt-1">
              {client.company && <div className="break-words">{client.name}</div>}
              {client.address && (
                <div className="break-words whitespace-pre-wrap">{client.address}</div>
              )}
              {client.email && <div className="break-words">{client.email}</div>}
              {client.phone && <div>{client.phone}</div>}
              {client.website && (
                <div className="break-words">
                  <a
                    href={websiteHref(client.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {displayWebsite(client.website)}
                  </a>
                </div>
              )}
              {client.vatNumber && <div>VAT: {client.vatNumber}</div>}
            </div>
          </div>
        </div>

        {/* Rule closing band 2 — items table follows below */}
        <div className="border-t border-neutral-200" />

        {/* Items table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: accent, color: "white" }}>
                <th className="text-left font-semibold px-3 py-2">Description</th>
                <th className="text-right font-semibold px-3 py-2 w-12">Qty</th>
                <th className="text-right font-semibold px-3 py-2 w-24">Unit</th>
                <th className="text-right font-semibold px-3 py-2 w-16">Disc.</th>
                <th className="text-right font-semibold px-3 py-2 w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((it, i) => {
                const gross = it.quantity * it.unitPrice;
                const net = gross * (1 - (it.discountPercent ?? 0) / 100);
                const [firstLine, ...descLines] = (it.description || "").split("\n");
                return (
                  <tr
                    key={it.id}
                    className={i % 2 === 0 ? "bg-neutral-50" : "bg-white"}
                  >
                    <td className="px-3 py-2 text-neutral-700 break-words">
                      {it.description ? (
                        <>
                          <span className="font-medium text-neutral-900">
                            {firstLine}
                          </span>
                          {descLines.length > 0 && (
                            <span className="mt-0.5 block whitespace-pre-line text-xs leading-snug text-neutral-500">
                              {descLines.join("\n")}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-neutral-400 italic">(empty)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-700">
                      {it.quantity}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-700">
                      {formatCurrency(it.unitPrice, business.currencySymbol)}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-700">
                      {it.discountPercent ? `${it.discountPercent}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-neutral-900">
                      {formatCurrency(net, business.currencySymbol)}
                    </td>
                  </tr>
                );
              })}
              {doc.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-neutral-400 italic">
                    No line items yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-1.5 text-sm">
            <Row
              label={
                doc.taxInclusive && docHasTax(doc)
                  ? "Subtotal (incl. tax)"
                  : "Subtotal"
              }
              value={formatCurrency(totals.subtotal, business.currencySymbol)}
            />
            {totals.globalDiscountAmount > 0 && (
              <Row
                label={`Discount (${doc.globalDiscountPercent}%)`}
                value={`- ${formatCurrency(totals.globalDiscountAmount, business.currencySymbol)}`}
              />
            )}
            {docHasTax(doc) && (
              <Row
                label={`Tax (${doc.taxRate}%${doc.taxInclusive ? " incl." : ""})`}
                value={formatCurrency(totals.taxAmount, business.currencySymbol)}
              />
            )}
            <div
              className="flex justify-between items-center px-3 py-2 rounded mt-2 text-white font-bold"
              style={{ backgroundColor: accent }}
            >
              <span>TOTAL</span>
              <span>{formatCurrency(totals.total, business.currencySymbol)}</span>
            </div>
            {(doc.depositPercent ?? 0) > 0 && (
              <div className="space-y-1.5 pt-1">
                <Row
                  label={`Deposit now (${doc.depositPercent}%)`}
                  value={`- ${formatCurrency(totals.depositAmount, business.currencySymbol)}`}
                />
                <div className="flex justify-between font-bold text-neutral-900 border-t pt-1">
                  <span>Balance due</span>
                  <span>{formatCurrency(totals.balanceDue, business.currencySymbol)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment details + terms + notes */}
        {isInvoice && (business.bankName || business.bankAccount) && (
          <div className="text-xs border-t border-neutral-100 pt-4">
            <div className="font-semibold text-neutral-500 uppercase tracking-wider text-[10px]">
              Payment Details
            </div>
            <div className="mt-1 text-neutral-700 space-y-1">
              {business.bankName && <div>Bank: {business.bankName}</div>}
              {business.bankAccount && <div>Account: {business.bankAccount}</div>}
              {business.bankBranch && <div>Branch: {business.bankBranch}</div>}
              {business.swift && <div>SWIFT: {business.swift}</div>}
            </div>
          </div>
        )}

        {doc.paymentTerms && (
          <div className="text-xs">
            <div className="font-semibold text-neutral-500 uppercase tracking-wider text-[10px]">
              Terms
            </div>
            <div className="mt-1 text-neutral-700 break-words whitespace-pre-wrap">
              {doc.paymentTerms}
            </div>
          </div>
        )}

        {doc.notes && (
          <div className="text-xs">
            <div className="font-semibold text-neutral-500 uppercase tracking-wider text-[10px]">
              Notes
            </div>
            <div className="mt-1 text-neutral-700 break-words whitespace-pre-wrap">
              {doc.notes}
            </div>
          </div>
        )}
      </div>

      {/* Watermark overlay (free users) */}
      {showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="text-6xl font-bold text-neutral-300 opacity-20 select-none rotate-45 whitespace-nowrap"
          >
            FREE PLAN
          </div>
        </div>
      )}

      <div className="border-t px-6 py-3 text-center text-[10px] text-neutral-400 break-words">
        {business.name}
        {business.email ? ` · ${business.email}` : ""}
        {business.phone ? ` · ${business.phone}` : ""}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-neutral-600 gap-2">
      <span className="break-words">{label}</span>
      <span className="font-medium text-neutral-900 whitespace-nowrap">{value}</span>
    </div>
  );
}
