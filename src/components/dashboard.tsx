"use client";

import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  FilePlus,
  Search,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  computeTotals,
  effectiveStatus,
  formatCurrency,
  formatDate,
  isQuoteExpired,
  statusColor,
  statusLabel,
} from "@/lib/format";
import { useState } from "react";
import type { DocumentType, InvoiceDocument } from "@/lib/types";
import {
  OnboardingChecklist,
  type OnboardingStep,
} from "@/components/onboarding-checklist";

interface Props {
  onOpenDoc: (id: string) => void;
  onNewDoc: (type: DocumentType) => void;
  /** Set by the Clients panel "Documents" button — filters the list to one client. */
  clientFilter?: string | null;
  onClearClientFilter?: () => void;
  onGoToClients?: () => void;
  onGoToSettings?: () => void;
}

export function Dashboard({
  onOpenDoc,
  onNewDoc,
  clientFilter,
  onClearClientFilter,
  onGoToClients,
  onGoToSettings,
}: Props) {
  const business = useStore((s) => s.business);
  const clients = useStore((s) => s.clients);
  const documents = useStore((s) => s.documents);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DocumentType>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const stats = useMemo(() => {
    const invoices = documents.filter((d) => d.type === "invoice");
    // Use the derived status: sent/viewed invoices past their due date are
    // overdue regardless of what the stored status says.
    const effStatus = (d: (typeof documents)[number]) => effectiveStatus(d);
    const paid = invoices.filter((d) => d.status === "paid");
    const outstanding = invoices.filter((d) =>
      ["sent", "viewed", "overdue"].includes(effStatus(d)),
    );
    const overdue = invoices.filter((d) => effStatus(d) === "overdue");

    const totalPaid = paid.reduce(
      (sum, d) => sum + computeTotals(d).total,
      0,
    );
    const totalOutstanding = outstanding.reduce(
      (sum, d) => sum + computeTotals(d).total,
      0,
    );
    const totalOverdue = overdue.reduce(
      (sum, d) => sum + computeTotals(d).total,
      0,
    );

    return {
      totalPaid,
      totalOutstanding,
      totalOverdue,
      invoiceCount: invoices.length,
      quoteCount: documents.filter((d) => d.type === "quote").length,
    };
  }, [documents]);

  const filtered = useMemo(() => {
    return documents
      .filter((d) => (clientFilter ? d.clientId === clientFilter : true))
      .filter((d) => (typeFilter === "all" ? true : d.type === typeFilter))
      .filter((d) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "expired") return isQuoteExpired(d);
        return effectiveStatus(d) === statusFilter;
      })
      .filter((d) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          d.number.toLowerCase().includes(q) ||
          d.clientSnapshot.name.toLowerCase().includes(q) ||
          (d.clientSnapshot.company ?? "").toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [documents, search, typeFilter, statusFilter, clientFilter]);

  const filteredClient = clientFilter
    ? clients.find((c) => c.id === clientFilter)
    : null;

  // ---- Revenue insights (all derived client-side from the loaded docs) ----
  const insights = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const paidInvoices = documents.filter(
      (d) => d.type === "invoice" && d.status === "paid" && d.paidAt,
    );
    const sum = (arr: InvoiceDocument[]) =>
      arr.reduce((s, d) => s + computeTotals(d).total, 0);
    const inRange = (iso: string, from: number, to?: number) => {
      const t = new Date(iso).getTime();
      return t >= from && (to === undefined || t < to);
    };

    const thisMonth = sum(paidInvoices.filter((d) => inRange(d.paidAt!, thisMonthStart)));
    const lastMonth = sum(
      paidInvoices.filter((d) => inRange(d.paidAt!, lastMonthStart, thisMonthStart)),
    );
    const delta =
      lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

    // Days to pay: paidAt minus the moment it went out (sentAt, else creation).
    const payDays = paidInvoices
      .map((d) => {
        const start = d.sentAt ?? d.createdAt;
        return (new Date(d.paidAt!).getTime() - new Date(start).getTime()) / 86_400_000;
      })
      .filter((x) => Number.isFinite(x) && x >= 0);
    const avgDays = payDays.length
      ? Math.round(payDays.reduce((a, b) => a + b, 0) / payDays.length)
      : null;

    const byClient = new Map<string, number>();
    for (const d of paidInvoices) {
      byClient.set(d.clientId, (byClient.get(d.clientId) ?? 0) + computeTotals(d).total);
    }
    const top = [...byClient.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cid, total]) => {
        const c = clients.find((cl) => cl.id === cid);
        return { id: cid, name: c?.company || c?.name || "Client", total };
      });

    return { thisMonth, lastMonth, delta, avgDays, payCount: payDays.length, top };
  }, [documents, clients]);

  // ---- Onboarding checklist (hidden once dismissed or completed) ----
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  useEffect(() => {
    setShowOnboarding(localStorage.getItem("tulkit-onboarding-dismissed") !== "1");
  }, []);

  function dismissOnboarding() {
    localStorage.setItem("tulkit-onboarding-dismissed", "1");
    setShowOnboarding(false);
  }

  const onboardingSteps: OnboardingStep[] = [
    {
      key: "profile",
      label: "Set up your business details",
      hint: "Name, logo, banking — they appear on every document you send.",
      done: Boolean(business.name) && business.name !== "Your Business Name",
      action: onGoToSettings,
      actionLabel: "Open settings",
    },
    {
      key: "client",
      label: "Add your first client",
      done: clients.length > 0,
      action: onGoToClients,
      actionLabel: "Add client",
    },
    {
      key: "invoice",
      label: "Create your first invoice",
      done: documents.length > 0,
      action: () => onNewDoc("invoice"),
      actionLabel: "New invoice",
    },
    {
      key: "send",
      label: "Send an invoice to a client",
      hint: "Share it via WhatsApp or email from the editor.",
      done: documents.some((d) => d.type === "invoice" && d.status !== "draft"),
      action: () => {
        const target = documents.find((d) => d.type === "invoice") ?? documents[0];
        if (target) onOpenDoc(target.id);
      },
      actionLabel: "Open invoice",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Onboarding checklist (first-run) */}
      {showOnboarding === true && (
        <OnboardingChecklist steps={onboardingSteps} onDismiss={dismissOnboarding} />
      )}

      {/* Client filter chip (set from the Clients panel) */}
      {filteredClient && (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            Showing documents for{" "}
            <span className="font-semibold">
              {filteredClient.company || filteredClient.name}
            </span>
          </span>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onClearClientFilter}>
            Show all
          </Button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Paid"
          value={formatCurrency(stats.totalPaid, business.currencySymbol)}
          tone="emerald"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Outstanding"
          value={formatCurrency(stats.totalOutstanding, business.currencySymbol)}
          tone="amber"
        />
        <StatCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="Overdue"
          value={formatCurrency(stats.totalOverdue, business.currencySymbol)}
          tone="red"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Documents"
          value={`${documents.length}`}
          tone="neutral"
          sub={`${stats.invoiceCount} invoices · ${stats.quoteCount} quotes`}
        />
      </div>

      {/* Revenue insights */}
      {documents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Revenue insights
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Paid this month</div>
              <div className="text-lg font-bold mt-0.5">
                {formatCurrency(insights.thisMonth, business.currencySymbol)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {insights.delta === null
                  ? `Last month: ${formatCurrency(insights.lastMonth, business.currencySymbol)}`
                  : `${insights.delta >= 0 ? "+" : ""}${insights.delta}% vs last month (${formatCurrency(insights.lastMonth, business.currencySymbol)})`}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Average days to pay</div>
              <div className="text-lg font-bold mt-0.5">
                {insights.avgDays === null ? "—" : `${insights.avgDays} days`}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {insights.payCount === 0
                  ? "No paid invoices yet"
                  : `Across ${insights.payCount} paid invoice${insights.payCount === 1 ? "" : "s"}`}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Top clients (paid)</div>
              {insights.top.length === 0 ? (
                <div className="text-lg font-bold mt-0.5">—</div>
              ) : (
                <div className="mt-1 space-y-1">
                  {insights.top.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-muted-foreground">{t.name}</span>
                      <span className="font-semibold shrink-0">
                        {formatCurrency(t.total, business.currencySymbol)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick create */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Button
          onClick={() => onNewDoc("invoice")}
          className="h-auto py-4 justify-start bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
        >
          <FilePlus className="h-5 w-5 mr-3" />
          <div className="text-left">
            <div className="font-semibold">New Invoice</div>
            <div className="text-xs text-emerald-100">Create and send in 60 seconds</div>
          </div>
        </Button>
        <Button
          onClick={() => onNewDoc("quote")}
          variant="outline"
          className="h-auto py-4 justify-start"
        >
          <FileText className="h-5 w-5 mr-3" />
          <div className="text-left">
            <div className="font-semibold">New Quote</div>
            <div className="text-xs text-muted-foreground">Send a price estimate</div>
          </div>
        </Button>
      </div>

      {/* Documents list */}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Documents</CardTitle>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="invoice">Invoices</SelectItem>
                  <SelectItem value="quote">Quotes</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="expired">Expired quotes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by number or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                {documents.length === 0
                  ? "No documents yet. Create your first invoice above."
                  : "No documents match your filters."}
              </p>
              {documents.length === 0 && (
                <Button
                  onClick={() => onNewDoc("invoice")}
                  className="mt-3 bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
                >
                  <Plus className="h-4 w-4 mr-2" /> Create invoice
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((d) => {
                const totals = computeTotals(d);
                const eff = effectiveStatus(d);
                const expired = isQuoteExpired(d);
                return (
                  <button
                    key={d.id}
                    onClick={() => onOpenDoc(d.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left ${
                      expired ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
                          d.type === "invoice"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                        }`}
                      >
                        {d.type === "invoice" ? (
                          <FilePlus className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{d.number}</span>
                          {expired ? (
                            <Badge
                              variant="outline"
                              className="border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"
                            >
                              Expired
                            </Badge>
                          ) : (
                            <Badge className={statusColor(eff)} variant="secondary">
                              {statusLabel(eff)}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {d.clientSnapshot.company || d.clientSnapshot.name}
                          {" · "}
                          {formatDate(d.issueDate)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-sm">
                        {formatCurrency(totals.total, business.currencySymbol)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {d.type === "invoice"
                          ? `Due ${formatDate(d.dueDate)}`
                          : expired
                            ? `Expired ${formatDate(d.dueDate)}`
                            : `Valid until ${formatDate(d.dueDate)}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: "emerald" | "amber" | "red" | "neutral";
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
        <div className="text-xl font-bold mt-2 truncate">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
