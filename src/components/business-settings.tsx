"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCY_OPTIONS } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Upload, Trash2, Save, Check, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { can } from "@/lib/features";

export function BusinessSettings() {
  const business = useStore((s) => s.business);
  const authUser = useStore((s) => s.authUser);
  const updateBusiness = useStore((s) => s.updateBusiness);
  const saveBusiness = useStore((s) => s.saveBusiness);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = useStore((s) => s.deleteAccount);

  const isRegularUser = authUser !== null && authUser.role !== "admin";

  const userCtx = authUser
    ? {
        role: authUser.role,
        subscriptionStatus: authUser.subscriptionStatus,
        allocatedFeatures: authUser.allocatedFeatures,
      }
    : null;
  const canCustomBranding = can(userCtx, "custom_branding");

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // File size limit: 1MB
    if (file.size > 1_000_000) {
      toast({
        title: "Logo too large",
        description: "Please pick an image under 1 MB. Try compressing it at tinypng.com.",
        variant: "destructive",
      });
      return;
    }

    // Validate it's an image
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file (PNG, JPG, or WebP).",
        variant: "destructive",
      });
      return;
    }

    if (!canCustomBranding) {
      toast({
        title: "Pro feature",
        description: "Custom branding requires a Pro subscription.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      // Get image dimensions to provide guidance
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        if (width > 1000 || height > 1000) {
          toast({
            title: "Logo uploaded (large)",
            description: `Image is ${width}×${height}. For best results, use a logo under 500×500 pixels.`,
          });
        } else {
          toast({
            title: "Logo uploaded",
            description: `${width}×${height} — looks good!`,
          });
        }
      };
      img.src = String(reader.result);
      updateBusiness({ logoDataUrl: String(reader.result) });
    };
    reader.onerror = () => {
      toast({ title: "Could not read file", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveAll() {
    setSaving(true);
    setSaved(false);
    try {
      await saveBusiness();
      setSaved(true);
      toast({ title: "Settings saved!", description: "Your business profile is updated." });
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
      toast({
        title: "Account deleted",
        description:
          "Your account and all associated data have been permanently deleted.",
      });
    } catch (e) {
      toast({
        title: "Could not delete account",
        description:
          e instanceof Error ? e.message : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl w-full mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <CardDescription>
            This appears on every invoice and quote you create.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Business name" required>
              <Input
                value={business.name}
                onChange={(e) => updateBusiness({ name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={business.email ?? ""}
                onChange={(e) => updateBusiness({ email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={business.phone ?? ""}
                onChange={(e) => updateBusiness({ phone: e.target.value })}
              />
            </Field>
            <Field label="VAT / Tax number">
              <Input
                value={business.vatNumber ?? ""}
                onChange={(e) => updateBusiness({ vatNumber: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Address">
            <Textarea
              rows={2}
              value={business.address ?? ""}
              onChange={(e) => updateBusiness({ address: e.target.value })}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding {canCustomBranding ? "" : "(Pro feature)"}</CardTitle>
          <CardDescription>
            Logo and accent colour used on the PDF.
            {!canCustomBranding && " Upgrade to Pro to upload your own logo and change branding."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
              {business.logoDataUrl ? (
                <img
                  src={business.logoDataUrl}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs text-muted-foreground">No logo</span>
              )}
            </div>
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={!canCustomBranding}
              >
                <Upload className="h-4 w-4 mr-2" /> Upload logo
              </Button>
              {business.logoDataUrl && canCustomBranding && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => updateBusiness({ logoDataUrl: undefined })}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Remove
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogoChange}
              />
              <p className="text-xs text-muted-foreground">
                PNG, JPG, or WebP. Max 1 MB. Recommended: square, under 500×500 px.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Accent colour">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={business.accentColor}
                  onChange={(e) => updateBusiness({ accentColor: e.target.value })}
                  className="h-10 w-14 rounded border cursor-pointer"
                />
                <Input
                  value={business.accentColor}
                  onChange={(e) => updateBusiness({ accentColor: e.target.value })}
                />
              </div>
            </Field>
            <Field label="Currency">
              <Select
                value={business.currency}
                onValueChange={(v) => updateBusiness({ currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Numbering</CardTitle>
          <CardDescription>
            Sequential numbering keeps invoices audit-safe and SARS-friendly.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="Invoice prefix">
            <Input
              value={business.invoicePrefix}
              onChange={(e) => updateBusiness({ invoicePrefix: e.target.value })}
            />
          </Field>
          <Field label="Next invoice number">
            <Input
              type="number"
              min={1}
              value={business.nextInvoiceNumber}
              onChange={(e) =>
                updateBusiness({ nextInvoiceNumber: Number(e.target.value) || 1 })
              }
            />
          </Field>
          <Field label="Quote prefix">
            <Input
              value={business.quotePrefix}
              onChange={(e) => updateBusiness({ quotePrefix: e.target.value })}
            />
          </Field>
          <Field label="Next quote number">
            <Input
              type="number"
              min={1}
              value={business.nextQuoteNumber}
              onChange={(e) =>
                updateBusiness({ nextQuoteNumber: Number(e.target.value) || 1 })
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>Pre-filled when you create a new document.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Default tax rate (%)">
              <Input
                type="number"
                step="0.01"
                value={business.defaultTaxRate}
                onChange={(e) =>
                  updateBusiness({ defaultTaxRate: Number(e.target.value) || 0 })
                }
              />
            </Field>
          </div>
          <Field label="Default payment terms">
            <Textarea
              rows={2}
              value={business.defaultPaymentTerms}
              onChange={(e) =>
                updateBusiness({ defaultPaymentTerms: e.target.value })
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banking details</CardTitle>
          <CardDescription>Shown on invoices for client payment.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="Bank name">
            <Input
              value={business.bankName ?? ""}
              onChange={(e) => updateBusiness({ bankName: e.target.value })}
            />
          </Field>
          <Field label="Account number">
            <Input
              value={business.bankAccount ?? ""}
              onChange={(e) => updateBusiness({ bankAccount: e.target.value })}
            />
          </Field>
          <Field label="Branch code">
            <Input
              value={business.bankBranch ?? ""}
              onChange={(e) => updateBusiness({ bankBranch: e.target.value })}
            />
          </Field>
          <Field label="SWIFT (international)">
            <Input
              value={business.swift ?? ""}
              onChange={(e) => updateBusiness({ swift: e.target.value })}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="sticky bottom-4 flex justify-end">
        <Button
          onClick={handleSaveAll}
          disabled={saving}
          size="lg"
          className="bg-[#0E7C9C] hover:bg-[#0A6582] text-white shadow-lg"
        >
          {saving ? (
            <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
          ) : saved ? (
            <><Check className="h-4 w-4 mr-2" /> Saved!</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Save all settings</>
          )}
        </Button>
      </div>

      {/* Danger zone — self-service account deletion (non-admin users only) */}
      {isRegularUser && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Danger zone
            </CardTitle>
            <CardDescription>
              Irreversible actions for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-red-200 dark:border-red-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="font-semibold text-sm">Delete your account</div>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone. This will permanently delete
                  your account and all associated data.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700 text-white shrink-0"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently
                      delete your account and all associated data — including
                      all invoices, quotes, clients, and your business
                      profile. Your login will also be removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deleting}
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteAccount();
                      }}
                    >
                      {deleting ? "Deleting..." : "Yes, delete everything"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
