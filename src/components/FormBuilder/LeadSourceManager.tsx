import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, X, GripVertical } from "lucide-react";

interface LeadSource {
  id: string;
  name: string;
  is_active: boolean;
  order_index: number;
}

interface LeadSourceManagerProps {
  leadSources: LeadSource[];
  onUpdateLeadSources: (sources: LeadSource[]) => void;
}

export default function LeadSourceManager({ 
  leadSources, 
  onUpdateLeadSources 
}: LeadSourceManagerProps) {
  const [newSourceName, setNewSourceName] = useState("");

  const addLeadSource = () => {
    if (!newSourceName.trim()) return;
    
    const newSource: LeadSource = {
      id: crypto.randomUUID(),
      name: newSourceName.trim(),
      is_active: true,
      order_index: leadSources.length
    };
    
    onUpdateLeadSources([...leadSources, newSource]);
    setNewSourceName("");
  };

  const removeLeadSource = (id: string) => {
    onUpdateLeadSources(leadSources.filter(source => source.id !== id));
  };

  const updateLeadSource = (id: string, updates: Partial<LeadSource>) => {
    onUpdateLeadSources(
      leadSources.map(source => 
        source.id === id ? { ...source, ...updates } : source
      )
    );
  };

  const moveLeadSource = (id: string, direction: 'up' | 'down') => {
    const index = leadSources.findIndex(s => s.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= leadSources.length) return;
    
    const newSources = [...leadSources];
    [newSources[index], newSources[newIndex]] = [newSources[newIndex], newSources[index]];
    
    // Update order indices
    newSources.forEach((source, idx) => {
      source.order_index = idx;
    });
    
    onUpdateLeadSources(newSources);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Source Configuration</CardTitle>
        <CardDescription>
          Manage the lead sources available in your forms
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new lead source */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="new-source">Add Lead Source</Label>
            <Input
              id="new-source"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              placeholder="e.g., Website, Referral, Cold Call"
              onKeyPress={(e) => e.key === 'Enter' && addLeadSource()}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={addLeadSource} disabled={!newSourceName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Existing lead sources */}
        <div className="space-y-2">
          {leadSources.map((source, index) => (
            <div key={source.id} className="flex items-center gap-2 p-2 border rounded-lg">
              <div className="cursor-move">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              
              <div className="flex-1">
                <Input
                  value={source.name}
                  onChange={(e) => updateLeadSource(source.id, { name: e.target.value })}
                  className="border-none p-0 h-auto focus-visible:ring-0"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`active-${source.id}`} className="text-sm">
                    Active
                  </Label>
                  <Switch
                    id={`active-${source.id}`}
                    checked={source.is_active}
                    onCheckedChange={(checked) => 
                      updateLeadSource(source.id, { is_active: checked })
                    }
                  />
                </div>

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveLeadSource(source.id, 'up')}
                    disabled={index === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveLeadSource(source.id, 'down')}
                    disabled={index === leadSources.length - 1}
                  >
                    ↓
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLeadSource(source.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          
          {leadSources.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No lead sources configured. Add one above to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
