
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Props = {
  agencyId: string | null;
};

type Template = {
  id: string;
  label: string;
  required: boolean;
  order_index: number;
  active: boolean;
  agency_id: string | null;
};

export default function AgencyTemplatesManager({ agencyId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ label: string; required: boolean; order_index: number; active: boolean }>({
    label: "",
    required: true,
    order_index: 0,
    active: true,
  });

  const canManage = useMemo(() => !!agencyId, [agencyId]);

  const loadTemplates = async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("checklist_template_items")
        .select("id,label,required,order_index,active,agency_id")
        .eq("agency_id", agencyId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      setTemplates(data || []);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Load failed", description: e?.message || "Unable to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, [agencyId]);

  const createTemplate = async () => {
    if (!agencyId) return;
    if (!form.label.trim()) {
      toast({ title: "Label required", description: "Please enter a label for the template.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("checklist_template_items")
        .insert([{ agency_id: agencyId, label: form.label.trim(), required: form.required, order_index: form.order_index, active: form.active }]);
      if (error) throw error;
      setOpen(false);
      setForm({ label: "", required: true, order_index: 0, active: true });
      await loadTemplates();
      toast({ title: "Created", description: "Template added for your agency" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Create failed", description: e?.message || "Unable to create template", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (t: Template) => {
    setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, active: !x.active } : x))); // optimistic
    const desired = !t.active;
    const { error } = await supabase.from("checklist_template_items").update({ active: desired }).eq("id", t.id);
    if (error) {
      console.error(error);
      // revert
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, active: t.active } : x)));
      toast({ title: "Update failed", description: error.message || "Unable to update", variant: "destructive" });
      return;
    }
    // Note: when turning ON, DB trigger seeds MCIs for all members automatically
    toast({ title: "Updated", description: desired ? "Template activated" : "Template deactivated" });
  };

  const updateOrder = async (t: Template, order: number) => {
    setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, order_index: order } : x))); // optimistic
    const { error } = await supabase.from("checklist_template_items").update({ order_index: order }).eq("id", t.id);
    if (error) {
      console.error(error);
      // revert
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, order_index: t.order_index } : x)));
      toast({ title: "Update failed", description: error.message || "Unable to update order", variant: "destructive" });
      return;
    }
    toast({ title: "Order saved", description: "Item order updated" });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Checklist Templates</CardTitle>
          <CardDescription>Templates here apply to all members in your agency; each member can remove items they don't need.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full" disabled={!canManage}>New Template</Button>
          </DialogTrigger>
          <DialogContent className="glass-surface">
            <DialogHeader>
              <DialogTitle>New Checklist Template</DialogTitle>
              <DialogDescription>Define a checklist item that will be available to every team member.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-4 items-center gap-3">
                <Label className="text-right" htmlFor="tmpl-label">Label</Label>
                <Input id="tmpl-label" className="col-span-3" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
              </div>
              <div className="grid grid-cols-4 items-center gap-3">
                <Label className="text-right" htmlFor="tmpl-required">Required</Label>
                <div className="col-span-3">
                  <Switch id="tmpl-required" checked={form.required} onCheckedChange={(v) => setForm((f) => ({ ...f, required: v }))} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-3">
                <Label className="text-right" htmlFor="tmpl-order">Order</Label>
                <Input
                  id="tmpl-order"
                  className="col-span-3"
                  type="number"
                  value={form.order_index}
                  onChange={(e) => setForm((f) => ({ ...f, order_index: Number(e.target.value) }))}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-3">
                <Label className="text-right" htmlFor="tmpl-active">Active</Label>
                <div className="col-span-3">
                  <Switch id="tmpl-active" checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={createTemplate} disabled={loading}>{loading ? "Saving..." : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!agencyId ? (
          <div className="text-sm text-muted-foreground">Create your agency first to manage templates.</div>
        ) : (
          <Table>
            <TableCaption>Agency-specific checklist templates</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.label}</TableCell>
                  <TableCell>{t.required ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="max-w-[96px]"
                      value={t.order_index}
                      onChange={(e) => updateOrder(t, Number(e.target.value))}
                      disabled={loading}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch checked={t.active} onCheckedChange={() => toggleActive(t)} disabled={loading} />
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {loading ? "Loading..." : "No templates yet. Create your first one."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
