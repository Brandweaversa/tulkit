import { jsPDF, GState } from "jspdf";
import autoTable from "jspdf-autotable";
import type { BusinessProfile, InvoiceDocument } from "./types";
import { computeTotals, displayWebsite, docHasTax, formatCurrency, formatDate, websiteHref } from "./format";
import { can } from "./features";

interface PdfOptions {
  business: BusinessProfile;
  doc: InvoiceDocument;
  // Auth context for feature gating (watermark if no no_watermark feature)
  user?: {
    role: string;
    subscriptionStatus: string;
    allocatedFeatures: string[];
  } | null;
  // Data URL of the Tulkit icon for the brand footer. Loaded via
  // loadTulkitIcon(); when absent a drawn badge is used instead.
  tulkitIconDataUrl?: string | null;
}

// Convert hex "#RRGGBB" -> [r, g, b]
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function generateInvoicePdf({ business, doc, user, tulkitIconDataUrl }: PdfOptions): jsPDF {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const accent = hexToRgb(business.accentColor || "#0E7C9C");
  const totals = computeTotals(doc);
  const isInvoice = doc.type === "invoice";
  const title = isInvoice ? "INVOICE" : "QUOTE";

  // Determine if we should show watermark (free users without no_watermark feature)
  const showWatermark = !can(
    user
      ? {
          role: user.role,
          subscriptionStatus: user.subscriptionStatus,
          allocatedFeatures: user.allocatedFeatures as never,
        }
      : null,
    "no_watermark",
  );

  // ----- Header band (accent colour) -----
  pdf.setFillColor(accent[0], accent[1], accent[2]);
  pdf.rect(0, 0, pageW, 6, "F");

  // ----- Business block (top-left) -----
  let y = 50;
  // Larger logo box so square brand marks get real presence (matches the
  // redesigned header band). Landscape logos stay width-capped and are
  // unaffected by the extra height.
  const logoMaxW = 140;
  const logoMaxH = 140;
  let logoH = 0;

  if (business.logoDataUrl) {
    try {
      // Detect format from data URL prefix
      const isPng = business.logoDataUrl.startsWith("data:image/png");
      const isJpeg =
        business.logoDataUrl.startsWith("data:image/jpeg") ||
        business.logoDataUrl.startsWith("data:image/jpg");
      const format = isPng ? "PNG" : isJpeg ? "JPEG" : "PNG";

      // Get image dimensions to preserve aspect ratio
      const imgDims = pdf.getImageProperties(business.logoDataUrl);
      const ratio = imgDims.width / imgDims.height;
      // Fit within logoMaxW × logoMaxH while preserving aspect ratio
      let drawW = logoMaxW;
      let drawH = drawW / ratio;
      if (drawH > logoMaxH) {
        drawH = logoMaxH;
        drawW = drawH * ratio;
      }
      pdf.addImage(business.logoDataUrl, format, margin, y, drawW, drawH);
      logoH = drawH;
    } catch {
      // ignore bad image data
    }
  }

  // ----- Header band 1: logo (top-left) + document meta (top-right) -----
  // Redesigned layout: logo and document meta share one band, then the
  // from / BILL TO blocks sit side by side in two columns. Saves vertical
  // space vs the old fully-stacked header.
  const metaX = pageW - margin;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor(accent[0], accent[1], accent[2]);
  pdf.text(title, metaX, y + 20, { align: "right" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(70, 70, 70);
  pdf.text(doc.number, metaX, y + 38, { align: "right" });

  // Issue / Due dates — right-aligned label + bold value pairs
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(120, 120, 120);
  pdf.text("Issue Date", metaX, y + 58, { align: "right" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(30, 30, 30);
  pdf.text(formatDate(doc.issueDate), metaX, y + 70, { align: "right" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(120, 120, 120);
  pdf.text(isInvoice ? "Due Date" : "Valid Until", metaX, y + 88, { align: "right" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(30, 30, 30);
  pdf.text(formatDate(doc.dueDate), metaX, y + 100, { align: "right" });
  // Height of the meta column (title at top → due-date value at bottom)
  const metaH = 100;

  // Rule closing band 1 — below whichever is taller: logo or meta
  const band1H = Math.max(logoH, metaH);
  const rule1Y = y + band1H + 14;
  pdf.setDrawColor(205, 205, 205);
  pdf.setLineWidth(1);
  pdf.line(margin, rule1Y, pageW - margin, rule1Y);

  // ----- Header band 2: from (left) | BILL TO (right) — two columns -----
  const partiesTop = rule1Y + 20;
  const dividerX = pageW / 2;
  const leftColX = margin;
  const leftColW = dividerX - margin - 22; // gap keeps text clear of the divider
  const rightColX = dividerX + 20;
  const rightColW = pageW - margin - rightColX;

  // Left column — business details (name bold, then contact lines)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(20, 20, 20);
  const bizNameLines = pdf.splitTextToSize(business.name, leftColW) as string[];
  let leftY = partiesTop;
  bizNameLines.forEach((l: string) => {
    pdf.text(l, leftColX, leftY);
    leftY += 14;
  });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(90, 90, 90);
  const bizLines = [
    business.address,
    business.email,
    business.phone,
    business.vatNumber ? `VAT: ${business.vatNumber}` : "",
  ].filter((line): line is string => Boolean(line));
  leftY += 2;
  bizLines.forEach((line) => {
    const wrapped = pdf.splitTextToSize(line, leftColW);
    wrapped.forEach((wLine: string) => {
      pdf.text(wLine, leftColX, leftY);
      leftY += 12;
    });
  });
  const leftH = leftY - partiesTop;

  // Right column — client details
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(120, 120, 120);
  pdf.text(isInvoice ? "BILL TO" : "QUOTE FOR", rightColX, partiesTop);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(20, 20, 20);
  const client = doc.clientSnapshot;
  const clientNameLines = pdf.splitTextToSize(
    client.company || client.name,
    rightColW,
  ) as string[];
  let rightY = partiesTop + 15;
  clientNameLines.forEach((l: string) => {
    pdf.text(l, rightColX, rightY);
    rightY += 14;
  });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(90, 90, 90);
  const clientWebsiteDisplay = client.website ? displayWebsite(client.website) : "";
  const clientLines = [
    client.company ? client.name : "",
    client.address,
    client.email,
    client.phone,
    clientWebsiteDisplay,
    client.vatNumber ? `VAT: ${client.vatNumber}` : "",
  ].filter((line): line is string => Boolean(line));
  rightY += 2;
  const websiteRects: { x: number; y: number; w: number }[] = [];
  clientLines.forEach((line) => {
    const wrapped = pdf.splitTextToSize(line, rightColW);
    wrapped.forEach((wLine: string) => {
      pdf.text(wLine, rightColX, rightY);
      if (line === clientWebsiteDisplay) {
        // remember where the website text sits so it can become a clickable link
        websiteRects.push({ x: rightColX, y: rightY - 8, w: pdf.getTextWidth(wLine) });
      }
      rightY += 12;
    });
  });
  const rightH = rightY - partiesTop;

  // Divider between the columns, spanning the taller of the two blocks
  const partiesH = Math.max(leftH, rightH);
  pdf.setDrawColor(210, 210, 210);
  pdf.setLineWidth(1);
  pdf.line(dividerX, partiesTop - 4, dividerX, partiesTop + partiesH + 2);

  // Website link overlay (after the divider so the rects sit on top)
  if (client.website) {
    const href = websiteHref(client.website);
    websiteRects.forEach((r) => pdf.link(r.x, r.y, r.w, 10, { url: href }));
  }

  // Rule closing band 2 — the items table starts below it
  const rule2Y = partiesTop + partiesH + 12;
  pdf.setDrawColor(205, 205, 205);
  pdf.line(margin, rule2Y, pageW - margin, rule2Y);

  // ----- Items table -----
  const tableStartY = rule2Y + 16;
  // Description column takes what's left of the content width after the four
  // fixed-width numeric columns (same result as "auto", but deterministic —
  // we need it for wrapping text inside the custom cell renderer below).
  const itemNameWidth = pageW - margin * 2 - (50 + 80 + 50 + 90);
  autoTable(pdf, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [["Description", "Qty", "Unit Price", "Disc.", "Amount"]],
    body: doc.items.map((it) => {
      const gross = it.quantity * it.unitPrice;
      const net = gross * (1 - (it.discountPercent ?? 0) / 100);
      return [
        it.description || "—",
        String(it.quantity),
        formatCurrency(it.unitPrice, business.currencySymbol),
        it.discountPercent ? `${it.discountPercent}%` : "—",
        formatCurrency(net, business.currencySymbol),
      ];
    }),
    theme: "striped",
    headStyles: {
      fillColor: [accent[0], accent[1], accent[2]],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [40, 40, 40],
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: itemNameWidth },
      1: { cellWidth: 50, halign: "right" },
      2: { cellWidth: 80, halign: "right" },
      3: { cellWidth: 50, halign: "right" },
      4: { cellWidth: 90, halign: "right" },
    },
    // Multiline item description: line 1 is the item name (bold), any further
    // lines render as a smaller grey description under it. Default autotable
    // text is skipped for this column and drawn manually so both styles can
    // live in one cell.
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const item = doc.items[data.row.index];
      const raw = (item?.description ?? "").trimEnd() || "—";
      const rawLines = raw.split("\n");
      const cell = data.cell;
      const pad = {
        left: cell.padding("left"),
        right: cell.padding("right"),
        top: cell.padding("top"),
        bottom: cell.padding("bottom"),
      };
      const innerW = itemNameWidth - pad.left - pad.right;
      const nameSize = cell.styles.fontSize;
      const descSize = Math.max(nameSize - 1.5, 8);
      pdf.setFontSize(nameSize);
      const nameLines = pdf.splitTextToSize(rawLines[0] || "—", innerW) as string[];
      pdf.setFontSize(descSize);
      const descLines =
        rawLines.length > 1
          ? (rawLines
              .slice(1)
              .flatMap((l) => pdf.splitTextToSize(l || " ", innerW)) as string[])
          : [];
      const lhName = nameSize * 1.15;
      const lhDesc = descSize * 1.15;
      const gap = descLines.length > 0 ? 3 : 0;
      const needed =
        pad.top +
        nameLines.length * lhName +
        gap +
        descLines.length * lhDesc +
        pad.bottom;
      cell.styles.minCellHeight = Math.max(cell.styles.minCellHeight || 0, needed);
      // Skip autotable's own text rendering for this cell — didDrawCell below
      // draws the name and description with their own styles instead.
      cell.text = [];
      (cell as unknown as { __itemLines?: object }).__itemLines = {
        nameLines,
        descLines,
        nameSize,
        descSize,
        lhName,
        lhDesc,
        gap,
      };
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const meta = (
        data.cell as unknown as {
          __itemLines?: {
            nameLines: string[];
            descLines: string[];
            nameSize: number;
            descSize: number;
            lhName: number;
            lhDesc: number;
            gap: number;
          };
        }
      ).__itemLines;
      if (!meta) return;
      const c = data.cell;
      const pad = {
        left: c.padding("left"),
        right: c.padding("right"),
        top: c.padding("top"),
        bottom: c.padding("bottom"),
      };
      const x = c.x + pad.left;
      // Item name — bold
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(meta.nameSize);
      pdf.setTextColor(40, 40, 40);
      meta.nameLines.forEach((line, i) => {
        pdf.text(
          line,
          x,
          c.y + pad.top + meta.nameSize * 0.8 + i * meta.lhName
        );
      });
      // Description — smaller, grey
      if (meta.descLines.length > 0) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(meta.descSize);
        pdf.setTextColor(110, 110, 110);
        const descY0 =
          c.y +
          pad.top +
          meta.nameLines.length * meta.lhName +
          meta.gap +
          meta.descSize * 0.8;
        meta.descLines.forEach((line, i) => {
          pdf.text(line, x, descY0 + i * meta.lhDesc);
        });
      }
    },
  });

  // ----- Totals -----
  // @ts-expect-error autoTable injects lastAutoTable on the doc instance
  let afterTableY: number = pdf.lastAutoTable.finalY + 18;
  const totalsX = pageW - margin - 220;
  const totalsW = 220;

  const totalRows: [string, string][] = [
    [
      doc.taxInclusive && docHasTax(doc) ? "Subtotal (incl. tax)" : "Subtotal",
      formatCurrency(totals.subtotal, business.currencySymbol),
    ],
  ];
  if (totals.globalDiscountAmount > 0) {
    totalRows.push([
      `Discount (${doc.globalDiscountPercent}%)`,
      `- ${formatCurrency(totals.globalDiscountAmount, business.currencySymbol)}`,
    ]);
  }
  // No tax rate (cleared field) — no Tax row on the PDF at all.
  if (docHasTax(doc)) {
    totalRows.push([
      `Tax (${doc.taxRate}%${doc.taxInclusive ? " incl." : ""})`,
      formatCurrency(totals.taxAmount, business.currencySymbol),
    ]);
  }

  totalRows.forEach(([label, value]) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(90, 90, 90);
    pdf.text(label, totalsX, afterTableY);
    pdf.setTextColor(40, 40, 40);
    pdf.text(value, totalsX + totalsW, afterTableY, { align: "right" });
    afterTableY += 16;
  });

  // Total band
  pdf.setFillColor(accent[0], accent[1], accent[2]);
  pdf.rect(totalsX - 8, afterTableY, totalsW + 16, 26, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  pdf.text("TOTAL", totalsX, afterTableY + 17);
  pdf.text(
    formatCurrency(totals.total, business.currencySymbol),
    totalsX + totalsW,
    afterTableY + 17,
    { align: "right" },
  );
  afterTableY += 50;

  // Deposit rows (only when a deposit percentage is set)
  if ((doc.depositPercent ?? 0) > 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(90, 90, 90);
    pdf.text(`Deposit now (${doc.depositPercent}%)`, totalsX, afterTableY);
    pdf.setTextColor(40, 40, 40);
    pdf.text(
      `- ${formatCurrency(totals.depositAmount, business.currencySymbol)}`,
      totalsX + totalsW,
      afterTableY,
      { align: "right" },
    );
    afterTableY += 16;
    pdf.setFont("helvetica", "bold");
    pdf.text("Balance due", totalsX, afterTableY);
    pdf.text(
      formatCurrency(totals.balanceDue, business.currencySymbol),
      totalsX + totalsW,
      afterTableY,
      { align: "right" },
    );
    afterTableY += 16;
  }

  // ----- Payment info (invoice only + banking_details feature) -----
  const showBanking = isInvoice && (business.bankName || business.bankAccount);
  const canShowBanking = can(
    user
      ? {
          role: user.role,
          subscriptionStatus: user.subscriptionStatus,
          allocatedFeatures: user.allocatedFeatures as never,
        }
      : null,
    "banking_details",
  );

  if (showBanking && canShowBanking) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(120, 120, 120);
    pdf.text("PAYMENT DETAILS", margin, afterTableY);
    afterTableY += 14;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    const bankLines = [
      business.bankName ? `Bank: ${business.bankName}` : "",
      business.bankAccount ? `Account: ${business.bankAccount}` : "",
      business.bankBranch ? `Branch: ${business.bankBranch}` : "",
      business.swift ? `SWIFT: ${business.swift}` : "",
    ].filter(Boolean);
    bankLines.forEach((line) => {
      pdf.text(line, margin, afterTableY);
      afterTableY += 12;
    });
    afterTableY += 8;
  }

  // ----- Payment terms + notes -----
  if (doc.paymentTerms) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text("TERMS", margin, afterTableY);
    afterTableY += 12;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(60, 60, 60);
    const wrapped = pdf.splitTextToSize(doc.paymentTerms, pageW - margin * 2);
    pdf.text(wrapped, margin, afterTableY);
    afterTableY += wrapped.length * 12 + 8;
  }

  if (doc.notes) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text("NOTES", margin, afterTableY);
    afterTableY += 12;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(60, 60, 60);
    const wrappedNotes = pdf.splitTextToSize(doc.notes, pageW - margin * 2);
    pdf.text(wrappedNotes, margin, afterTableY);
  }

  // ----- Watermark (free users) -----
  if (showWatermark) {
    pdf.saveGraphicsState();
    pdf.setGState(new GState({ opacity: 0.12 }));
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(64);
    pdf.setTextColor(150, 150, 150);
    pdf.text("FREE PLAN", pageW / 2, pageH / 2, {
      align: "center",
      angle: 45,
    });
    pdf.restoreGraphicsState();
  }

  // ----- Footer -----
  pdf.setDrawColor(220, 220, 220);
  pdf.line(margin, pageH - 44, pageW - margin, pageH - 44);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(
    `${business.name} · ${business.email ?? ""} · ${business.phone ?? ""}`,
    pageW / 2,
    pageH - 30,
    { align: "center" },
  );

  // ----- Powered by Tulkit (brand footer on every document) -----
  drawPoweredBy(pdf, pageW, pageH, tulkitIconDataUrl);

  return pdf;
}

// ---------------------------------------------------------------------------
// Tulkit brand footer
// ---------------------------------------------------------------------------

const TULKIT_URL = "https://tulkit.co.za";
const TULKIT_TEAL: [number, number, number] = [14, 124, 156]; // #0E7C9C

function drawPoweredBy(
  pdf: jsPDF,
  pageW: number,
  pageH: number,
  iconDataUrl?: string | null,
): void {
  const label = "Powered by ";
  const brand = "Tulkit";
  const iconSize = 10;
  const baseline = pageH - 13;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  const labelW = pdf.getTextWidth(label);
  pdf.setFont("helvetica", "bold");
  const brandW = pdf.getTextWidth(brand);
  const totalW = iconSize + 3 + labelW + brandW;

  let x = (pageW - totalW) / 2;
  const iconY = baseline - iconSize + 2.5;

  // Icon: the real Tulkit mark when it loaded, otherwise a drawn badge
  if (iconDataUrl) {
    try {
      pdf.addImage(iconDataUrl, "PNG", x, iconY, iconSize, iconSize);
    } catch {
      drawTulkitBadge(pdf, x, iconY, iconSize);
    }
  } else {
    drawTulkitBadge(pdf, x, iconY, iconSize);
  }
  x += iconSize + 3;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(label, x, baseline);
  x += labelW;
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(TULKIT_TEAL[0], TULKIT_TEAL[1], TULKIT_TEAL[2]);
  pdf.text(brand, x, baseline);

  // The whole strip is clickable and leads to the Tulkit website
  pdf.link((pageW - totalW) / 2, baseline - iconSize, totalW, iconSize + 3, {
    url: TULKIT_URL,
  });
}

// Vector fallback: rounded teal square with a white T
function drawTulkitBadge(pdf: jsPDF, x: number, y: number, size: number): void {
  pdf.setFillColor(TULKIT_TEAL[0], TULKIT_TEAL[1], TULKIT_TEAL[2]);
  pdf.roundedRect(x, y, size, size, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(255, 255, 255);
  pdf.text("T", x + size / 2, y + size / 2 + 2.5, { align: "center" });
}

// Fetch + cache the Tulkit icon as a data URL for the PDF footer.
// Resolves null when unavailable — callers fall back to the drawn badge.
let tulkitIconCache: string | null | undefined;
export async function loadTulkitIcon(): Promise<string | null> {
  if (tulkitIconCache !== undefined) return tulkitIconCache;
  try {
    const res = await fetch("/tulkit-icon-main.png");
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    tulkitIconCache = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    tulkitIconCache = null;
  }
  return tulkitIconCache;
}

// Shared filename for downloads and native sharing. Custom document numbers
// are user-typed, so strip characters that are illegal in file names before
// they end up on someone's disk.
export function invoicePdfFilename(doc: InvoiceDocument): string {
  const clientSlug = (doc.clientSnapshot.company || doc.clientSnapshot.name || "client")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeNumber = doc.number.replace(/[\\/:*?"<>|]+/g, "-");
  return `${doc.type === "invoice" ? "Invoice" : "Quote"}_${safeNumber}_${clientSlug}_${doc.issueDate}.pdf`;
}

export async function downloadInvoicePdf(opts: PdfOptions): Promise<void> {
  const tulkitIconDataUrl = await loadTulkitIcon();
  const pdf = generateInvoicePdf({ ...opts, tulkitIconDataUrl });
  pdf.save(invoicePdfFilename(opts.doc));
}

export async function invoicePdfDataUrl(opts: PdfOptions): Promise<string> {
  const tulkitIconDataUrl = await loadTulkitIcon();
  const pdf = generateInvoicePdf({ ...opts, tulkitIconDataUrl });
  return pdf.output("datauristring");
}
