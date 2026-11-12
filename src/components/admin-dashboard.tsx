"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Users,
  Crown,
  Clock,
  TrendingUp,
  UserCheck,
  UserX,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { FEATURE_KEYS, FEATURE_LABELS, FREE_TIER_LIMITS } from "@/lib/types";
import type { FeatureKey } from "@/lib/types";

interface AdminUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  subscriptionStatus: string;
  subscriptionExpiresAt?: string;
  subscriptionActivatedAt?: string;
  allocatedFeatures: FeatureKey[];
  daysRemaining: number;
  createdAt: string;
}

// Payload returned by GET /api/admin/users/[id]
interface UserDetail {
  user: {
    id: string;
    userId: string;
    name: string;
    email: string | null;
    role: string;
    createdAt: string;
  };
  subscription: {
    status: string;
    activatedAt: string | null;
    expiresAt: string | null;
    trialExpiresAt: string | null;
    daysRemaining: number;
    allocatedFeatures: FeatureKey[];
  };
  usage: {
    clientCount: number;
    totalDocuments: number;
    invoices: number;
    quotes: number;
    byStatus: Record<string, number>;
    documentsLast30Days: number;
    lastDocumentAt: string | null;
    lastSentAt: string | null;
    lastPaidAt: string | null;
    estimatedSpendRands: number;
  };
  profile: {
    hasLogo: boolean;
    hasAddress: boolean;
    hasVatNumber: boolean;
    hasBanking: boolean;
    hasPhone: boolean;
    completenessScore: number;
  };
  flags: string[];
}

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  freeUsers: number;
  totalDocuments: number;
  totalClients: number;
  recentActivations: number;
  estimatedMonthlyRevenue: number;
}

export function AdminDashboard() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribeUser, setSubscribeUser] = useState<AdminUser | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  async function loadData() {
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/stats"),
      ]);
      const usersData = await usersRes.json();
      const statsData = await statsRes.json();
      setUsers(usersData.users ?? []);
      setStats(statsData);
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to load admin data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubscribe(
    userId: string,
    durationDays: number,
    features: FeatureKey[],
  ) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationDays, features }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast({
        title: "Subscription activated",
        description: `User has ${durationDays} days of Pro access.`,
      });
      setSubscribeUser(null);
      loadData();
    } catch (e) {
      toast({
        title: "Failed to activate subscription",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleRevoke(userId: string) {
    if (!confirm("Revoke this user's subscription?")) return;
    try {
      await fetch(`/api/admin/users/${userId}/subscribe`, { method: "DELETE" });
      toast({ title: "Subscription revoked" });
      loadData();
    } catch {
      toast({ title: "Failed to revoke", variant: "destructive" });
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    const confirmed = confirm(
      `Delete ${user.email}?\n\nThis permanently removes:\n- Their account\n- All their clients\n- All their invoices & quotes\n\nThis cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete user");
      }
      toast({
        title: "User deleted",
        description: `${user.email} and all their data have been removed.`,
      });
      loadData();
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading admin dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage users, activate subscriptions, and track revenue.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={<Users className="h-4 w-4" />} label="Total users" value={String(stats.totalUsers)} />
          <StatCard icon={<Crown className="h-4 w-4" />} label="Active subscriptions" value={String(stats.activeSubscriptions)} tone="emerald" />
          <StatCard icon={<Clock className="h-4 w-4" />} label="Expired" value={String(stats.expiredSubscriptions)} tone="amber" />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Est. monthly revenue"
            value={`R${stats.estimatedMonthlyRevenue}`}
            sub={`R99 × ${stats.activeSubscriptions} active`}
            tone="emerald"
          />
        </div>
      )}

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No users yet. Share your Tulkit URL to get signups!
            </div>
          ) : (
            <div className="divide-y">
              {users.map((u) => (
                <div key={u.id}>
                  <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{u.name || u.email || "Unknown"}</span>
                        {u.role === "admin" && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                            <Crown className="h-3 w-3 mr-1" /> Admin
                          </Badge>
                        )}
                        <StatusBadge status={u.subscriptionStatus} days={u.daysRemaining} />
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {u.email} · joined {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetailUserId((prev) => (prev === u.id ? null : u.id))}
                        title="View usage details"
                      >
                        {detailUserId === u.id ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {u.role !== "admin" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setSubscribeUser(u)}>
                            {u.subscriptionStatus === "active" ? "Extend" : "Activate"}
                          </Button>
                          {u.subscriptionStatus === "active" && (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleRevoke(u.id)}>
                              Revoke
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => handleDeleteUser(u)}
                            title="Delete user permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {detailUserId === u.id && <UserDetailPanel userId={u.id} />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscribe dialog */}
      {subscribeUser && (
        <SubscribeDialog
          user={subscribeUser}
          onSubscribe={(days, features) => handleSubscribe(subscribeUser.id, days, features)}
          onClose={() => setSubscribeUser(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "emerald" | "amber" | "red" | "neutral";
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  }[tone];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={`w-7 h-7 rounded-md flex items-center justify-center ${toneClass}`}>
            {icon}
          </span>
        </div>
        <div className="text-xl font-bold mt-2">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, days }: { status: string; days: number }) {
  if (status === "trial") {
    return (
      <Badge variant="secondary" className="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
        <Sparkles className="h-3 w-3 mr-1" /> Trial · {days}d left
      </Badge>
    );
  }
  if (status === "active") {
    return (
      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <Crown className="h-3 w-3 mr-1" /> Pro · {days}d left
      </Badge>
    );
  }
  if (status === "expired") {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        Expired
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      Free
    </Badge>
  );
}

function SubscribeDialog({
  user,
  onSubscribe,
  onClose,
}: {
  user: AdminUser;
  onSubscribe: (days: number, features: FeatureKey[]) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState(30);
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureKey[]>(
    user.allocatedFeatures.length > 0 ? user.allocatedFeatures : [...FEATURE_KEYS],
  );

  function toggleFeature(f: FeatureKey) {
    setSelectedFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activate subscription</DialogTitle>
          <DialogDescription>
            Mark <strong>{user.email}</strong> as paid. This REPLACES any existing subscription (no accumulation).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Duration (days)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 30)}
            />
            <p className="text-xs text-muted-foreground">Default: 30 days. R99 recommended.</p>
          </div>

          <div className="space-y-2">
            <Label>Features to allocate</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto rounded-md border p-3">
              {FEATURE_KEYS.map((f) => (
                <div key={f} className="flex items-center space-x-2">
                  <Checkbox
                    id={`feat-${f}`}
                    checked={selectedFeatures.includes(f)}
                    onCheckedChange={() => toggleFeature(f)}
                  />
                  <Label htmlFor={`feat-${f}`} className="text-sm cursor-pointer">
                    {FEATURE_LABELS[f]}
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedFeatures([...FEATURE_KEYS])}
              >
                Select all
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedFeatures([])}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSubscribe(days, selectedFeatures)}
            disabled={selectedFeatures.length === 0}
            className="bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
          >
            Activate — {days} days
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FLAG_META: Record<string, { label: string; tone: "red" | "amber" | "sky" | "neutral" }> = {
  never_used: { label: "Never created a document", tone: "neutral" },
  trial_ending_soon: { label: "Trial ending within 7 days", tone: "sky" },
  expired_with_activity: { label: "Expired but still active", tone: "red" },
  hitting_client_limit: { label: "At free client limit", tone: "amber" },
  dormant_30d: { label: "No activity in 30+ days", tone: "amber" },
};

const STATUS_ORDER = ["draft", "sent", "viewed", "paid", "overdue", "converted"] as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function UserDetailPanel({ userId }: { userId: string }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}`);
        if (!res.ok) throw new Error("Failed to load details");
        const data = (await res.json()) as UserDetail;
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error) {
    return (
      <div className="px-4 pb-4 text-xs text-destructive">
        Failed to load user details. Try again.
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="px-4 pb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading details…
      </div>
    );
  }

  const { usage, subscription, profile, flags } = detail;
  const unlimitedClients = subscription.allocatedFeatures.includes("unlimited_clients");
  const statusChips = STATUS_ORDER.filter((s) => (usage.byStatus[s] ?? 0) > 0);

  return (
    <div className="px-4 pb-5 pt-1 space-y-4 bg-muted/30">
      {/* Risk flags */}
      {flags.length > 0 ? (
        <div className="flex gap-2 flex-wrap">
          {flags.map((f) => (
            <FlagBadge key={f} flag={f} />
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No risk flags — healthy account.</div>
      )}

      {/* Usage stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <MiniStat
          label="Clients"
          value={
            unlimitedClients
              ? String(usage.clientCount)
              : `${usage.clientCount} / ${FREE_TIER_LIMITS.maxClients}`
          }
        />
        <MiniStat label="Documents" value={String(usage.totalDocuments)} />
        <MiniStat label="Invoices" value={String(usage.invoices)} />
        <MiniStat label="Quotes" value={String(usage.quotes)} />
        <MiniStat label="Last 30 days" value={String(usage.documentsLast30Days)} />
        <MiniStat label="Est. spend" value={`R${usage.estimatedSpendRands}`} />
      </div>

      {/* Document status breakdown */}
      {statusChips.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground mr-1">By status:</span>
          {statusChips.map((s) => (
            <Badge key={s} variant="outline" className="text-xs font-normal">
              {s.charAt(0).toUpperCase() + s.slice(1)}: {usage.byStatus[s]}
            </Badge>
          ))}
        </div>
      )}

      {/* Activity dates */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <DateItem label="Last document created" value={usage.lastDocumentAt} />
        <DateItem label="Last document sent" value={usage.lastSentAt} />
        <DateItem label="Last payment received" value={usage.lastPaidAt} />
        <DateItem label="Joined" value={detail.user.createdAt} />
      </div>

      {/* Subscription details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <DateItem label="Activated" value={subscription.activatedAt} />
        <DateItem label="Expires" value={subscription.expiresAt} />
        <DateItem label="Trial ends" value={subscription.trialExpiresAt} />
        <div className="rounded-md border bg-background p-2">
          <div className="text-muted-foreground">Days remaining</div>
          <div className="font-medium mt-0.5">{subscription.daysRemaining}</div>
        </div>
      </div>

      {/* Allocated features */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-xs text-muted-foreground mr-1">Features:</span>
        {subscription.allocatedFeatures.length > 0 ? (
          subscription.allocatedFeatures.map((f) => (
            <Badge key={f} variant="secondary" className="text-xs font-normal">
              {FEATURE_LABELS[f] ?? f}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">None (free tier)</span>
        )}
      </div>

      {/* Profile completeness */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-xs text-muted-foreground mr-1">
          Profile {profile.completenessScore}/5:
        </span>
        <CompletenessChip label="Logo" ok={profile.hasLogo} />
        <CompletenessChip label="Address" ok={profile.hasAddress} />
        <CompletenessChip label="VAT" ok={profile.hasVatNumber} />
        <CompletenessChip label="Banking" ok={profile.hasBanking} />
        <CompletenessChip label="Phone" ok={profile.hasPhone} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-muted-foreground text-xs truncate">{label}</div>
      <div className="font-medium text-sm mt-0.5">{value}</div>
    </div>
  );
}

function DateItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{formatDate(value)}</div>
    </div>
  );
}

function FlagBadge({ flag }: { flag: string }) {
  const meta = FLAG_META[flag] ?? { label: flag, tone: "neutral" as const };
  const toneClass = {
    red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    neutral: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  }[meta.tone];
  return (
    <Badge variant="secondary" className={`text-xs ${toneClass}`}>
      {meta.label}
    </Badge>
  );
}

function CompletenessChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge
      variant="outline"
      className={`text-xs font-normal ${ok ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}
    >
      {ok ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  );
}
