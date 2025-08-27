import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supa } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link, Navigate } from "react-router-dom";
import { LogOut, Shield, Trash2, Plus } from "lucide-react";
import { AdminTopNav } from "@/components/AdminTopNav";

interface ProcessVaultType {
  id: string;
  title: string;
  is_active: boolean;
  created_at: string;
}

const AdminProcessVaultTypes: React.FC = () => {
  const { user, isAdmin, signOut } = useAuth();
  const { toast } = useToast();

  const [types, setTypes] = useState<ProcessVaultType[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // SEO
  useEffect(() => {
    document.title = "Process Vault Types – Admin";
    const desc = "Manage default Process Vault types for all clients.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);

  const fetchTypes = async () => {
    const { data, error } = await supa
      .from("process_vault_types")
      .select("id,title,is_active,created_at")
      .order("title", { ascending: true });
    if (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load types", variant: "destructive" });
    } else {
      setTypes((data || []) as ProcessVaultType[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && isAdmin) fetchTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  const addType = async () => {
    const raw = newTitle.trim();
    if (!raw) return;
    const title = raw.toUpperCase();
    const { error } = await supa.from("process_vault_types").insert({ title });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Added", description: `${title} created.` });
      setNewTitle("");
      fetchTypes();
    }
  };

  const deleteType = async (id: string) => {
    const { error } = await supa.from("process_vault_types").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Vault type removed." });
      fetchTypes();
    }
  };

  if (!user || !isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <AdminTopNav title="Process Vault Types" />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <section>
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Defaults visible to all clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder="New default (e.g., TRAINING)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                <Button onClick={addType}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Current Defaults</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : types.length === 0 ? (
                <div className="text-muted-foreground">No defaults yet.</div>
              ) : (
                <ul className="divide-y">
                  {types.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-3">
                      <span className="font-medium">{t.title}</span>
                      <Button variant="outline" size="sm" onClick={() => deleteType(t.id)}>
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default AdminProcessVaultTypes;
