"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, UserPlus, BadgeCheck, BadgeX } from "lucide-react";
import { apiFetch } from "@/lib/store";

const LAST_SEEN_KEY = "tulkit-admin-notifications-last-seen";

interface SignupItem {
  id: string;
  email: string;
  role: string;
  subscriptionStatus: string;
  createdAt: string;
}

interface SubEventItem {
  id: string;
  action: string;
  adminEmail: string | null;
  targetEmail: string | null;
  createdAt: string;
}

interface NotificationsData {
  signups: SignupItem[];
  subEvents: SubEventItem[];
  counts: { signups7d: number; activations7d: number; revocations7d: number };
}

// "5m ago", "3h ago", "2d ago", otherwise a short date
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function signupStatusLabel(status: string): string {
  switch (status) {
    case "trial":
      return "Trial";
    case "active":
      return "Pro";
    case "expired":
      return "Expired";
    default:
      return "Free";
  }
}

// Admin header bell: shows recent signups and subscription activations /
// revocations. Unread state is per-browser via localStorage.
export function AdminNotifications() {
  const [data, setData] = useState<NotificationsData | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/notifications");
      setData(res);
      const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      if (!lastSeen) {
        // First ever load — don't flood the badge with old events
        localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
        setUnread(0);
        return;
      }
      const cutoff = new Date(lastSeen).getTime();
      const fresh = [
        ...res.signups.map((s: SignupItem) => s.createdAt),
        ...res.subEvents.map((e: SubEventItem) => e.createdAt),
      ].filter((t) => new Date(t).getTime() > cutoff).length;
      setUnread(fresh);
    } catch {
      // Bell is non-critical — ignore fetch failures
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      load();
      // Mark everything as seen once the admin opens the panel
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
      setUnread(0);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0 ? `Notifications (${unread} new)` : "Notifications"
          }
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {data && (
            <span className="text-[11px] font-normal text-muted-foreground">
              {data.counts.signups7d} signups · {data.counts.activations7d}{" "}
              activated · {data.counts.revocations7d} revoked (7 days)
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-96 overflow-y-auto">
          {/* Signups */}
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5" /> Recent signups
          </div>
          {data && data.signups.length > 0 ? (
            data.signups.map((s) => (
              <div
                key={s.id}
                className="px-2 py-2 flex items-center justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.role === "admin" ? "Admin" : signupStatusLabel(s.subscriptionStatus)}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {timeAgo(s.createdAt)}
                </span>
              </div>
            ))
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              No signups yet.
            </div>
          )}

          <DropdownMenuSeparator />

          {/* Subscription events */}
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <BadgeCheck className="h-3.5 w-3.5" /> Subscriptions
          </div>
          {data && data.subEvents.length > 0 ? (
            data.subEvents.map((e) => (
              <div
                key={e.id}
                className="px-2 py-2 flex items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0 flex items-start gap-2">
                  {e.action === "activate_subscription" ? (
                    <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <BadgeX className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate">
                      <span className="font-medium">
                        {e.action === "activate_subscription"
                          ? "Activated"
                          : "Revoked"}
                      </span>{" "}
                      for <span className="font-medium">{e.targetEmail ?? "user"}</span>
                    </div>
                    {e.adminEmail && (
                      <div className="text-xs text-muted-foreground truncate">
                        by {e.adminEmail}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {timeAgo(e.createdAt)}
                </span>
              </div>
            ))
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              No subscription activity yet.
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
