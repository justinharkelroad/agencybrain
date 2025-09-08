import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

interface TemplateItem {
  id: string;
  agency_id: string;
  label: string; // Changed from title to label to match database
  active: boolean;
  order_index: number;
}

export function AgencyTemplatesManager() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchAgencyId();
    }
  }, [user]);

  useEffect(() => {
    if (agencyId) {
      fetchTemplates();
    }
  }, [agencyId]);

  const fetchAgencyId = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();
      
      if (profile?.agency_id) {
        setAgencyId(profile.agency_id);
      }
    } catch (error) {
      console.error('Error fetching agency ID:', error);
    }
  };

  const fetchTemplates = async () => {
    if (!agencyId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('checklist_template_items')
        .select('*')
        .eq('agency_id', agencyId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const addTemplate = async () => {
    if (!newItemTitle.trim() || !agencyId) return;

    setLoading(true);
    try {
      const maxOrder = Math.max(...templates.map(t => t.order_index), 0);
      
      const { data, error } = await supabase
        .from('checklist_template_items')
        .insert({
          agency_id: agencyId,
          label: newItemTitle.trim(), // Changed from 'title' to 'label'
          active: true,
          order_index: maxOrder + 1
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates([...templates, data]);
      setNewItemTitle('');
      toast.success('Template item added successfully');
    } catch (error: any) {
      console.error('Error adding template:', error);
      toast.error('Failed to add template item');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, desired: boolean) => {
    const t = templates.find(template => template.id === id);
    if (!t) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("checklist_template_items").update({ active: desired }).eq("id", t.id);
      if (error) throw error;

      setTemplates(templates.map(template =>
        template.id === id ? { ...template, active: desired } : template
      ));
      toast.success(`Template ${desired ? 'activated' : 'deactivated'}`);
    } catch (error: any) {
      console.error('Error toggling template:', error);
      toast.error('Failed to update template');
    } finally {
      setLoading(false);
    }
  };

  const moveTemplate = async (template: TemplateItem, direction: 'up' | 'down') => {
    const sortedTemplates = [...templates].sort((a, b) => a.order_index - b.order_index);
    const currentIndex = sortedTemplates.findIndex(t => t.id === template.id);
    
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === sortedTemplates.length - 1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetTemplate = sortedTemplates[targetIndex];
    
    setLoading(true);
    try {
      const { error } = await supabase.from("checklist_template_items").update({ order_index: targetTemplate.order_index }).eq("id", template.id);
      if (error) throw error;

      await fetchTemplates();
      toast.success('Template order updated');
    } catch (error: any) {
      console.error('Error moving template:', error);
      toast.error('Failed to update template order');
    } finally {
      setLoading(false);
    }
  };

  const removeTemplate = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('checklist_template_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTemplates(templates.filter(template => template.id !== id));
      toast.success('Template item removed successfully');
    } catch (error: any) {
      console.error('Error removing template:', error);
      toast.error('Failed to remove template item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agency Checklist Templates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new template */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter template item title..."
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTemplate()}
            disabled={loading}
          />
          <Button 
            onClick={addTemplate} 
            disabled={!newItemTitle.trim() || loading}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {/* Templates list */}
        <div className="space-y-2">
          {templates.length > 0 ? (
            templates
              .sort((a, b) => a.order_index - b.order_index)
              .map((template, index) => (
                <div 
                  key={template.id} 
                  className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{template.label}</span>
                      {!template.active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={template.active}
                      onCheckedChange={(checked) => toggleActive(template.id, checked)}
                      disabled={loading}
                    />
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveTemplate(template, 'up')}
                      disabled={index === 0 || loading}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveTemplate(template, 'down')}
                      disabled={index === templates.length - 1 || loading}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTemplate(template.id)}
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
              <p>No template items configured yet.</p>
              <p className="text-sm">Add your first template item above.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}