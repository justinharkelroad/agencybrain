import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Phone, Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';

interface CallScoringTemplate {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  skill_categories: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function CallScoringTemplates() {
  const [templates, setTemplates] = useState<CallScoringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CallScoringTemplate | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
    skill_categories: 'Rapport, Discovery, Coverage, Closing, Cross-Sell'
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('call_scoring_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Failed to load templates');
      console.error(error);
    } else {
      // Parse skill_categories from Json to string[]
      const parsed = (data || []).map(t => ({
        ...t,
        skill_categories: Array.isArray(t.skill_categories) 
          ? t.skill_categories 
          : typeof t.skill_categories === 'string'
            ? JSON.parse(t.skill_categories)
            : []
      }));
      setTemplates(parsed);
    }
    setLoading(false);
  };

  const handleEdit = (template: CallScoringTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      system_prompt: template.system_prompt,
      skill_categories: Array.isArray(template.skill_categories) 
        ? template.skill_categories.join(', ') 
        : ''
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.system_prompt.trim()) {
      toast.error('System prompt is required');
      return;
    }
    
    setSaving(true);
    const skillsArray = formData.skill_categories
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const { error } = await supabase
      .from('call_scoring_templates')
      .update({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        system_prompt: formData.system_prompt,
        skill_categories: skillsArray,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingTemplate.id);

    setSaving(false);
    if (error) {
      toast.error('Failed to update template');
      console.error(error);
    } else {
      toast.success('Template updated');
      setEditDialogOpen(false);
      setEditingTemplate(null);
      fetchTemplates();
    }
  };

  const handleToggleActive = async (template: CallScoringTemplate) => {
    const newStatus = !template.is_active;
    const { error } = await supabase
      .from('call_scoring_templates')
      .update({ 
        is_active: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', template.id);

    if (error) {
      toast.error('Failed to update status');
      console.error(error);
    } else {
      toast.success(`Template ${newStatus ? 'activated' : 'deactivated'}`);
      fetchTemplates();
    }
  };

  const handleDelete = async (template: CallScoringTemplate) => {
    if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) return;

    // Check if template is used by any calls
    const { count, error: countError } = await supabase
      .from('agency_calls')
      .select('*', { count: 'exact', head: true })
      .eq('template_id', template.id);

    if (countError) {
      toast.error('Failed to check template usage');
      console.error(countError);
      return;
    }

    if (count && count > 0) {
      toast.error(`Cannot delete - template is used by ${count} call(s). Deactivate instead.`);
      return;
    }

    const { error } = await supabase
      .from('call_scoring_templates')
      .delete()
      .eq('id', template.id);

    if (error) {
      toast.error('Failed to delete template');
      console.error(error);
    } else {
      toast.success('Template deleted');
      fetchTemplates();
    }
  };

  const truncateText = (text: string | null, maxLength: number) => {
    if (!text) return '—';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      system_prompt: '',
      skill_categories: 'Rapport, Discovery, Coverage, Closing, Cross-Sell'
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.system_prompt.trim()) {
      toast.error('System Prompt is required');
      return;
    }

    const skillsArray = formData.skill_categories
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (skillsArray.length === 0) {
      toast.error('At least one skill category is required');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('call_scoring_templates')
      .insert({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        system_prompt: formData.system_prompt.trim(),
        skill_categories: skillsArray,
        is_active: true
      });

    setSaving(false);
    if (error) {
      toast.error('Failed to create template');
      console.error(error);
    } else {
      toast.success('Template created');
      setCreateDialogOpen(false);
      resetForm();
      fetchTemplates();
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Scoring Templates
            </CardTitle>
            <CardDescription>
              Manage AI prompts used for analyzing sales calls
            </CardDescription>
          </div>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Add Template
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No templates found</p>
              <p className="text-sm text-muted-foreground/70">Create your first scoring template to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Skill Categories</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {truncateText(template.description, 50)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {template.skill_categories.slice(0, 3).map((skill, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {template.skill_categories.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.skill_categories.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.is_active ? 'default' : 'secondary'}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(template)}
                            title="Edit template"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(template)}
                            title={template.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {template.is_active ? (
                              <ToggleRight className="h-4 w-4 text-primary" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(template)}
                            title="Delete template"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Template name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this template"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-system_prompt">System Prompt *</Label>
              <Textarea
                id="edit-system_prompt"
                value={formData.system_prompt}
                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                placeholder="AI system prompt for analyzing calls..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-skill_categories">Skill Categories</Label>
              <Input
                id="edit-skill_categories"
                value={formData.skill_categories}
                onChange={(e) => setFormData({ ...formData, skill_categories: e.target.value })}
                placeholder="Rapport, Discovery, Coverage, Closing, Cross-Sell"
              />
              <p className="text-xs text-muted-foreground">Comma-separated list of skills to score</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Scoring Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Insurance Sales Review"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of when to use this template"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-prompt">System Prompt *</Label>
              <Textarea
                id="create-prompt"
                value={formData.system_prompt}
                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                placeholder="Enter the AI prompt that will analyze call transcripts..."
                className="font-mono text-sm"
                rows={12}
              />
              <p className="text-xs text-muted-foreground">
                This prompt instructs the AI how to analyze and score sales calls.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-skills">Skill Categories</Label>
              <Input
                id="create-skills"
                value={formData.skill_categories}
                onChange={(e) => setFormData({ ...formData, skill_categories: e.target.value })}
                placeholder="Rapport, Discovery, Coverage, Closing, Cross-Sell"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of skills to score (e.g., Rapport, Discovery, Closing)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
