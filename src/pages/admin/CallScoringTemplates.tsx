import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight, Globe, Building, Search, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface CallScoringTemplate {
  id: string;
  name: string;
  system_prompt: string;
  skill_categories: string[];
  is_active: boolean;
  is_global: boolean;
  agency_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Agency {
  id: string;
  name: string;
}

export default function CallScoringTemplates() {
  const [templates, setTemplates] = useState<CallScoringTemplate[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CallScoringTemplate | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Search/Filter/Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'global' | 'agency'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'agency'>('name');
  
  const [formData, setFormData] = useState({
    name: '',
    system_prompt: '',
    skill_categories: 'Rapport, Discovery, Coverage, Closing, Cross-Sell',
    is_global: true,
    agency_id: null as string | null
  });

  useEffect(() => {
    fetchTemplates();
    fetchAgencies();
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
      const parsed = (data || []).map(t => ({
        ...t,
        skill_categories: Array.isArray(t.skill_categories) 
          ? t.skill_categories 
          : typeof t.skill_categories === 'string'
            ? JSON.parse(t.skill_categories)
            : [],
        is_global: t.is_global || false,
        agency_id: t.agency_id || null
      }));
      setTemplates(parsed);
    }
    setLoading(false);
  };

  const fetchAgencies = async () => {
    const { data } = await supabase
      .from('agencies')
      .select('id, name')
      .order('name');
    setAgencies(data || []);
  };

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let result = templates;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) ||
        agencies.find(a => a.id === t.agency_id)?.name.toLowerCase().includes(query)
      );
    }
    
    // Type filter
    if (filterType === 'global') {
      result = result.filter(t => t.is_global);
    } else if (filterType === 'agency') {
      result = result.filter(t => !t.is_global && t.agency_id);
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'created_at') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'agency') {
        const aName = a.is_global ? 'AAA_Global' : (agencies.find(ag => ag.id === a.agency_id)?.name || 'ZZZ');
        const bName = b.is_global ? 'AAA_Global' : (agencies.find(ag => ag.id === b.agency_id)?.name || 'ZZZ');
        return aName.localeCompare(bName);
      }
      return 0;
    });
    
    return result;
  }, [templates, searchQuery, filterType, sortBy, agencies]);

  const getAgencyName = (agencyId: string | null) => {
    if (!agencyId) return null;
    return agencies.find(a => a.id === agencyId)?.name || 'Unknown Agency';
  };

  const handleEdit = (template: CallScoringTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      system_prompt: template.system_prompt,
      skill_categories: Array.isArray(template.skill_categories) 
        ? template.skill_categories.join(', ') 
        : '',
      is_global: template.is_global || false,
      agency_id: template.agency_id
    });
    setEditDialogOpen(true);
  };

  const handleDeploymentChange = (type: 'global' | 'agency') => {
    if (type === 'global') {
      setFormData({ ...formData, is_global: true, agency_id: null });
    } else {
      setFormData({ ...formData, is_global: false });
    }
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
    if (!formData.is_global && !formData.agency_id) {
      toast.error('Please select an agency or mark as global');
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
        system_prompt: formData.system_prompt,
        skill_categories: skillsArray,
        is_global: formData.is_global,
        agency_id: formData.is_global ? null : formData.agency_id,
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

  const handleDuplicate = async (template: CallScoringTemplate) => {
    const newName = `${template.name} (Copy)`;
    
    const { error } = await supabase
      .from('call_scoring_templates')
      .insert({
        name: newName,
        system_prompt: template.system_prompt,
        skill_categories: template.skill_categories,
        is_global: false,
        agency_id: null,
        is_active: true,
      });
    
    if (error) {
      toast.error('Failed to duplicate template');
      console.error(error);
    } else {
      toast.success('Template duplicated! Edit it to assign to an agency.');
      fetchTemplates();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      system_prompt: '',
      skill_categories: 'Rapport, Discovery, Coverage, Closing, Cross-Sell',
      is_global: true,
      agency_id: null
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
    if (!formData.is_global && !formData.agency_id) {
      toast.error('Please select an agency or mark as global');
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
        system_prompt: formData.system_prompt.trim(),
        skill_categories: skillsArray,
        is_active: true,
        is_global: formData.is_global,
        agency_id: formData.is_global ? null : formData.agency_id
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

  const TemplateAssignmentSection = () => (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Template Assignment</Label>
      
      <RadioGroup 
        value={formData.is_global ? 'global' : 'agency'}
        onValueChange={(v) => handleDeploymentChange(v as 'global' | 'agency')}
      >
        <div className="flex items-start space-x-2 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
          <RadioGroupItem value="global" id="deploy-global" className="mt-1" />
          <Label htmlFor="deploy-global" className="flex-1 cursor-pointer">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-green-500" />
              <span className="font-medium">Global Template</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Available to all agencies with call scoring enabled
            </p>
          </Label>
        </div>
        
        <div className="flex items-start space-x-2 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
          <RadioGroupItem value="agency" id="deploy-agency" className="mt-1" />
          <Label htmlFor="deploy-agency" className="flex-1 cursor-pointer">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Specific Agency</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Only available to the selected agency
            </p>
          </Label>
        </div>
      </RadioGroup>
      
      {!formData.is_global && (
        <div className="ml-6 mt-3">
          <Label htmlFor="agency_select">Select Agency</Label>
          <Select 
            value={formData.agency_id || ''} 
            onValueChange={(v) => setFormData({ ...formData, agency_id: v })}
          >
            <SelectTrigger id="agency_select" className="mt-1">
              <SelectValue placeholder="Choose an agency..." />
            </SelectTrigger>
            <SelectContent>
              {agencies.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

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
          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates or agency names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterType} onValueChange={(v) => setFilterType(v as 'all' | 'global' | 'agency')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Templates</SelectItem>
                <SelectItem value="global">Global Only</SelectItem>
                <SelectItem value="agency">Agency-Specific</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'created_at' | 'agency')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="agency">Agency</SelectItem>
                <SelectItem value="created_at">Date Created</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <p className="text-sm text-muted-foreground mb-4">
            Showing {filteredTemplates.length} of {templates.length} templates
          </p>

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
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No templates match your search</p>
              <Button variant="link" onClick={() => { setSearchQuery(''); setFilterType('all'); }}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">{template.name}</h3>
                          {template.is_global ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 shrink-0">
                              <Globe className="h-3 w-3 mr-1" />
                              Global
                            </Badge>
                          ) : template.agency_id ? (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 shrink-0">
                              <Building className="h-3 w-3 mr-1" />
                              {getAgencyName(template.agency_id)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground shrink-0">
                              Unassigned
                            </Badge>
                          )}
                          {!template.is_active && (
                            <Badge variant="outline" className="text-red-400 border-red-400/30 shrink-0">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Created {new Date(template.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(template)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDuplicate(template)} title="Duplicate">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
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
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDelete(template)}
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
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
            
            <TemplateAssignmentSection />
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
            
            <TemplateAssignmentSection />
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
