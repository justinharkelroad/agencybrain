import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supa } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Folder, FolderOpen, ShieldCheck, UploadCloud } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import { useToast } from "@/hooks/use-toast";
import { Link, Navigate } from "react-router-dom";
import { AgencyBrainBadge } from "@/components/AgencyBrainBadge";

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

const ProcessVault: React.FC = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [types, setTypes] = useState<ProcessVaultType[]>([]);
  const [vaults, setVaults] = useState<UserVault[]>([]);
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVault, setSelectedVault] = useState<UserVault | null>(null);
  const [selectedVaultFiles, setSelectedVaultFiles] = useState<VaultFileRow[]>([]);

  // SEO basics
  useEffect(() => {
    document.title = "Process Vault – Secure SOP Storage";
    const desc = "Process Vault: secure, organized storage for your processes and SOPs.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.href;
  }, []);

  const ensureDefaultVaults = async (t: ProcessVaultType[], v: UserVault[]) => {
    if (!user) return;
    const existingTypeIds = new Set(v.filter(x => x.vault_type_id).map(x => x.vault_type_id as string));
    const missing = t.filter(x => !existingTypeIds.has(x.id));
    if (missing.length === 0) return;

    const inserts = missing.map(m => ({ user_id: user.id, title: m.title, vault_type_id: m.id }));
    const { error } = await supa.from("user_process_vaults").insert(inserts);
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
    const { data, error } = await supa
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
      const [{ data: typesData }, { data: vaultsData }] = await Promise.all([
        supa.from("process_vault_types").select("id,title,is_active").eq("is_active", true).order("title", { ascending: true }),
        supa.from("user_process_vaults").select("id,user_id,title,vault_type_id,created_at").order("created_at", { ascending: true }),
      ]);

      const safeTypes = (typesData || []) as ProcessVaultType[];
      const safeVaults = (vaultsData || []) as UserVault[];

      // Ensure defaults then refetch vaults
      await ensureDefaultVaults(safeTypes, safeVaults);
      const { data: vaultsAfter } = await supa
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openVault = async (vault: UserVault) => {
    setSelectedVault(vault);
    setDialogOpen(true);
    // load existing files
    const { data, error } = await supa
      .from("process_vault_files")
      .select("id,user_vault_id,upload_file_path,created_at")
      .eq("user_vault_id", vault.id)
      .order("created_at", { ascending: false });
    if (!error) setSelectedVaultFiles((data || []) as VaultFileRow[]);
  };

  const onUploadComplete = async (files: { id: string }[]) => {
    if (!selectedVault) return;
    if (!files?.length) return;
    try {
      const rows = files.map(f => ({ user_vault_id: selectedVault.id, upload_file_path: f.id }));
      const { error } = await supa.from("process_vault_files").insert(rows);
      if (error) throw error;
      toast({ title: "Vault updated", description: "Files secured in your vault." });
      await fetchCounts([selectedVault.id]);
      // refresh selected vault files
      const { data } = await supa
        .from("process_vault_files")
        .select("id,user_vault_id,upload_file_path,created_at")
        .eq("user_vault_id", selectedVault.id)
        .order("created_at", { ascending: false });
      setSelectedVaultFiles((data || []) as VaultFileRow[]);
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
      const { error } = await supa.from("user_process_vaults").insert({ user_id: user.id, title: upper, vault_type_id: null });
      if (error) throw error;
      toast({ title: "Vault created", description: `${upper} added.` });
      await fetchData();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message || "Failed to create vault", variant: "destructive" });
    }
  };

  const [newVaultName, setNewVaultName] = useState("");
  const secureLabel = (v: UserVault) => (fileCounts[v.id] ? `${v.title} Secured` : v.title);

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen">
      <header className="frosted-header">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <AgencyBrainBadge size="md" />
            <span className="text-lg font-medium text-muted-foreground ml-2">Process Vault</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button variant="secondary" size="sm">Dashboard</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={signOut}>Sign Out</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <h1 className="sr-only">Process Vault</h1>

        <section>
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Secure your processes</CardTitle>
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
                            <div className={`text-xs flex items-center gap-1 ${secured ? 'text-white/80' : 'text-muted-foreground'}`}><UploadCloud className="w-3 h-3" /> {fileCounts[v.id] || 0} file(s)</div>
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
      </main>

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
                        <a
                          className="text-primary underline underline-offset-2"
                          href={supa.storage.from('uploads').getPublicUrl(f.upload_file_path).data.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
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

export default ProcessVault;
