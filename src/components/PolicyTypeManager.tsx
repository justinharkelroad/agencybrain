import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface PolicyType {
  id: string;
  name: string;
  is_active: boolean;
  order_index: number;
}

interface PolicyTypeManagerProps {
  agencyId: string;
}

export function PolicyTypeManager({ agencyId }: PolicyTypeManagerProps) {
  const [policyTypes, setPolicyTypes] = useState<PolicyType[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Fetch policy types on mount
  useEffect(() => {
    const fetchPolicyTypes = async () => {
      if (!agencyId) return;
      
      setInitialLoading(true);
      try {
        const { data, error } = await supabase
          .from('policy_types')
          .select('id, name, is_active, order_index')
          .eq('agency_id', agencyId)
          .order('order_index', { ascending: true });

        if (error) throw error;
        setPolicyTypes(data || []);
      } catch (error: any) {
        console.error('Error fetching policy types:', error);
        toast.error('Failed to load policy types');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchPolicyTypes();
  }, [agencyId]);

  const addPolicyType = async () => {
    if (!newTypeName.trim() || !agencyId) return;

    setLoading(true);
    try {
      const maxOrder = policyTypes.length > 0 
        ? Math.max(...policyTypes.map(s => s.order_index)) 
        : 0;
      
      const { data, error } = await supabase
        .from('policy_types')
        .insert({
          agency_id: agencyId,
          name: newTypeName.trim(),
          is_active: true,
          order_index: maxOrder + 1
        })
        .select()
        .single();

      if (error) throw error;

      setPolicyTypes([...policyTypes, data]);
      setNewTypeName("");
      toast.success("Policy type added");
    } catch (error: any) {
      console.error('Error adding policy type:', error);
      toast.error('Failed to add policy type');
    } finally {
      setLoading(false);
    }
  };

  const removePolicyType = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('policy_types')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPolicyTypes(policyTypes.filter(type => type.id !== id));
      toast.success("Policy type removed");
    } catch (error: any) {
      console.error('Error removing policy type:', error);
      toast.error('Failed to remove policy type');
    } finally {
      setLoading(false);
    }
  };

  const updatePolicyType = async (id: string, updates: Partial<PolicyType>) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('policy_types')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setPolicyTypes(
        policyTypes.map(type =>
          type.id === id ? { ...type, ...updates } : type
        )
      );
      toast.success("Policy type updated");
    } catch (error: any) {
      console.error('Error updating policy type:', error);
      toast.error('Failed to update policy type');
    } finally {
      setLoading(false);
    }
  };

  const movePolicyType = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = policyTypes.findIndex(s => s.id === id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= policyTypes.length) return;

    const newTypes = [...policyTypes];
    [newTypes[currentIndex], newTypes[newIndex]] = [newTypes[newIndex], newTypes[currentIndex]];
    
    // Update order_index values
    newTypes.forEach((type, index) => {
      type.order_index = index + 1;
    });

    // Optimistic update
    setPolicyTypes(newTypes);

    // Update in database
    setLoading(true);
    try {
      for (const type of newTypes) {
        const { error } = await supabase
          .from('policy_types')
          .update({ order_index: type.order_index })
          .eq('id', type.id);
        
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error updating policy type order:', error);
      toast.error('Failed to update order');
      // Refetch on error
      const { data } = await supabase
        .from('policy_types')
        .select('id, name, is_active, order_index')
        .eq('agency_id', agencyId)
        .order('order_index', { ascending: true });
      if (data) setPolicyTypes(data);
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
      {/* Add new policy type */}
      <div className="flex gap-2">
        <Input
          placeholder="Enter policy type name..."
          value={newTypeName}
          onChange={(e) => setNewTypeName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addPolicyType()}
          disabled={loading}
        />
        <Button 
          onClick={addPolicyType} 
          disabled={!newTypeName.trim() || loading}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Policy types list */}
      <div className="space-y-2">
        {policyTypes.length > 0 ? (
          policyTypes
            .sort((a, b) => a.order_index - b.order_index)
            .map((type, index) => (
              <div 
                key={type.id} 
                className="flex items-center gap-3 p-3 border border-border/10 rounded-lg bg-card/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{type.name}</span>
                    {!type.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={type.is_active}
                    onCheckedChange={(checked) => 
                      updatePolicyType(type.id, { is_active: checked })
                    }
                    disabled={loading}
                  />
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => movePolicyType(type.id, 'up')}
                    disabled={index === 0 || loading}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => movePolicyType(type.id, 'down')}
                    disabled={index === policyTypes.length - 1 || loading}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePolicyType(type.id)}
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
            <p>No policy types configured yet.</p>
            <p className="text-sm">Add your first policy type above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
