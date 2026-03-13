import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, GripVertical, Dumbbell, Heart, Briefcase } from "lucide-react";
import { LatinCross } from "@/components/icons/LatinCross";
import { usePlaybookTags } from "@/hooks/usePlaybookTags";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlaybookDomain } from "@/hooks/useFocusItems";

const domains: { key: PlaybookDomain; label: string; icon: React.ElementType; color: string }[] = [
  { key: "body", label: "Body", icon: Dumbbell, color: "text-emerald-600" },
  { key: "being", label: "Being", icon: LatinCross, color: "text-purple-600" },
  { key: "balance", label: "Balance", icon: Heart, color: "text-rose-600" },
  { key: "business", label: "Business", icon: Briefcase, color: "text-blue-600" },
];

export default function AdminPlaybookTags() {
  const { isAdmin } = useAuth();
  const [agencies, setAgencies] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  const [newTagName, setNewTagName] = useState("");
  const [activeDomain, setActiveDomain] = useState<PlaybookDomain>("body");

  // Fetch all tags (including inactive) for admin
  const { tags, createTag, updateTag, deleteTag } = usePlaybookTags(selectedAgencyId || null, { includeInactive: true });

  // Load agencies for admin
  useEffect(() => {
    async function loadAgencies() {
      const { data } = await supabase
        .from("agencies")
        .select("id, name")
        .order("name");
      if (data) {
        setAgencies(data);
        if (data.length > 0 && !selectedAgencyId) setSelectedAgencyId(data[0].id);
      }
    }
    if (isAdmin) loadAgencies();
  }, [isAdmin]);

  const domainTags = tags.filter((t) => t.domain === activeDomain);

  const handleAddTag = () => {
    if (!newTagName.trim() || !selectedAgencyId) return;
    createTag.mutate({
      agency_id: selectedAgencyId,
      domain: activeDomain,
      name: newTagName.trim(),
      sort_order: domainTags.length,
    });
    setNewTagName("");
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Playbook Sub-Tags</h1>

      {/* Agency selector */}
      <div className="mb-6 max-w-sm">
        <Label>Agency</Label>
        <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
          <SelectTrigger>
            <SelectValue placeholder="Select agency..." />
          </SelectTrigger>
          <SelectContent>
            {agencies.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedAgencyId && (
        <Card>
          <CardHeader>
            <CardTitle>Core Four Domain Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeDomain} onValueChange={(v) => setActiveDomain(v as PlaybookDomain)}>
              <TabsList className="grid grid-cols-4 w-full">
                {domains.map((d) => (
                  <TabsTrigger key={d.key} value={d.key} className="gap-1.5">
                    <d.icon className={`h-4 w-4 ${d.color}`} />
                    {d.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {domains.map((d) => (
                <TabsContent key={d.key} value={d.key} className="mt-4 space-y-4">
                  {/* Add new tag */}
                  <div className="flex gap-2">
                    <Input
                      placeholder={`New ${d.label} sub-tag...`}
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    />
                    <Button onClick={handleAddTag} disabled={!newTagName.trim()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>

                  {/* Tag list */}
                  {domainTags.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No sub-tags for {d.label} yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {domainTags.map((tag) => (
                        <div
                          key={tag.id}
                          className="flex items-center gap-3 rounded-lg border p-3"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                          <span className="flex-1 text-sm font-medium">{tag.name}</span>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={tag.is_active}
                              onCheckedChange={(checked) =>
                                updateTag.mutate({ id: tag.id, updates: { is_active: checked } })
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => deleteTag.mutate(tag.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
