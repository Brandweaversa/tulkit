"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, User, Search, FileText, ArrowRight } from "lucide-react";
import { v4 as uuid } from "uuid";
import { useStore } from "@/lib/store";
import type { Client } from "@/lib/types";
import { computeTotals, effectiveStatus, formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

const EMPTY_CLIENT: Client = {
  id: "",
  name: "",
  email: "",
  phone: "",
  company: "",
  address: "",
  vatNumber: "",
};

interface Props {
  /** Jump to the dashboard filtered on this client's documents. */
  onViewDocs?: (clientId: string) => void;
}

export function ClientsPanel({ onViewDocs }: Props) {
  const clients = useStore((s) => s.clients);
  const documents = useStore((s) => s.documents);
  const business = useStore((s) => s.business);
  const upsertClient = useStore((s) => s.upsertClient);
  const deleteClient = useStore((s) => s.deleteClient);
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Per-client money facts, computed once from the documents in the store.
  const stats = useMemo(() => {
    const map = new Map<
      string,
      { docCount: number; invoiced: number; outstanding: number; lastDoc: string | null }
    >();
    for (const c of clients) {
      map.set(c.id, { docCount: 0, invoiced: 0, outstanding: 0, lastDoc: null });
    }
    for (const d of documents) {
      const entry = map.get(d.clientId);
      if (!entry) continue;
      entry.docCount += 1;
      const total = computeTotals(d).total;
      if (d.type === "invoice" && d.status !== "draft") {
        entry.invoiced += total;
        if (["sent", "viewed", "overdue"].includes(effectiveStatus(d))) {
          entry.outstanding += total;
        }
      }
      if (!entry.lastDoc || d.createdAt > entry.lastDoc) {
        entry.lastDoc = d.createdAt;
      }
    }
    return map;
  }, [clients, documents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [clients, search]);

  function openNew() {
    setEditing({ ...EMPTY_CLIENT, id: uuid() });
    setOpen(true);
  }

  function openEdit(c: Client) {
    setEditing({ ...c });
    setOpen(true);
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertClient(editing);
      setOpen(false);
      setEditing(null);
      toast({
        title: "Client saved!",
        description: saved ? `${saved.name} has been saved.` : undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.includes("Free tier limit")) {
        toast({
          title: "Free tier limit reached",
          description: "Upgrade to Pro for unlimited clients.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Could not save client",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Clients</h2>
          <p className="text-sm text-muted-foreground">
            Save client details once, reuse on every invoice or quote.
          </p>
        </div>
        <Button onClick={openNew} className="bg-[#0E7C9C] hover:bg-[#0A6582] text-white">
          <Plus className="h-4 w-4 mr-2" /> New client
        </Button>
      </div>

      {clients.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients by name, company, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-muted-foreground">No clients yet.</p>
            <Button onClick={openNew} variant="outline" className="mt-3">
              <Plus className="h-4 w-4 mr-2" /> Add your first client
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No clients match “{search}”.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const s = stats.get(c.id);
            return (
            <Card key={c.id} className="flex flex-col">
              <CardContent className="p-4 space-y-2 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {c.company || c.name}
                    </div>
                    {c.company && (
                      <div className="text-xs text-muted-foreground truncate">
                        {c.name}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={async () => {
                        if (!confirm(`Delete ${c.name}?`)) return;
                        const success = await deleteClient(c.id);
                        if (success) {
                          toast({ title: "Client deleted" });
                        } else {
                          // Check if it failed because of linked documents
                          try {
                            const res = await fetch(`/api/clients/${c.id}`);
                            if (res.status === 409) {
                              const data = await res.json();
                              toast({
                                title: "Cannot delete client",
                                description: `${c.name} has ${data.docCount} linked document(s). Delete those first or use "force delete".`,
                                variant: "destructive",
                              });
                              // Ask if they want to force delete
                              if (confirm(`Force delete ${c.name} and ALL ${data.docCount} linked documents?`)) {
                                const forceRes = await fetch(`/api/clients/${c.id}?force=true`, { method: "DELETE" });
                                if (forceRes.ok) {
                                  toast({ title: "Client and all linked documents deleted" });
                                  // Remove from local state
                                  useStore.setState((s) => ({
                                    clients: s.clients.filter((cl) => cl.id !== c.id),
                                    documents: s.documents.filter((d) => d.clientId !== c.id),
                                  }));
                                } else {
                                  toast({ title: "Force delete failed", variant: "destructive" });
                                }
                              }
                            } else {
                              toast({ title: "Could not delete client", variant: "destructive" });
                            }
                          } catch {
                            toast({ title: "Could not delete client", variant: "destructive" });
                          }
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {c.email && <div className="truncate">{c.email}</div>}
                  {c.phone && <div>{c.phone}</div>}
                  {c.address && <div className="truncate">{c.address}</div>}
                </div>

                {/* Money summary */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                  <div>
                    <div className="text-muted-foreground">Invoiced</div>
                    <div className="font-semibold">
                      {formatCurrency(s?.invoiced ?? 0, business.currencySymbol)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Outstanding</div>
                    <div
                      className={`font-semibold ${
                        (s?.outstanding ?? 0) > 0
                          ? "text-red-600 dark:text-red-400"
                          : ""
                      }`}
                    >
                      {formatCurrency(s?.outstanding ?? 0, business.currencySymbol)}
                    </div>
                  </div>
                </div>
              </CardContent>
              <div className="px-4 pb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {s?.docCount ?? 0} document{(s?.docCount ?? 0) === 1 ? "" : "s"}
                  {s?.lastDoc ? ` · last ${formatDate(s.lastDoc)}` : ""}
                </span>
                {onViewDocs && (s?.docCount ?? 0) > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onViewDocs(c.id)}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" /> Documents
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                )}
              </div>
            </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing && clients.some((c) => c.id === editing.id) ? "Edit client" : "New client"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Contact name">
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Field>
                <Field label="Company">
                  <Input
                    value={editing.company ?? ""}
                    onChange={(e) => setEditing({ ...editing, company: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={editing.email ?? ""}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={editing.phone ?? ""}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    placeholder="+27 82 555 0101"
                  />
                </Field>
              </div>
              <Field label="Address">
                <Textarea
                  rows={2}
                  value={editing.address ?? ""}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                />
              </Field>
              <Field label="VAT / Tax number">
                <Input
                  value={editing.vatNumber ?? ""}
                  onChange={(e) => setEditing({ ...editing, vatNumber: e.target.value })}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-[#0E7C9C] hover:bg-[#0A6582] text-white"
            >
              {saving ? "Saving..." : "Save client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
