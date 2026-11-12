"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Crown, Clock, AlertTriangle, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { daysRemaining } from "@/lib/features";

interface Props {
  onUpgradeClick?: () => void;
}

export function SubscriptionBanner({ onUpgradeClick }: Props) {
  const authUser = useStore((s) => s.authUser);
  const [reminderOpen, setReminderOpen] = useState(false);

  // Show trial reminder popup if 5 or fewer days remain
  useEffect(() => {
    if (!authUser) return;
    if (authUser.subscriptionStatus === "trial" && authUser.trialExpiresAt) {
      const days = daysRemaining(authUser.trialExpiresAt);
      if (days <= 5 && days > 0) {
        const key = `trial-reminder-${authUser.id}-${days}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          // Use setTimeout to avoid setState during render
          setTimeout(() => setReminderOpen(true), 100);
        }
      }
    }
  }, [authUser]);

  if (!authUser) return null;

  // Admin — no banner needed
  if (authUser.role === "admin") {
    return (
      <div className="rounded-md bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 px-4 py-2 text-sm text-purple-800 dark:text-purple-200 flex items-center gap-2">
        <Crown className="h-4 w-4" />
        Admin access — all features unlocked
      </div>
    );
  }

  // Trial active
  if (authUser.subscriptionStatus === "trial") {
    const days = daysRemaining(authUser.trialExpiresAt);
    const isUrgent = days <= 5;
    return (
      <>
        <div className={`rounded-md ${isUrgent ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200" : "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900 text-sky-800 dark:text-sky-200"} border px-4 py-2 text-sm flex items-center justify-between gap-2 flex-wrap`}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>
              Free trial — <strong>{days} days</strong> left
              {isUrgent && " ⚠️ Subscribe now to keep your features"}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setReminderOpen(true)}>
            Subscribe now
          </Button>
        </div>
        <TrialReminderDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          days={days}
          onSubscribe={() => {
            setReminderOpen(false);
            onUpgradeClick?.();
          }}
        />
      </>
    );
  }

  // Active paid subscription
  if (authUser.subscriptionStatus === "active") {
    const days = daysRemaining(authUser.subscriptionExpiresAt);
    return (
      <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4" />
          Pro plan active — {days} days remaining
        </div>
        {days <= 5 && (
          <Button size="sm" variant="outline" onClick={onUpgradeClick}>
            Renew now
          </Button>
        )}
      </div>
    );
  }

  // Expired (trial or paid)
  return (
    <>
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">Your subscription has expired</div>
              <div className="text-xs text-amber-700 dark:text-amber-300">
                Some features are now locked. Subscribe to get full access.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onUpgradeClick}
            className="bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
          >
            Subscribe — R99 / 30 days
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

function TrialReminderDialog({
  open,
  onOpenChange,
  days,
  onSubscribe,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  days: number;
  onSubscribe: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Your free trial ends in {days} {days === 1 ? "day" : "days"}
          </DialogTitle>
          <DialogDescription>
            You&apos;ve been enjoying all Pro features. Don&apos;t lose them —
            subscribe now for just R99 per 30 days.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted/50 p-4 space-y-2">
            <div className="font-semibold">What you keep with Pro:</div>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✅ Unlimited documents</li>
              <li>✅ Unlimited clients</li>
              <li>✅ PDF download (no watermark)</li>
              <li>✅ WhatsApp & Email sharing</li>
              <li>✅ Custom logo & branding</li>
              <li>✅ Convert quotes to invoices</li>
            </ul>
          </div>
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm">
            <div className="font-semibold text-amber-800 dark:text-amber-200">
              Pay with cash — R99 / 30 days
            </div>
            <div className="text-amber-700 dark:text-amber-300 text-xs mt-1">
              Contact us to pay. We&apos;ll activate your 30-day Pro access immediately.
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button
            className="bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
            onClick={onSubscribe}
          >
            <Crown className="h-4 w-4 mr-1" /> Subscribe now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
