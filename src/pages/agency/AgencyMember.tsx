
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, Save } from "lucide-react";

export default function AgencyMember() {
  const { memberId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  
  // State for staged file uploads
  const [stagedFiles, setStagedFiles] = useState<Record<string, File[]>>({});

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
      const { data, error } = await supa
        .from("team_members")
        .select("id,name,email,agency_id,status,role,employment")
        .eq("id", memberId as string)
        .single();
      if (error) throw error;
      return data!;
    },
  });

  // Separate useMemo for agency ID to prevent circular dependencies
  const agencyId = useMemo(() => memberQuery.data?.agency_id, [memberQuery.data?.agency_id]);

  const templatesQuery = useQuery({
    queryKey: ["templates", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const or = agencyId ? `agency_id.is.null,agency_id.eq.${agencyId}` : "agency_id.is.null";
      const { data, error } = await supa
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
      const { data, error } = await supa
        .from("member_checklist_items")
        .select("id,member_id,template_item_id,secured,attachments_count,created_at,updated_at")
        .eq("member_id", memberId as string);
      if (error) throw error;
      return data || [];
    },
  });

  // Combine templates with member checklist rows (simplified dependencies)
  const checklist = useMemo(() => {
    if (!templatesQuery.data || !Array.isArray(templatesQuery.data)) return [];
    if (!mciQuery.data || !Array.isArray(mciQuery.data)) {
      return templatesQuery.data.map((t: any) => ({
        template: t,
        mci: null,
      }));
    }
    
    const map: Record<string, any> = {};
    mciQuery.data.forEach((r: any) => { 
      if (r?.template_item_id) map[r.template_item_id] = r; 
    });
    
    return templatesQuery.data.map((t: any) => ({
      template: t,
      mci: t?.id ? map[t.id] || null : null,
    }));
  }, [templatesQuery.data, mciQuery.data]);

  const total = checklist.length;
  const securedCount = checklist.filter((it) => it.mci?.secured).length;
  const percent = total > 0 ? Math.round((securedCount / total) * 100) : 0;

  // Realtime updates for MCI and files
  useEffect(() => {
    if (!memberId) return;
    const ch1 = supa
      .channel(`mci-${memberId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_checklist_items', filter: `member_id=eq.${memberId}` },
        () => qc.invalidateQueries({ queryKey: ["mci", memberId] }))
      .subscribe();
    const ch2 = supa
      .channel(`af-${memberId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agency_files', filter: `member_id=eq.${memberId}` },
        () => qc.invalidateQueries({ queryKey: ["mci", memberId] }))
      .subscribe();
    return () => { supa.removeChannel(ch1); supa.removeChannel(ch2); };
  }, [memberId, qc]);

  // Add/remove single checklist item for this member
  const addItemMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!memberId) throw new Error("Missing member");
      const { error } = await supa
        .from('member_checklist_items')
        .insert({ member_id: memberId, template_item_id: templateId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mci", memberId] });
      toast({ title: "Added", description: "Checklist item added for this member" });
    },
    onError: (e: any) => toast({ title: "Add failed", description: e?.message || "Unable to add item", variant: "destructive" }),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!memberId) throw new Error("Missing member");
      const { error } = await supa
        .from('member_checklist_items')
        .delete()
        .eq('member_id', memberId as string)
        .eq('template_item_id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mci", memberId] });
      toast({ title: "Removed", description: "Checklist item removed for this member" });
    },
    onError: (e: any) => toast({ title: "Remove failed", description: e?.message || "Unable to remove item", variant: "destructive" }),
  });

  // Handle file selection (staging)
  const onFileChange = (templateId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log('File selection for template:', templateId, 'files:', files?.length);
    
    if (!files || files.length === 0) {
      // Clear staged files if no files selected
      setStagedFiles(prev => {
        const newStaged = { ...prev };
        delete newStaged[templateId];
        return newStaged;
      });
      return;
    }

    const fileArray = Array.from(files);
    console.log('Staging files:', fileArray.map(f => f.name));
    
    setStagedFiles(prev => ({
      ...prev,
      [templateId]: fileArray
    }));
    
    // Don't clear the input value immediately - let user see their selection
  };

  // Save staged files mutation
  const saveFilesMutation = useMutation({
    mutationFn: async ({ files, templateId }: { files: File[]; templateId: string }) => {
      if (!agencyId) throw new Error("No agency id");
      if (!user?.id) throw new Error("User not authenticated");
      
      const uploadedFiles: string[] = [];
      
      for (const file of files) {
        const ext = file.name.split('.').pop();
        // Use user ID at the start of path to match RLS policies
        const path = `${user.id}/agency-files/${agencyId}/members/${memberId}/${templateId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        
        console.log('Uploading file:', file.name, 'to path:', path);
        
        const { error: upErr } = await supa.storage.from('uploads').upload(path, file);
        if (upErr) {
          console.error('Storage upload error:', upErr);
          throw new Error(`Upload failed: ${upErr.message}`);
        }
        
        console.log('File uploaded to storage, inserting into database...');
        
        const { error: dbErr } = await supa.from('agency_files').insert({
          agency_id: agencyId,
          member_id: memberId,
          template_item_id: templateId,
          original_name: file.name,
          file_path: path,
          mime_type: file.type,
          size: file.size,
          visibility: 'owner_admin',
          uploaded_by_user_id: user.id, // Explicitly set the uploader
        });
        if (dbErr) {
          console.error('Database insert error:', dbErr);
          throw new Error(`Database error: ${dbErr.message}`);
        }
        
        uploadedFiles.push(file.name);
        console.log('File successfully saved to database:', file.name);
      }
      
      return { uploadedFiles, templateId };
    },
    onSuccess: ({ uploadedFiles, templateId }) => {
      console.log('Upload success callback triggered for template:', templateId);
      
      // Clear the file input
      const fileInput = document.getElementById(`file-${templateId}`) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
      
      // Clear staged files for this template
      setStagedFiles(prev => {
        const newStaged = { ...prev };
        delete newStaged[templateId];
        return newStaged;
      });
      
      // Add a small delay to let database triggers complete before invalidating
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["mci", memberId] });
        qc.invalidateQueries({ queryKey: ["agency_files"] });
      }, 100);
      
      toast({ 
        title: "Success", 
        description: `${uploadedFiles.length} file(s) uploaded successfully!` 
      });
    },
    onError: (e: any) => {
      console.error('Upload error:', e);
      toast({ 
        title: "Upload Failed", 
        description: e?.message || "Unable to save files", 
        variant: "destructive" 
      });
    },
  });

  const missingCount = useMemo(() => checklist.filter((it) => !it.mci).length, [checklist]);

  return (
    <div className="min-h-screen">
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

          <div className="text-sm text-muted-foreground">
            {missingCount > 0 ? `${missingCount} templates available to add` : `All templates are in use`}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Checklist Items</CardTitle>
              <CardDescription>Attach documents to secure each item or remove items not needed for this member</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>Member checklist</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Secured</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Upload</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checklist.map(({ template, mci }) => (
                    <TableRow key={template.id}>
                      <TableCell>{template.label}</TableCell>
                      
                      <TableCell>{mci?.secured ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{mci?.attachments_count ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`file-${template.id}`} className="sr-only">Upload file</Label>
                          <Input 
                            id={`file-${template.id}`} 
                            type="file" 
                            multiple
                            className="max-w-xs" 
                            onChange={(e) => onFileChange(template.id, e)} 
                            disabled={!mci} 
                          />
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          {stagedFiles[template.id] && (
                            <span className="text-xs text-muted-foreground">
                              {stagedFiles[template.id].length} staged
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {mci ? (
                            <>
                              {stagedFiles[template.id] && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="rounded-full"
                                  onClick={() => saveFilesMutation.mutate({ files: stagedFiles[template.id], templateId: template.id })}
                                  disabled={saveFilesMutation.isPending}
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  {saveFilesMutation.isPending ? "Uploading..." : `Save (${stagedFiles[template.id].length})`}
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                className="rounded-full"
                                onClick={() => removeItemMutation.mutate(template.id)}
                                disabled={removeItemMutation.isPending}
                              >
                                {removeItemMutation.isPending ? "Removing..." : "Remove"}
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              className="rounded-full"
                              onClick={() => addItemMutation.mutate(template.id)}
                              disabled={addItemMutation.isPending}
                            >
                              {addItemMutation.isPending ? "Adding..." : "Add"}
                            </Button>
                          )}
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
