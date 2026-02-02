import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Edit,
  Save,
  Bot,
  Code,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface AIPrompt {
  id: string;
  prompt_key: string;
  prompt_name: string;
  prompt_template: string;
  model_preference: string;
  description: string | null;
  updated_at: string;
}

const modelOptions = [
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku (Fast, Cost-effective)' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet (Balanced)' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus (Most Capable)' },
];

export function SEPromptsTab() {
  const queryClient = useQueryClient();
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch prompts
  const { data: prompts, isLoading } = useQuery({
    queryKey: ['admin-se-prompts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_ai_prompts')
        .select('*')
        .order('prompt_name', { ascending: true });

      if (error) throw error;
      return data as AIPrompt[];
    },
  });

  // Update prompt mutation
  const updatePrompt = useMutation({
    mutationFn: async (prompt: Partial<AIPrompt> & { id: string }) => {
      const { id, ...updates } = prompt;
      const { error } = await supabase
        .from('sales_experience_ai_prompts')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-se-prompts'] });
      setIsEditDialogOpen(false);
      setEditingPrompt(null);
      toast.success('AI prompt updated successfully');
    },
    onError: (error) => {
      console.error('Error updating prompt:', error);
      toast.error('Failed to update AI prompt');
    },
  });

  const handleEditPrompt = (prompt: AIPrompt) => {
    setEditingPrompt({ ...prompt });
    setIsEditDialogOpen(true);
  };

  const handleSavePrompt = () => {
    if (!editingPrompt) return;
    updatePrompt.mutate(editingPrompt);
  };

  // Extract variables from template
  const extractVariables = (template: string): string[] => {
    const matches = template.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
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
        <h2 className="text-xl font-semibold">AI Prompt Management</h2>
        <p className="text-sm text-muted-foreground">
          Customize the AI prompts used for transcript summaries, quiz feedback, and deliverable builders
        </p>
      </div>

      <div className="grid gap-4">
        {prompts?.map((prompt) => {
          const variables = extractVariables(prompt.prompt_template);
          return (
            <Card key={prompt.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{prompt.prompt_name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Code className="h-3 w-3" />
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {prompt.prompt_key}
                        </code>
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleEditPrompt(prompt)}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {prompt.description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {prompt.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {modelOptions.find((m) => m.value === prompt.model_preference)?.label ||
                      prompt.model_preference}
                  </Badge>
                  {variables.length > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground">Variables:</span>
                      {variables.map((v) => (
                        <Badge key={v} variant="outline" className="text-xs font-mono">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </>
                  )}
                </div>
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap line-clamp-4">
                    {prompt.prompt_template}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(!prompts || prompts.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No AI Prompts Configured</h3>
              <p className="text-sm text-muted-foreground">
                AI prompts will be seeded from the database migration.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Prompt Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit AI Prompt</DialogTitle>
            <DialogDescription>
              Customize the prompt template and model settings
            </DialogDescription>
          </DialogHeader>
          {editingPrompt && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Prompt Name</Label>
                <Input
                  value={editingPrompt.prompt_name}
                  onChange={(e) =>
                    setEditingPrompt({ ...editingPrompt, prompt_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Prompt Key</Label>
                <Input
                  value={editingPrompt.prompt_key}
                  disabled
                  className="font-mono bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  The key is used to reference this prompt in code and cannot be changed.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Model Preference</Label>
                <Select
                  value={editingPrompt.model_preference}
                  onValueChange={(value) =>
                    setEditingPrompt({ ...editingPrompt, model_preference: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingPrompt.description || ''}
                  onChange={(e) =>
                    setEditingPrompt({ ...editingPrompt, description: e.target.value })
                  }
                  rows={2}
                  placeholder="Brief description of what this prompt does..."
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Prompt Template</Label>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Info className="h-3 w-3" />
                    Use {`{{variable}}`} syntax for dynamic values
                  </div>
                </div>
                <Textarea
                  value={editingPrompt.prompt_template}
                  onChange={(e) =>
                    setEditingPrompt({ ...editingPrompt, prompt_template: e.target.value })
                  }
                  rows={12}
                  className="font-mono text-sm"
                  placeholder="Enter the prompt template..."
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Detected variables:</span>
                  {extractVariables(editingPrompt.prompt_template).map((v) => (
                    <Badge key={v} variant="secondary" className="text-xs font-mono">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                  {extractVariables(editingPrompt.prompt_template).length === 0 && (
                    <span className="text-xs text-muted-foreground italic">None</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePrompt}
              disabled={updatePrompt.isPending}
              className="gap-2"
            >
              {updatePrompt.isPending ? (
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
