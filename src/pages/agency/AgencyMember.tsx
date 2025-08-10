import React, { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload } from "lucide-react";

export default function AgencyMember() {
  const { memberId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    document.title = "Team Member | My Agency";
    const meta = document.querySelector('meta[name="description"]');
    const content = "View member details, checklist, and uploads";
    if (meta) meta.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  const memberQuery = useQuery({
    queryKey: ["agency-member", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id,name,email,agency_id,status,role,employment")
        .eq("id", memberId as string)
        .single();
      if (error) throw error;
      return data!;
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["templates", memberQuery.data?.agency_id],
    enabled: !!memberQuery.data?.agency_id || memberQuery.isSuccess,
    queryFn: async () => {
      const agencyId = memberQuery.data?.agency_id;
      const or = agencyId ? `agency_id.is.null,agency_id.eq.${agencyId}` : "agency_id.is.null";
      const { data, error } = await supabase
        .from("checklist_template_items")
        .select("id,label,required,order_index,agency_id,active")
        .eq("active", true)
        .or(or)
        .order("agency_id", { ascending: true, nullsFirst: true })
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const mciQuery = useQuery({
    queryKey: ["mci", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_checklist_items")
        .select("id,member_id,template_item_id,secured,attachments_count,created_at,updated_at")
        .eq("member_id", memberId as string);
      if (error) throw error;
      return data || [];
    },
  });

  // Combine templates with member checklist rows
  const checklist = useMemo(() => {
    const map: Record<string, any> = {};
    mciQuery.data?.forEach((r: any) => { map[r.template_item_id] = r; });
    return (templatesQuery.data || []).map((t: any) => ({
      template: t,
      mci: map[t.id] || null,
    }));
  }, [templatesQuery.data, mciQuery.data]);

  const total = checklist.length;
  const securedCount = checklist.filter((it) => it.mci?.secured).length;
  const percent = total > 0 ? Math.round((securedCount / total) * 100) : 0;

  // Realtime updates for MCI and files
  useEffect(() => {
    if (!memberId) return;
    const ch1 = supabase
      .channel(`mci-${memberId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_checklist_items', filter: `member_id=eq.${memberId}` },
        () => qc.invalidateQueries({ queryKey: ["mci", memberId] }))
      .subscribe();
    const ch2 = supabase
      .channel(`af-${memberId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_files', filter: `member_id=eq.${memberId}` },
        () => qc.invalidateQueries({ queryKey: ["mci", memberId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [memberId, qc]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!memberId) throw new Error("Missing member");
      const existing = mciQuery.data || [];
      const existingSet = new Set(existing.map((r: any) => r.template_item_id));
      const payload = (templatesQuery.data || [])
        .filter((t: any) => !existingSet.has(t.id))
        .map((t: any) => ({ member_id: memberId, template_item_id: t.id }));
      if (payload.length === 0) return;
      const { error } = await supabase.from('member_checklist_items').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mci", memberId] });
      toast({ title: "Checklist synced", description: "Templates synced to member" });
    },
    onError: (e: any) => toast({ title: "Sync failed", description: e?.message || "Unable to sync", variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, templateId }: { file: File; templateId: string }) => {
      const agencyId = memberQuery.data?.agency_id;
      if (!agencyId) throw new Error("No agency id");
      const ext = file.name.split('.').pop();
      const path = `agencies/${agencyId}/members/${memberId}/${templateId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('agency_files').insert({
        agency_id: agencyId,
        member_id: memberId,
        template_item_id: templateId,
        original_name: file.name,
        file_path: path,
        mime_type: file.type,
        size: file.size,
        visibility: 'owner_admin',
      });
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mci", memberId] });
      toast({ title: "Uploaded", description: "File attached" });
    },
    onError: (e: any) => toast({ title: "Upload failed", description: e?.message || "Unable to upload", variant: "destructive" }),
  });

  const onFileChange = (templateId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => uploadMutation.mutate({ file, templateId }));
    e.currentTarget.value = "";
  };

  const missingCount = useMemo(() => checklist.filter((it) => !it.mci).length, [checklist]);

  return (
    <div className="min-h-screen">
      <TopNav title="My Agency" />
      <main className="container mx-auto px-4 py-6">
        <article className="space-y-6">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/agency"><Button variant="glass" className="rounded-full"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button></Link>
              <h1 className="text-2xl font-semibold">{memberQuery.data?.name || "Member"}</h1>
            </div>
            <div className="text-sm text-muted-foreground">
              {memberQuery.data?.email} • {memberQuery.data?.role} • {memberQuery.data?.employment} • {memberQuery.data?.status}
            </div>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Onboarding Progress</CardTitle>
              <CardDescription>{securedCount} of {total} secured</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={percent} />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{missingCount > 0 ? `${missingCount} items not initialized` : `All items initialized`}</div>
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="rounded-full">
              {syncMutation.isPending ? "Syncing..." : "Sync Templates"}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Checklist Items</CardTitle>
              <CardDescription>Attach documents to secure each item</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>Member checklist</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Secured</TableHead>
                    <TableHead>Attachments</TableHead>
                    <TableHead>Upload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checklist.map(({ template, mci }) => (
                    <TableRow key={template.id}>
                      <TableCell>{template.label}</TableCell>
                      <TableCell>{template.required ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{mci?.secured ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{mci?.attachments_count ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`file-${template.id}`} className="sr-only">Upload file</Label>
                          <Input id={`file-${template.id}`} type="file" className="max-w-xs" onChange={(e) => onFileChange(template.id, e)} />
                          <Upload className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {checklist.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No checklist items</TableCell>
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
