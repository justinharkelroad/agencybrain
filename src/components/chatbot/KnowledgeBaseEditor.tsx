import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface KnowledgeBase {
  id: string;
  version: number;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function KnowledgeBaseEditor() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const { data: knowledgeBase, isLoading } = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_knowledge_base')
        .select('*')
        .eq('is_active', true)
        .single();
      if (error) throw error;
      return data as KnowledgeBase;
    },
  });

  // Update content when data loads
  useEffect(() => {
    if (knowledgeBase) {
      setContent(knowledgeBase.content);
      setHasChanges(false);
    }
  }, [knowledgeBase]);

  const saveMutation = useMutation({
    mutationFn: async (newContent: string) => {
      if (!knowledgeBase?.id) throw new Error('No knowledge base found');
      
      const { error } = await supabase
        .from('chatbot_knowledge_base')
        .update({ 
          content: newContent,
          version: (knowledgeBase.version || 1) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', knowledgeBase.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      setHasChanges(false);
      toast.success('Knowledge base saved! Stan will use this immediately.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save');
    },
  });

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(value !== knowledgeBase?.content);
  };

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading knowledge base...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Stan's Knowledge Base</CardTitle>
              <CardDescription>
                This is Stan's complete brain. Edit this document to update what Stan knows about Agency Brain.
                Changes take effect immediately.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="destructive">
                Unsaved changes
              </Badge>
            )}
            <Badge variant="outline">
              v{knowledgeBase?.version || 1}
            </Badge>
            <Badge variant="secondary">
              {charCount.toLocaleString()} chars
            </Badge>
            <Badge variant="secondary">
              {wordCount.toLocaleString()} words
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="min-h-[600px] font-mono text-sm"
          placeholder="# Stan's Knowledge Base..."
        />
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Last updated: {knowledgeBase?.updated_at ? new Date(knowledgeBase.updated_at).toLocaleString() : 'Never'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setContent(knowledgeBase?.content || '');
                setHasChanges(false);
              }}
              disabled={!hasChanges}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Revert
            </Button>
            <Button
              onClick={() => saveMutation.mutate(content)}
              disabled={!hasChanges || saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Knowledge Base'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
