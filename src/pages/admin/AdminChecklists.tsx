import React, { useEffect, useMemo, useState } from "react";
import { AdminTopNav } from "@/components/AdminTopNav";
import { useAuth } from "@/lib/auth";
import { supa } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Plus, Trash2 } from "lucide-react";

export default function AdminChecklists() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    document.title = "Onboarding Checklists | Admin";
    const meta = document.querySelector('meta[name="description"]');
    const content = "Manage onboarding checklist templates (global or agency)";
    if (meta) meta.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  const { data: agencyId } = useQuery({
    queryKey: ["agency-id", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supa.from("profiles").select("agency_id").eq("id", user!.id).single();
      if (error) throw error;
      return data?.agency_id as string | null;
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["checklist-templates", agencyId],
    enabled: agencyId !== undefined,
    queryFn: async () => {
      const or = agencyId ? `agency_id.is.null,agency_id.eq.${agencyId}` : "agency_id.is.null";
      const { data, error } = await supa
        .from("checklist_template_items")
        .select("id,label,required,active,order_index,agency_id,created_at")
        .or(or)
        .order("agency_id", { ascending: true, nullsFirst: true })
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const channel = supa
      .channel("admin-checklists")
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_template_items" }, () =>
        qc.invalidateQueries({ queryKey: ["checklist-templates", agencyId] })
      )
      .subscribe();
    return () => { supa.removeChannel(channel); };
  }, [agencyId, qc]);

  type FormState = {
    label: string;
    order_index: number;
    required: boolean;
    active: boolean;
    global: boolean; // if true -> agency_id = null
  };

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ label: "", order_index: 0, required: true, active: true, global: false });

  const resetForm = () => {
    setEditingId(null);
    setForm({ label: "", order_index: 0, required: true, active: true, global: false });
  };

  const startCreate = () => { resetForm(); setOpen(true); };
  const startEdit = (it: any) => {
    setEditingId(it.id);
    setForm({ label: it.label, order_index: it.order_index ?? 0, required: !!it.required, active: !!it.active, global: it.agency_id == null });
    setOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!form.label.trim()) throw new Error("Label is required");
      const payload: any = {
        label: form.label.trim(),
        order_index: Number(form.order_index) || 0,
        required: form.required,
        active: form.active,
        agency_id: form.global ? null : agencyId,
      };
      if (!form.global && !agencyId) throw new Error("No agency available for agency-scoped template");
      if (editingId) {
        const { error } = await supa.from("checklist_template_items").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supa.from("checklist_template_items").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-templates", agencyId] });
      toast({ title: "Saved", description: "Checklist template saved" });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message || "Unable to save template", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supa.from("checklist_template_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-templates", agencyId] });
      toast({ title: "Deleted", description: "Checklist template deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e?.message || "Unable to delete template", variant: "destructive" }),
  });

  const submit = () => upsertMutation.mutate();
  const title = useMemo(() => (editingId ? "Edit Template" : "Add Template"), [editingId]);

  return (
    <div>
      <AdminTopNav title="Onboarding Checklists" />
      <main className="container mx-auto px-4 py-6">
        <article className="space-y-6">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Onboarding Checklists</h1>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button onClick={startCreate} className="rounded-full" aria-label="Add checklist template">
                  <Plus className="h-4 w-4 mr-2" /> Add Template
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-surface">
                <DialogHeader>
                  <DialogTitle>{title}</DialogTitle>
                  <DialogDescription>Create global or agency-specific items</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-4 items-center gap-3">
                    <Label className="text-right" htmlFor="label">Label</Label>
                    <Input id="label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-3">
                    <Label className="text-right" htmlFor="order">Order</Label>
                    <Input id="order" type="number" value={form.order_index} onChange={(e) => setForm((f) => ({ ...f, order_index: Number(e.target.value) }))} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-3">
                    <Label className="text-right">Required</Label>
                    <div className="col-span-3"><Switch checked={form.required} onCheckedChange={(v) => setForm((f) => ({ ...f, required: v }))} /></div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-3">
                    <Label className="text-right">Active</Label>
                    <div className="col-span-3"><Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} /></div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-3">
                    <Label className="text-right">Scope</Label>
                    <Select value={form.global ? "global" : "agency"} onValueChange={(v) => setForm((f) => ({ ...f, global: v === "global" }))}>
                      <SelectTrigger className="col-span-3"><SelectValue placeholder="Select scope" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Global</SelectItem>
                        <SelectItem value="agency">This agency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                  <Button variant="gradient-glow" onClick={submit} disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Saving..." : "Save"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
              <CardDescription>Global and agency-specific items</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>Checklist templates</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsQuery.data?.map((it: any) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.label}</TableCell>
                      <TableCell>{it.order_index ?? 0}</TableCell>
                      <TableCell>{it.required ? "Yes" : "No"}</TableCell>
                      <TableCell>{it.active ? "Yes" : "No"}</TableCell>
                      <TableCell>{it.agency_id ? "Agency" : "Global"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="secondary" size="icon" className="rounded-full" aria-label="Edit" onClick={() => startEdit(it)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" className="rounded-full" aria-label="Delete" onClick={() => deleteMutation.mutate(it.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!itemsQuery.isLoading && itemsQuery.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">No templates yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </article>
      </main>
    </div>
  );
}
