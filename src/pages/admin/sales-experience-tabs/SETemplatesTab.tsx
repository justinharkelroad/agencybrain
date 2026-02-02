import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Loader2,
  Edit,
  Save,
  Mail,
  Code,
  Eye,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  subject_template: string;
  body_template: string;
  variables_available: string[];
  is_active: boolean;
  updated_at: string;
}

export function SETemplatesTab() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['admin-se-email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_email_templates')
        .select('*')
        .order('template_name', { ascending: true });

      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  // Update template mutation
  const updateTemplate = useMutation({
    mutationFn: async (template: Partial<EmailTemplate> & { id: string }) => {
      const { id, ...updates } = template;
      const { error } = await supabase
        .from('sales_experience_email_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-se-email-templates'] });
      setIsEditDialogOpen(false);
      setEditingTemplate(null);
      toast.success('Email template updated successfully');
    },
    onError: (error) => {
      console.error('Error updating template:', error);
      toast.error('Failed to update email template');
    },
  });

  // Toggle active status
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('sales_experience_email_templates')
        .update({
          is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-se-email-templates'] });
      toast.success('Template status updated');
    },
    onError: (error) => {
      console.error('Error toggling template:', error);
      toast.error('Failed to update template status');
    },
  });

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate({ ...template });
    setPreviewTab('edit');
    setIsEditDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    updateTemplate.mutate(editingTemplate);
  };

  // Generate preview HTML with sample data
  const generatePreview = (template: EmailTemplate) => {
    const sampleData: Record<string, string> = {
      staff_name: 'John Smith',
      lesson_title: 'Mastering Discovery Calls',
      week_number: '2',
      day_name: 'Wednesday',
      lesson_url: '#',
      score: '85',
      score_color: '#22c55e',
      feedback_ai: 'Great job on identifying customer needs! Consider asking more open-ended questions.',
      owner_name: 'Jane Owner',
      agency_name: 'Example Insurance Agency',
    };

    let html = template.body_template;
    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    });
    // Remove any remaining template tags for cleaner preview
    html = html.replace(/\{\{#if[^}]*\}\}/g, '');
    html = html.replace(/\{\{\/if\}\}/g, '');
    return html;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Email Template Management</h2>
        <p className="text-sm text-muted-foreground">
          Customize email templates for notifications and updates
        </p>
      </div>

      <div className="grid gap-4">
        {templates?.map((template) => (
          <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {template.template_name}
                      {!template.is_active && (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Code className="h-3 w-3" />
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {template.template_key}
                      </code>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={template.is_active}
                    onCheckedChange={(checked) =>
                      toggleActive.mutate({ id: template.id, is_active: checked })
                    }
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleEditTemplate(template)}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <p className="text-sm font-medium">{template.subject_template}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Available variables:</span>
                  {template.variables_available.map((v) => (
                    <Badge key={v} variant="outline" className="text-xs font-mono">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!templates || templates.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Email Templates Configured</h3>
              <p className="text-sm text-muted-foreground">
                Email templates will be seeded from the database migration.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Template Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
            <DialogDescription>
              Customize the email subject and body content
            </DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    value={editingTemplate.template_name}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, template_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Template Key</Label>
                  <Input
                    value={editingTemplate.template_key}
                    disabled
                    className="font-mono bg-muted"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  value={editingTemplate.subject_template}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, subject_template: e.target.value })
                  }
                  placeholder="Email subject with {{variables}}"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Available Variables</Label>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Info className="h-3 w-3" />
                    Use {`{{variable}}`} syntax in subject and body
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                  {editingTemplate.variables_available.map((v) => (
                    <Badge key={v} variant="secondary" className="text-xs font-mono cursor-pointer hover:bg-secondary/80"
                      onClick={() => {
                        navigator.clipboard.writeText(`{{${v}}}`);
                        toast.success(`Copied {{${v}}} to clipboard`);
                      }}
                    >
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>

              <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as 'edit' | 'preview')}>
                <TabsList>
                  <TabsTrigger value="edit" className="gap-2">
                    <Code className="h-4 w-4" />
                    HTML Source
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="mt-4">
                  <div className="space-y-2">
                    <Label>Email Body (HTML)</Label>
                    <Textarea
                      value={editingTemplate.body_template}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, body_template: e.target.value })
                      }
                      rows={16}
                      className="font-mono text-sm"
                      placeholder="Enter HTML email template..."
                    />
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="mt-4">
                  <div className="space-y-2">
                    <Label>Email Preview (with sample data)</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-muted px-4 py-2 border-b">
                        <p className="text-sm">
                          <span className="text-muted-foreground">Subject:</span>{' '}
                          <span className="font-medium">
                            {editingTemplate.subject_template
                              .replace(/\{\{staff_name\}\}/g, 'John Smith')
                              .replace(/\{\{lesson_title\}\}/g, 'Mastering Discovery Calls')
                              .replace(/\{\{week_number\}\}/g, '2')
                              .replace(/\{\{score\}\}/g, '85')}
                          </span>
                        </p>
                      </div>
                      <div
                        className="p-4 bg-white min-h-[300px]"
                        dangerouslySetInnerHTML={{ __html: generatePreview(editingTemplate) }}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-0.5">
                  <Label>Template Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Inactive templates will not send emails
                  </p>
                </div>
                <Switch
                  checked={editingTemplate.is_active}
                  onCheckedChange={(checked) =>
                    setEditingTemplate({ ...editingTemplate, is_active: checked })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={updateTemplate.isPending}
              className="gap-2"
            >
              {updateTemplate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
