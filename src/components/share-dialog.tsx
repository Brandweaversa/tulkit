"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Download,
  MessageCircle,
  Mail,
  Copy,
  Check,
  Phone,
  Info,
  Lock,
  Crown,
  Share2,
  BellRing,
  Loader2,
} from "lucide-react";
import type { BusinessProfile, InvoiceDocument } from "@/lib/types";
import { downloadInvoicePdf, invoicePdfDataUrl, invoicePdfFilename } from "@/lib/pdf";
import {
  whatsappShareUrl,
  emailShareUrl,
  whatsappReminderUrl,
  emailReminderUrl,
  buildShareMessage,
  buildShareSubject,
  buildReminderMessage,
  buildReminderSubject,
  copySummaryToClipboard,
} from "@/lib/share";
import { useStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doc: InvoiceDocument;
  canWhatsApp?: boolean;
  canEmail?: boolean;
  canDownloadPdf?: boolean;
  /** Open the dialog straight in reminder mode (used by the "Remind" button). */
  initialMode?: "share" | "reminder";
}

export function ShareDialog({
  open,
  onOpenChange,
  doc,
  canWhatsApp = true,
  canEmail = true,
  canDownloadPdf = true,
  initialMode = "share",
}: Props) {
  const business = useStore((s) => s.business);
  const authUser = useStore((s) => s.authUser);
  const markAs = useStore((s) => s.markAs);
  const [copied, setCopied] = useState(false);
  const [editedPhone, setEditedPhone] = useState(doc.clientSnapshot.phone ?? "");
  const [editedEmail, setEditedEmail] = useState(doc.clientSnapshot.email ?? "");
  const [editedMessage, setEditedMessage] = useState(
    buildShareMessage({ business, doc }),
  );
  const [editedSubject, setEditedSubject] = useState(
    buildShareSubject({ business, doc }),
  );
  const [editedReminder, setEditedReminder] = useState(
    buildReminderMessage({ business, doc }),
  );
  const [editedReminderSubject, setEditedReminderSubject] = useState(
    buildReminderSubject({ business, doc }),
  );
  const [mode, setMode] = useState<"share" | "reminder">(initialMode);
  // Pre-built PDF for the native share sheet. Null while generating.
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  // True only when this browser can hand files to the OS share sheet
  // (Android Chrome, iOS Safari, desktop Edge/Chrome/Safari). The Share PDF
  // button is hidden entirely when false.
  const [canShareFiles, setCanShareFiles] = useState(false);

  // Re-sync mode + message drafts every time the dialog opens.
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setEditedMessage(buildShareMessage({ business, doc }));
      setEditedReminder(buildReminderMessage({ business, doc }));
      setEditedSubject(buildShareSubject({ business, doc }));
      setEditedReminderSubject(buildReminderSubject({ business, doc }));
      setEditedPhone(doc.clientSnapshot.phone ?? "");
      setEditedEmail(doc.clientSnapshot.email ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode]);

  // Generate the PDF while the dialog is open so the Share button is
  // gesture-ready. Pre-generation matters on iOS: navigator.share() must run
  // inside the user gesture, so the share call can never await PDF work.
  useEffect(() => {
    if (!open) return;
    setPdfFile(null);
    setCanShareFiles(false);
    if (!canDownloadPdf) return;
    let cancelled = false;
    (async () => {
      try {
        const dataUrl = await invoicePdfDataUrl(ctx);
        if (cancelled) return;
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], invoicePdfFilename(doc), {
          type: "application/pdf",
        });
        if (cancelled) return;
        setPdfFile(file);
        setCanShareFiles(
          typeof navigator.share === "function" &&
            Boolean(navigator.canShare?.({ files: [file] })),
        );
      } catch (e) {
        console.error("Share-PDF preparation failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode]);

  // Contact overrides from the WhatsApp/Email tabs — without this, edits to
  // the phone/email fields were never actually used by the share links.
  // user feeds feature gating inside the PDF (banking_details) — without it
  // Pro users' shared PDFs silently lost their banking details.
  const pdfUser = authUser
    ? {
        role: authUser.role,
        subscriptionStatus: authUser.subscriptionStatus,
        allocatedFeatures: authUser.allocatedFeatures as unknown as string[],
      }
    : null;
  const ctx = {
    business,
    user: pdfUser,
    doc: {
      ...doc,
      clientSnapshot: {
        ...doc.clientSnapshot,
        phone: editedPhone || doc.clientSnapshot.phone,
        email: editedEmail || doc.clientSnapshot.email,
      },
    },
  } as { business: BusinessProfile; doc: InvoiceDocument; user: typeof pdfUser };

  // Reminders only make sense for invoices that are actually out.
  const reminderEligible =
    doc.type === "invoice" &&
    (doc.status === "sent" || doc.status === "viewed" || doc.status === "overdue");
  const activeMode = reminderEligible ? mode : "share";

  async function handleDownload() {
    if (!canDownloadPdf) {
      toast({
        title: "Pro feature",
        description: "PDF download requires a Pro subscription.",
        variant: "destructive",
      });
      return;
    }
    try {
      await downloadInvoicePdf(ctx);
      toast({ title: "PDF downloaded", description: `${doc.number}.pdf saved` });
      if (doc.status === "draft") markAs(doc.id, "sent");
    } catch (e) {
      console.error(e);
      toast({ title: "Could not generate PDF", variant: "destructive" });
    }
  }

  // Native share sheet: hands the actual PDF file to the OS so the user can
  // send it from any app — WhatsApp, iMessage, Telegram, Outlook, anything
  // installed. Falls back silently: the button simply isn't rendered when
  // the browser can't share files.
  async function handleSharePdf() {
    if (!canDownloadPdf) {
      toast({
        title: "Pro feature",
        description: "PDF sharing requires a Pro subscription.",
        variant: "destructive",
      });
      return;
    }
    if (!pdfFile) {
      toast({
        title: "Preparing PDF…",
        description: "One moment — then tap Share PDF again.",
      });
      return;
    }
    const text = activeMode === "reminder" ? editedReminder : editedMessage;
    const title =
      activeMode === "reminder" ? editedReminderSubject : editedSubject;
    try {
      await navigator.share({ files: [pdfFile], title, text });
      if (doc.status === "draft") markAs(doc.id, "sent");
    } catch (e) {
      // Closing the share sheet without sending is not an error.
      if ((e as DOMException)?.name === "AbortError") return;
      console.error(e);
      toast({ title: "Could not share PDF", variant: "destructive" });
    }
  }

  async function handleWhatsApp() {
    if (!canWhatsApp) {
      toast({
        title: "Pro feature",
        description: "WhatsApp sharing requires a Pro subscription.",
        variant: "destructive",
      });
      return;
    }
    // Preferred path: hand the real PDF to the OS share sheet, where the
    // user picks WhatsApp — the file arrives attached. wa.me links can only
    // carry text, so this is the only way a web page can attach a PDF.
    if (canDownloadPdf && canShareFiles) {
      if (!pdfFile) {
        toast({
          title: "Preparing PDF…",
          description: "One moment — then tap Send again.",
        });
        return;
      }
      const text = activeMode === "reminder" ? editedReminder : editedMessage;
      const title =
        activeMode === "reminder" ? editedReminderSubject : editedSubject;
      // WhatsApp drops share-sheet text when files are attached, so bridge
      // the message via the clipboard — WhatsApp offers a Paste hint in the
      // chat as soon as it opens.
      try {
        await navigator.clipboard.writeText(text);
        toast({
          title: "Message copied",
          description: "Tap Paste in WhatsApp to add it to the chat.",
        });
      } catch {
        // Clipboard unavailable — the user can still copy via "Copy summary".
      }
      try {
        await navigator.share({ files: [pdfFile], title, text });
        if (doc.status === "draft") markAs(doc.id, "sent");
      } catch (e) {
        // Closing the share sheet without sending is not an error.
        if ((e as DOMException)?.name === "AbortError") return;
        console.error(e);
        toast({ title: "Could not share PDF", variant: "destructive" });
      }
      return;
    }
    // Fallback (no file sharing available): open the chat directly. WhatsApp
    // links can't carry attachments — the user adds the PDF manually.
    const url =
      activeMode === "reminder"
        ? whatsappReminderUrl(ctx)
        : whatsappShareUrl(ctx);
    window.open(url, "_blank", "noopener,noreferrer");
    if (doc.status === "draft") markAs(doc.id, "sent");
    toast({
      title: activeMode === "reminder" ? "Opening WhatsApp" : "Opening WhatsApp",
      description:
        activeMode === "reminder"
          ? "Attach the PDF if the client has lost the original."
          : "Attach the downloaded PDF before sending.",
    });
  }

  function handleWhatsAppChatOnly() {
    if (!canWhatsApp) return;
    const url =
      activeMode === "reminder"
        ? whatsappReminderUrl(ctx)
        : whatsappShareUrl(ctx);
    window.open(url, "_blank", "noopener,noreferrer");
    if (doc.status === "draft") markAs(doc.id, "sent");
  }

  function handleEmail() {
    if (!canEmail) {
      toast({
        title: "Pro feature",
        description: "Email sharing requires a Pro subscription.",
        variant: "destructive",
      });
      return;
    }
    const url =
      activeMode === "reminder"
        ? emailReminderUrl(ctx)
        : emailShareUrl(ctx);
    window.location.href = url;
    if (doc.status === "draft") markAs(doc.id, "sent");
    toast({
      title: "Opening email client",
      description: "Attach the PDF after your email client opens.",
    });
  }

  async function handleCopy() {
    try {
      await copySummaryToClipboard(ctx);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  }

  async function handleOpenPreview() {
    if (!canDownloadPdf) {
      toast({ title: "Pro feature", description: "PDF preview requires Pro.", variant: "destructive" });
      return;
    }
    const dataUrl = await invoicePdfDataUrl(ctx);
    const w = window.open();
    if (w) {
      w.document.write(
        `<iframe src="${dataUrl}" style="border:0;width:100%;height:100vh"></iframe>`,
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {activeMode === "reminder" ? "Remind about " : "Share "}
            {doc.type === "invoice" ? "Invoice" : "Quote"} {doc.number}
          </DialogTitle>
          <DialogDescription>
            {activeMode === "reminder"
              ? "A gentle payment nudge via WhatsApp or email."
              : "Send the PDF with a pre-filled message via WhatsApp or email."}
          </DialogDescription>
        </DialogHeader>

        {/* Share / Reminder toggle — only for invoices that are out */}
        {reminderEligible && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={activeMode === "share" ? "default" : "outline"}
              onClick={() => setMode("share")}
              className={activeMode === "share" ? "bg-[#0E7C9C] hover:bg-[#0A6582] text-white" : ""}
            >
              <Share2 className="h-4 w-4 mr-2" /> Share invoice
            </Button>
            <Button
              size="sm"
              variant={activeMode === "reminder" ? "default" : "outline"}
              onClick={() => setMode("reminder")}
              className={activeMode === "reminder" ? "bg-[#0E7C9C] hover:bg-[#0A6582] text-white" : ""}
            >
              <BellRing className="h-4 w-4 mr-2" /> Send reminder
            </Button>
          </div>
        )}

        {/* Native share sheet — shown only when the browser can share files.
          Locked for free users so the upsell stays visible, like the other
          PDF features. */}
        {canDownloadPdf && canShareFiles ? (
          <Button
            onClick={handleSharePdf}
            disabled={!pdfFile}
            className="w-full bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
          >
            {pdfFile ? (
              <>
                <Share2 className="h-4 w-4 mr-2" />
                Share PDF
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Preparing PDF…
              </>
            )}
          </Button>
        ) : (
          !canDownloadPdf && (
            <Button
              onClick={handleSharePdf}
              variant="outline"
              className="w-full bg-muted text-muted-foreground"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share PDF
              <Lock className="h-3 w-3 ml-1" />
            </Button>
          )
        )}

        {/* Primary actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <FeatureButton
            onClick={handleDownload}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            icon={<Download className="h-4 w-4 mr-2" />}
            label="PDF"
            allowed={canDownloadPdf}
          />
          <FeatureButton
            onClick={handleWhatsApp}
            className="bg-[#25D366] hover:bg-[#1FB855] text-white"
            icon={<MessageCircle className="h-4 w-4 mr-2" />}
            label="WhatsApp"
            allowed={canWhatsApp}
          />
          <FeatureButton
            onClick={handleEmail}
            icon={<Mail className="h-4 w-4 mr-2" />}
            label="Email"
            allowed={canEmail}
          />
        </div>

        <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            {activeMode === "reminder" ?
              canDownloadPdf && canShareFiles
                ? "Share PDF opens your phone's share menu with the invoice attached — pick WhatsApp, email or any installed app."
                : "The reminder message opens pre-filled in WhatsApp or your email client. Attach the PDF if the client has lost the original."
              : canDownloadPdf && canShareFiles
                ? "Share PDF opens your phone's share menu with the document attached — pick WhatsApp, email or any installed app."
                : "Download the PDF first, then share via WhatsApp or email. Your message will be pre-filled — just attach the PDF."}
          </div>
        </div>

        <Tabs defaultValue="message">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="message">Message</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>

          <TabsContent value="message" className="space-y-2 mt-3">
            <Label>{activeMode === "reminder" ? "Reminder message" : "Pre-filled message"}</Label>
            <Textarea
              value={activeMode === "reminder" ? editedReminder : editedMessage}
              onChange={(e) =>
                activeMode === "reminder"
                  ? setEditedReminder(e.target.value)
                  : setEditedMessage(e.target.value)
              }
              rows={7}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copied" : "Copy summary"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenPreview}>
                Preview PDF in new tab
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-2 mt-3">
            {!canWhatsApp ? (
              <LockedNotice feature="WhatsApp sharing" />
            ) : (
              <>
                {canDownloadPdf && canShareFiles ? (
                  <>
                    <Button
                      onClick={handleWhatsApp}
                      className="bg-[#25D366] hover:bg-[#1FB855] text-white w-full"
                    >
                      {pdfFile ? (
                        <>
                          <Share2 className="h-4 w-4 mr-2" /> Send via WhatsApp — PDF attached
                        </>
                      ) : (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Preparing PDF…
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleWhatsAppChatOnly}
                      className="w-full"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" /> Open chat without PDF
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      The share sheet opens with the PDF attached and your
                      message copied — pick WhatsApp, then the client&apos;s
                      chat, and tap <strong>Paste</strong> to add the message
                      (WhatsApp can&apos;t receive text through the share
                      sheet, only files). &ldquo;Open chat without PDF&rdquo;
                      jumps straight to {editedPhone || "the client"} with the
                      message pre-filled instead, but then you attach the PDF
                      by hand.
                    </p>
                  </>
                ) : (
                  <>
                    <Label>Send to (client phone)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={editedPhone}
                        onChange={(e) => setEditedPhone(e.target.value)}
                        placeholder="+27 82 555 0101"
                      />
                      <Button onClick={handleWhatsApp} className="bg-[#25D366] hover:bg-[#1FB855] text-white shrink-0">
                        <Phone className="h-4 w-4 mr-2" /> Open WhatsApp
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Format: international with country code. Local 0XX numbers auto-convert to +27.
                    </p>
                  </>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="email" className="space-y-2 mt-3">
            {!canEmail ? (
              <LockedNotice feature="Email sharing" />
            ) : (
              <>
                <Label>Send to (client email)</Label>
                <Input
                  type="email"
                  value={editedEmail}
                  onChange={(e) => setEditedEmail(e.target.value)}
                  placeholder="client@example.com"
                />
                <Label>Subject</Label>
                <Input
                  value={activeMode === "reminder" ? editedReminderSubject : editedSubject}
                  onChange={(e) =>
                    activeMode === "reminder"
                      ? setEditedReminderSubject(e.target.value)
                      : setEditedSubject(e.target.value)
                  }
                />
                <Button onClick={handleEmail} className="w-full">
                  <Mail className="h-4 w-4 mr-2" /> Open email client
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="text-xs text-muted-foreground">
          {activeMode === "reminder"
            ? "Reminders are never tracked — send as many as you like."
            : `Sharing marks this ${doc.type} as \u201cSent\u201d if it\u2019s still a draft.`}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeatureButton({
  onClick,
  className,
  icon,
  label,
  allowed,
}: {
  onClick: () => void;
  className?: string;
  icon: React.ReactNode;
  label: string;
  allowed: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      className={allowed ? className : "bg-muted text-muted-foreground"}
      variant={allowed ? "default" : "outline"}
    >
      {icon}
      {label}
      {!allowed && <Lock className="h-3 w-3 ml-1" />}
    </Button>
  );
}

function LockedNotice({ feature }: { feature: string }) {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-center">
      <Crown className="h-6 w-6 text-amber-500 mx-auto mb-2" />
      <p className="text-sm font-semibold text-amber-800">
        {feature} is a Pro feature
      </p>
      <p className="text-xs text-amber-700 mt-1">
        Upgrade to Pro (R99 / 30 days) to unlock this feature.
      </p>
    </div>
  );
}
