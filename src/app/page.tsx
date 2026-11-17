"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Loader2,
  Shield,
} from "lucide-react";
import { useStore, apiFetch } from "@/lib/store";
import { Dashboard } from "@/components/dashboard";
import { DocumentEditor } from "@/components/document-editor";
import { ClientsPanel } from "@/components/clients-panel";
import { BusinessSettings } from "@/components/business-settings";
import { AdminDashboard } from "@/components/admin-dashboard";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { SubscribeDialog } from "@/components/subscribe-dialog";
import { AuthForm } from "@/components/auth/auth-form";
import { PhoneVerifyGate } from "@/components/phone-verify-gate";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminNotifications } from "@/components/admin-notifications";
import { toast } from "@/hooks/use-toast";

type View = "dashboard" | "clients" | "settings" | "admin";

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [privacyNoticeOpen, setPrivacyNoticeOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const authUser = useStore((s) => s.authUser);
  const authLoading = useStore((s) => s.authLoading);
  const fetchAuthUser = useStore((s) => s.fetchAuthUser);
  const appSettings = useStore((s) => s.appSettings);
  const fetchAppSettings = useStore((s) => s.fetchAppSettings);
  const loadFromServer = useStore((s) => s.loadFromServer);
  const signOut = useStore((s) => s.signOut);
  const forcePhoneGate = useStore((s) => s.forcePhoneGate);
  const setForcePhoneGate = useStore((s) => s.setForcePhoneGate);
  const createDocument = useStore((s) => s.createDocument);

  useEffect(() => {
    fetchAuthUser();
    fetchAppSettings();
  }, [fetchAuthUser, fetchAppSettings]);

  useEffect(() => {
    if (authUser) {
      loadFromServer();
    }
  }, [authUser, loadFromServer]);

  // Show the privacy notice once per browser, right after sign-in
  // (skipped entirely when the admin turned it off in the control panel)
  useEffect(() => {
    if (!authUser) return;
    if (!appSettings.privacyNoticeEnabled) return;
    const t = setTimeout(() => {
      if (!localStorage.getItem("tulkit-privacy-notice-v1")) {
        setPrivacyNoticeOpen(true);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [authUser, appSettings.privacyNoticeEnabled]);

  function handleNewDoc(type: "invoice" | "quote") {
    createDocument(type).then((doc) => {
      if (doc) {
        setEditingDocId(doc.id);
        setView("dashboard");
      } else {
        toast({
          title: "Could not create document",
          description: "You may have hit the free tier limit. Upgrade for unlimited documents.",
          variant: "destructive",
        });
        setUpgradeOpen(true);
      }
    });
  }

  function handleOpenDoc(id: string) {
    setEditingDocId(id);
  }

  function handleBack() {
    setEditingDocId(null);
  }

  // Loading state
  if (authLoading && !authUser) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #B0E0E6 0%, #E6F2F5 50%, #F0F7FA 100%)" }}
      >
        <div className="text-center space-y-3">
          <div
            className="inline-flex items-center justify-center rounded-xl px-4 py-3"
            style={{ backgroundColor: "#B0E0E6" }}
          >
            <img src="/tulkit.png" alt="Tulkit" className="h-12 w-auto" />
          </div>
          <div className="flex items-center justify-center gap-2 text-neutral-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Tulkit...
          </div>
        </div>
      </div>
    );
  }

  // Not signed in → auth form
  if (!authUser) {
    return <AuthForm />;
  }

  const isAdmin = authUser.role === "admin";

  // Mobile verification gate — every non-admin user must verify a South
  // African mobile number before the app unlocks, unless they chose to
  // continue without verifying (outside South Africa). Admins are exempt so
  // the platform owner can never be locked out (they can verify from
  // Settings).
  if (
    !isAdmin &&
    (forcePhoneGate ||
      (!authUser.mobileVerifiedAt && !authUser.phoneGateSkippedAt))
  ) {
    return (
      <PhoneVerifyGate
        email={authUser.email}
        initialMobile={authUser.mobileNumber}
        onVerified={() => {
          setForcePhoneGate(false);
          void fetchAuthUser();
        }}
        onSkip={async () => {
          try {
            await apiFetch("/api/phone/skip", { method: "POST" });
          } catch {
            // Non-fatal — the server records the skip; user can retry.
          }
          setForcePhoneGate(false);
          void fetchAuthUser();
        }}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  }

  const navItems: { key: View; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "clients", label: "Clients", icon: <Users className="h-4 w-4" /> },
    { key: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
    { key: "admin", label: "Admin", icon: <Shield className="h-4 w-4" />, adminOnly: true },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="max-w-none w-full mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <button
            onClick={() => {
              setEditingDocId(null);
              setView("dashboard");
            }}
            className="flex items-center gap-2 min-w-0"
          >
            <span
              className="rounded-md flex items-center justify-center shrink-0 px-2 py-1"
              style={{ backgroundColor: "#B0E0E6" }}
            >
              <img src="/tulkit.png" alt="Tulkit" className="h-7 w-auto object-contain" />
            </span>
            <div className="min-w-0 hidden sm:block">
              <div className="font-bold text-sm truncate">Invoices & Quotes made easy</div>
            </div>
          </button>

          {!editingDocId && (
            <nav className="flex items-center gap-1">
              {navItems
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => (
                  <Button
                    key={item.key}
                    variant={view === item.key ? "default" : "ghost"}
                    size="sm"
                    className={
                      view === item.key
                        ? "bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
                        : ""
                    }
                    onClick={() => setView(item.key)}
                  >
                    {item.icon}
                    <span className="ml-1.5 hidden sm:inline">{item.label}</span>
                  </Button>
                ))}
              {/* Admin notifications bell */}
              {isAdmin && <AdminNotifications />}
              {/* Account menu */}
              <div className="ml-2 pl-2 border-l flex items-center gap-2">
                <div className="hidden sm:block text-right max-w-[180px]">
                  <div className="text-xs font-medium truncate">{authUser.email}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {authUser.role === "admin"
                      ? "Admin"
                      : authUser.subscriptionStatus === "active"
                        ? "Pro plan"
                        : "Free plan"}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSignOutOpen(true)}
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="ml-1.5 hidden sm:inline">Sign out</span>
                </Button>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-none w-full mx-auto px-4 py-6 space-y-4">
        {/* Subscription banner (not on admin page, not when editing) */}
        {!editingDocId && view !== "admin" && (
          <SubscriptionBanner onUpgradeClick={() => setUpgradeOpen(true)} />
        )}

        {editingDocId ? (
          <DocumentEditor docId={editingDocId} onBack={handleBack} />
        ) : view === "dashboard" ? (
          <Dashboard
            onOpenDoc={handleOpenDoc}
            onNewDoc={handleNewDoc}
            clientFilter={clientFilter}
            onClearClientFilter={() => setClientFilter(null)}
            onGoToClients={() => setView("clients")}
            onGoToSettings={() => setView("settings")}
          />
        ) : view === "clients" ? (
          <ClientsPanel
            onViewDocs={(clientId) => {
              setClientFilter(clientId);
              setView("dashboard");
            }}
          />
        ) : view === "admin" && isAdmin ? (
          <AdminDashboard />
        ) : (
          <BusinessSettings />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="max-w-none w-full mx-auto px-4 py-4 text-center space-y-2">
          <div className="text-xs text-muted-foreground">
            Tulkit · Invoices &amp; Quotes made easy
          </div>
          <nav
            aria-label="Legal"
            className="flex items-center justify-center gap-4 text-[11px]"
          >
            <Link
              href="/legal/terms"
              className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Terms &amp; Conditions
            </Link>
            <Link
              href="/legal/privacy"
              className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
          </nav>
          {appSettings.poweredByVisible && (
          <div className="text-[11px] text-muted-foreground/80">
            Tulkit is a product of BrandweaverSA (Pty) Ltd. Powered by{" "}
            <a
              href="https://brandweaver.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground/80 hover:text-foreground underline-offset-2 hover:underline"
            >
              Brandweaver
            </a>
          </div>
          )}
        </div>
      </footer>

      {/* First-time privacy notice */}
      <PrivacyNoticeDialog
        open={privacyNoticeOpen}
        onAcknowledge={() => {
          localStorage.setItem("tulkit-privacy-notice-v1", new Date().toISOString());
          setPrivacyNoticeOpen(false);
        }}
      />

      {/* Sign-out confirmation */}
      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title="Sign out of Tulkit?"
        description="You can sign back in any time."
        confirmLabel="Sign out"
        onConfirm={() => {
          signOut();
          toast({ title: "Signed out" });
        }}
      />

      {/* Subscribe / upgrade dialog — OTT voucher + cash fallback */}
      <SubscribeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onGoToSettings={() => {
          setUpgradeOpen(false);
          setView("settings");
        }}
      />
    </div>
  );
}
