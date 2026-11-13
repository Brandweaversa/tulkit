"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck, FileText, Lock, EyeOff, Download, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onAcknowledge: () => void;
}

// Shown once to every user right after they sign in (persisted in
// localStorage under tulkit-privacy-notice-v1 so it does not nag on
// every visit). Communicates our data-privacy best practice promise
// and links to the legal pages.
export function PrivacyNoticeDialog({ open, onAcknowledge }: Props) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-emerald-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            Your data is private — and it stays that way
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            Tulkit is a product of <strong>BrandweaverSA (Pty) Ltd</strong>. Please take
            a moment to read this important notice before you continue.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <EyeOff className="h-5 w-5 text-[#0E7C9C] shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              <strong>Best practice notice:</strong> our team can{" "}
              <strong>never view your data</strong> — not your invoices, quotes,
              clients, banking details, or business profile —{" "}
              <strong>at any time</strong>. Your records belong to you alone.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-[#0E7C9C] shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              Your information is stored securely and is accessible only to your
              own account when you sign in.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 text-[#0E7C9C] shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              You can download your invoices and quotes as PDFs whenever you need
              them.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-[#0E7C9C] shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              You stay in control: you can permanently delete your account and all
              associated data yourself in <strong>Settings</strong> at any time.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          By continuing to use Tulkit you accept our{" "}
          <a
            href="/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#0E7C9C] hover:underline inline-flex items-center gap-1"
          >
            <FileText className="h-3 w-3" /> Terms &amp; Conditions
          </a>{" "}
          and{" "}
          <a
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#0E7C9C] hover:underline inline-flex items-center gap-1"
          >
            <FileText className="h-3 w-3" /> Privacy Policy
          </a>
          .
        </p>

        <DialogFooter>
          <Button
            onClick={onAcknowledge}
            className="w-full bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
          >
            I understand — continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
