import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface LeadSource {
  id: string;
  name: string;
  is_active: boolean;
  order_index: number;
}

interface LeadSourceManagerProps {
  agencyId: string;
}

export function LeadSourceManager({ agencyId }: LeadSourceManagerProps) {
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [newSourceName, setNewSourceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Fetch lead sources on mount
  useEffect(() => {
    const fetchLeadSources = async () => {
      if (!agencyId) return;
      
      setInitialLoading(true);
      try {
        const { data, error } = await supabase
          .from('lead_sources')
          .select('id, name, is_active, order_index')
          .eq('agency_id', agencyId)
          .order('order_index', { ascending: true });

        if (error) throw error;
        setLeadSources(data || []);
      } catch (error: any) {
        console.error('Error fetching lead sources:', error);
        toast.error('Failed to load lead sources');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchLeadSources();
  }, [agencyId]);

  const addLeadSource = async () => {
    if (!newSourceName.trim() || !agencyId) return;

    setLoading(true);
    try {
      const maxOrder = leadSources.length > 0 
        ? Math.max(...leadSources.map(s => s.order_index)) 
        : 0;
      
      const { data, error } = await supabase
        .from('lead_sources')
        .insert({
          agency_id: agencyId,
          name: newSourceName.trim(),
          is_active: true,
          order_index: maxOrder + 1
        })
        .select()
        .single();

      if (error) throw error;

      setLeadSources([...leadSources, data]);
      setNewSourceName("");
      toast.success("Lead source added");
    } catch (error: any) {
      console.error('Error adding lead source:', error);
      toast.error('Failed to add lead source');
    } finally {
      setLoading(false);
    }
  };

  const removeLeadSource = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('lead_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLeadSources(leadSources.filter(source => source.id !== id));
      toast.success("Lead source removed");
    } catch (error: any) {
      console.error('Error removing lead source:', error);
      toast.error('Failed to remove lead source');
    } finally {
      setLoading(false);
    }
  };

  const updateLeadSource = async (id: string, updates: Partial<LeadSource>) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('lead_sources')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setLeadSources(
        leadSources.map(source =>
          source.id === id ? { ...source, ...updates } : source
        )
      );
      toast.success("Lead source updated");
    } catch (error: any) {
      console.error('Error updating lead source:', error);
      toast.error('Failed to update lead source');
    } finally {
      setLoading(false);
    }
  };

  const moveLeadSource = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = leadSources.findIndex(s => s.id === id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= leadSources.length) return;

    const newSources = [...leadSources];
    [newSources[currentIndex], newSources[newIndex]] = [newSources[newIndex], newSources[currentIndex]];
    
    // Update order_index values
    newSources.forEach((source, index) => {
      source.order_index = index + 1;
    });

    // Optimistic update
    setLeadSources(newSources);

    // Update in database
    setLoading(true);
    try {
      for (const source of newSources) {
        const { error } = await supabase
          .from('lead_sources')
          .update({ order_index: source.order_index })
          .eq('id', source.id);
        
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error updating lead source order:', error);
      toast.error('Failed to update order');
      // Refetch on error
      const { data } = await supabase
        .from('lead_sources')
        .select('id, name, is_active, order_index')
        .eq('agency_id', agencyId)
        .order('order_index', { ascending: true });
      if (data) setLeadSources(data);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add new lead source */}
      <div className="flex gap-2">
        <Input
          placeholder="Enter lead source name..."
          value={newSourceName}
          onChange={(e) => setNewSourceName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addLeadSource()}
          disabled={loading}
        />
        <Button 
          onClick={addLeadSource} 
          disabled={!newSourceName.trim() || loading}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Lead sources list */}
      <div className="space-y-2">
        {leadSources.length > 0 ? (
          leadSources
            .sort((a, b) => a.order_index - b.order_index)
            .map((source, index) => (
              <div 
                key={source.id} 
                className="flex items-center gap-3 p-3 border border-border/10 rounded-lg bg-card/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{source.name}</span>
                    {!source.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={source.is_active}
                    onCheckedChange={(checked) => 
                      updateLeadSource(source.id, { is_active: checked })
                    }
                    disabled={loading}
                  />
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveLeadSource(source.id, 'up')}
                    disabled={index === 0 || loading}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveLeadSource(source.id, 'down')}
                    disabled={index === leadSources.length - 1 || loading}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLeadSource(source.id)}
                    disabled={loading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No lead sources configured yet.</p>
            <p className="text-sm">Add your first lead source above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
