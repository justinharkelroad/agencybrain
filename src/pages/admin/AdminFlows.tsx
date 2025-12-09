import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { FlowTemplate } from '@/types/flows';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Copy,
  GripVertical,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export default function AdminFlows() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<FlowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flow_templates')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      // Parse questions_json for each template
      const parsed = (data || []).map(t => ({
        ...t,
        questions_json: typeof t.questions_json === 'string' 
          ? JSON.parse(t.questions_json) 
          : t.questions_json
      }));
      
      setTemplates(parsed);
    } catch (err) {
      console.error('Error fetching templates:', err);
      toast({
        title: 'Error loading templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (template: FlowTemplate) => {
    try {
      const { error } = await supabase
        .from('flow_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (error) throw error;

      setTemplates(prev => 
        prev.map(t => t.id === template.id ? { ...t, is_active: !t.is_active } : t)
      );
      
      toast({
        title: `${template.name} ${!template.is_active ? 'enabled' : 'disabled'}`,
      });
    } catch (err) {
      console.error('Error toggling template:', err);
      toast({
        title: 'Error updating template',
        variant: 'destructive',
      });
    }
  };

  const duplicateTemplate = async (template: FlowTemplate) => {
    try {
      const newTemplate = {
        name: `${template.name} (Copy)`,
        slug: `${template.slug}-copy-${Date.now()}`,
        description: template.description,
        icon: template.icon,
        color: template.color,
        questions_json: template.questions_json,
        ai_challenge_enabled: template.ai_challenge_enabled,
        ai_challenge_intensity: template.ai_challenge_intensity,
        ai_analysis_prompt: template.ai_analysis_prompt,
        is_active: false,
        display_order: templates.length + 1,
      };

      const { data, error } = await supabase
        .from('flow_templates')
        .insert(newTemplate)
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => [...prev, {
        ...data,
        questions_json: typeof data.questions_json === 'string'
          ? JSON.parse(data.questions_json)
          : data.questions_json
      }]);
      
      toast({
        title: 'Template duplicated',
        description: 'Edit the copy to customize it.',
      });
    } catch (err) {
      console.error('Error duplicating template:', err);
      toast({
        title: 'Error duplicating template',
        variant: 'destructive',
      });
    }
  };

  const deleteTemplate = async () => {
    if (!deleteId) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('flow_templates')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== deleteId));
      
      toast({
        title: 'Template deleted',
      });
    } catch (err) {
      console.error('Error deleting template:', err);
      toast({
        title: 'Error deleting template',
        description: 'Templates with existing sessions cannot be deleted.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium flex items-center gap-2">
            <Sparkles className="h-6 w-6" strokeWidth={1.5} />
            Flow Templates
          </h1>
          <p className="text-muted-foreground/70 mt-1">
            Create and manage guided reflection flows
          </p>
        </div>
        
        <Button onClick={() => navigate('/admin/flows/new')}>
          <Plus className="h-4 w-4 mr-2" strokeWidth={1.5} />
          New Template
        </Button>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" strokeWidth={1} />
            <h3 className="font-medium mb-2">No templates yet</h3>
            <p className="text-sm text-muted-foreground/70 mb-4">
              Create your first flow template to get started.
            </p>
            <Button onClick={() => navigate('/admin/flows/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <Card 
              key={template.id}
              className={`transition-opacity ${!template.is_active ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Drag Handle (for future drag-and-drop) */}
                  <div className="text-muted-foreground/40 cursor-grab">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  
                  {/* Icon */}
                  <div className="text-3xl w-12 text-center">
                    {template.icon || '📝'}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{template.name}</h3>
                      {!template.is_active && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground/70 truncate">
                      {template.description || 'No description'}
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-1">
                      {(template.questions_json as any[])?.length || 0} questions • 
                      slug: {template.slug}
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={() => toggleActive(template)}
                    />
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/admin/flows/edit/${template.id}`)}
                    >
                      <Pencil className="h-4 w-4" strokeWidth={1.5} />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => duplicateTemplate(template)}
                    >
                      <Copy className="h-4 w-4" strokeWidth={1.5} />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(template.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Note */}
      <div className="mt-6 flex items-start gap-2 text-sm text-muted-foreground/70">
        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>
          Disabled templates won't appear in the Flows hub for users. 
          Templates with existing user sessions cannot be deleted.
        </p>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the flow template. 
              Templates with existing user sessions cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteTemplate}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Template'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
