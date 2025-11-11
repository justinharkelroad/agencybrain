import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Folder, FolderOpen, ShieldCheck, UploadCloud } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import { useToast } from "@/hooks/use-toast";
import { fetchActiveProcessVaultTypes } from "@/lib/dataFetchers";

interface ProcessVaultType {
  id: string;
  title: string;
  is_active: boolean;
}

interface UserVault {
  id: string;
  user_id: string;
  title: string;
  vault_type_id: string | null;
  created_at: string;
}

interface VaultFileRow {
  id: string;
  user_vault_id: string;
  upload_file_path: string;
  created_at: string;
}

export const ProcessVaultContent: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [types, setTypes] = useState<ProcessVaultType[]>([]);
  const [vaults, setVaults] = useState<UserVault[]>([]);
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVault, setSelectedVault] = useState<UserVault | null>(null);
  const [selectedVaultFiles, setSelectedVaultFiles] = useState<VaultFileRow[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [newVaultName, setNewVaultName] = useState("");

  const ensureDefaultVaults = async (t: ProcessVaultType[], v: UserVault[]) => {
    if (!user) return;
    const existingTypeIds = new Set(v.filter(x => x.vault_type_id).map(x => x.vault_type_id as string));
    const missing = t.filter(x => !existingTypeIds.has(x.id));
    if (missing.length === 0) return;

    const inserts = missing.map(m => ({ user_id: user.id, title: m.title, vault_type_id: m.id }));
    const { error } = await supabase.from("user_process_vaults").insert(inserts);
    if (error) {
      console.error("Failed ensuring defaults", error);
      toast({ title: "Error", description: "Couldn't create default vaults.", variant: "destructive" });
    }
  };

  const fetchCounts = async (vaultIds: string[]) => {
    if (vaultIds.length === 0) {
      setFileCounts({});
      return;
    }
    const { data, error } = await supabase
      .from("process_vault_files")
      .select("user_vault_id")
      .in("user_vault_id", vaultIds);
    if (error) {
      console.error("Count fetch error", error);
      return;
    }
    const counts: Record<string, number> = {};
    (data as VaultFileRow[]).forEach(r => {
      counts[r.user_vault_id] = (counts[r.user_vault_id] || 0) + 1;
    });
    setFileCounts(counts);
  };

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const typesData = await fetchActiveProcessVaultTypes();
      const { data: vaultsData } = await supabase
        .from("user_process_vaults").select("id,user_id,title,vault_type_id,created_at").order("created_at", { ascending: true });

      const safeTypes = typesData as ProcessVaultType[];
      const safeVaults = (vaultsData || []) as UserVault[];

      await ensureDefaultVaults(safeTypes, safeVaults);
      const { data: vaultsAfter } = await supabase
        .from("user_process_vaults")
        .select("id,user_id,title,vault_type_id,created_at")
        .order("created_at", { ascending: true });

      const finalVaults = (vaultsAfter || []) as UserVault[];

      setTypes(safeTypes);
      setVaults(finalVaults);
      await fetchCounts(finalVaults.map(v => v.id));
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load Process Vault.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user?.id]);

  const generateSignedUrls = async (files: VaultFileRow[]) => {
    const urls: Record<string, string> = {};
    for (const file of files) {
      const { data, error } = await supabase.storage
        .from('uploads')
        .createSignedUrl(file.upload_file_path, 3600);
      
      if (!error && data) {
        urls[file.id] = data.signedUrl;
      } else if (error) {
        console.error('Failed to generate signed URL:', error);
      }
    }
    setSignedUrls(urls);
  };

  const openVault = async (vault: UserVault) => {
    setSelectedVault(vault);
    setDialogOpen(true);
    setSignedUrls({});
    const { data, error } = await supabase
      .from("process_vault_files")
      .select("id,user_vault_id,upload_file_path,created_at")
      .eq("user_vault_id", vault.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const files = data as VaultFileRow[];
      setSelectedVaultFiles(files);
      await generateSignedUrls(files);
    }
  };

  const onUploadComplete = async (files: { id: string }[]) => {
    if (!selectedVault) return;
    if (!files?.length) return;
    try {
      const rows = files.map(f => ({ user_vault_id: selectedVault.id, upload_file_path: f.id }));
      const { error } = await supabase.from("process_vault_files").insert(rows);
      if (error) throw error;
      toast({ title: "Vault updated", description: "Files secured in your vault." });
      await fetchCounts([selectedVault.id]);
      const { data } = await supabase
        .from("process_vault_files")
        .select("id,user_vault_id,upload_file_path,created_at")
        .eq("user_vault_id", selectedVault.id)
        .order("created_at", { ascending: false });
      const vaultFiles = (data || []) as VaultFileRow[];
      setSelectedVaultFiles(vaultFiles);
      await generateSignedUrls(vaultFiles);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Couldn't add files to vault.", variant: "destructive" });
    }
  };

  const addVault = async (titleInput: string) => {
    const title = titleInput.trim();
    if (!title) return;
    if (!user) return;
    try {
      const upper = title.toUpperCase();
      const { error } = await supabase.from("user_process_vaults").insert({ user_id: user.id, title: upper, vault_type_id: null });
      if (error) throw error;
      toast({ title: "Vault created", description: `${upper} added.` });
      await fetchData();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message || "Failed to create vault", variant: "destructive" });
    }
  };

  const secureLabel = (v: UserVault) => (fileCounts[v.id] ? `${v.title} Secured` : v.title);

  return (
    <div className="space-y-6">
      <section>
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Secure your processes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {loading ? (
                <div className="col-span-full text-center text-muted-foreground">Loading vaults...</div>
              ) : (
                vaults.map((v) => {
                  const secured = (fileCounts[v.id] || 0) > 0;
                  return (
                    <button
                      key={v.id}
                      onClick={() => openVault(v)}
                      className={`group border rounded-lg p-4 text-left transition-smooth hover-scale ${secured ? 'gradient-success text-white' : ''}`}
                      aria-label={`Open ${v.title} vault`}
                    >
                      <div className="flex items-center gap-3">
                        {secured ? (
                          <FolderOpen className="w-8 h-8 text-white" />
                        ) : (
                          <Folder className="w-8 h-8 text-muted-foreground" />
                        )}
                        <div>
                          <div className="font-semibold">{secureLabel(v)}</div>
                          <div className={`text-xs flex items-center gap-1 ${secured ? 'text-white/80' : 'text-muted-foreground'}`}>
                            <UploadCloud className="w-3 h-3" /> {fileCounts[v.id] || 0} file(s)
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Add a custom vault</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Input placeholder="e.g., SOP ARCHIVE" value={newVaultName} onChange={(e) => setNewVaultName(e.target.value)} />
            <Button variant="gradient-glow" onClick={() => { addVault(newVaultName); setNewVaultName(""); }}>Add</Button>
          </CardContent>
        </Card>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedVault ? secureLabel(selectedVault) : "Vault"}</DialogTitle>
          </DialogHeader>
          {selectedVault && (
            <div className="space-y-6">
              <div>
                <FileUpload
                  category={`process-vault/${selectedVault.title.toLowerCase().replace(/\s+/g, '-')}`}
                  onUploadComplete={onUploadComplete}
                />
              </div>

              {selectedVaultFiles.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Stored Files</div>
                  <ul className="space-y-1">
                    {selectedVaultFiles.map((f) => (
                      <li key={f.id} className="text-sm flex items-center justify-between border rounded p-2">
                        <span className="truncate mr-2">{f.upload_file_path.split('/').pop()}</span>
                        {signedUrls[f.id] ? (
                          <a
                            className="text-primary underline underline-offset-2"
                            href={signedUrls[f.id]}
                            target="_blank"
                            rel="noreferrer"
                            download
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">Loading...</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No files yet.</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
