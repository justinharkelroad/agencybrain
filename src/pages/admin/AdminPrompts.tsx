import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supa } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings, 
  Save, 
  ArrowLeft,
  LogOut,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, Navigate } from 'react-router-dom';
import { AdminTopNav } from '@/components/AdminTopNav';
import { getCategoryGradient, getCategoryLabel } from '@/utils/categoryStyles';

interface Prompt {
  id: string;
  category: string;
  title: string; // Headline
  subheadline: string | null; // Optional subheadline
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const AdminPrompts = () => {
  const { user, isAdmin, signOut } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
const [newPrompt, setNewPrompt] = useState({
  category: '',
  title: '',
  subheadline: '',
  content: '',
  is_active: true
});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const promptCategories = [
    { id: 'performance', label: 'Performance Analysis', description: 'Overall performance review and insights' },
    { id: 'growth', label: 'Growth Opportunities', description: 'Market expansion and growth strategies' },
    { id: 'efficiency', label: 'Operational Efficiency', description: 'Process optimization and cost management' },
    { id: 'retention', label: 'Customer Retention', description: 'Client relationship and retention strategies' },
    { id: 'competitive', label: 'Competitive Analysis', description: 'Market positioning and competitive insights' }
  ];

  useEffect(() => {
    if (user && isAdmin) {
      fetchPrompts();
    }
  }, [user, isAdmin]);

  const fetchPrompts = async () => {
    try {
      const { data, error } = await supa
        .from('prompts')
        .select('*')
        .order('category');

      if (error) throw error;
      setPrompts(data || []);
    } catch (error: any) {
      // If auth fails, try anonymous fetch for active prompts only
      if (error.message?.includes('403') || error.code === 'PGRST301') {
        console.log('Auth failed for prompts, trying anonymous fetch...');
        try {
          const { fetchActivePrompts } = await import('@/lib/anonSupabase');
          const promptsData = await fetchActivePrompts();
          setPrompts(promptsData || []);
          return;
        } catch (anonError) {
          console.error('Anonymous fetch also failed:', anonError);
        }
      }
      
      console.error('Error fetching prompts:', error);
      toast({
        title: "Error",
        description: "Failed to load prompts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async (prompt: Partial<Prompt>) => {
    setSaving(true);
    try {
      if (prompt.id) {
        // Update existing prompt
        const { error } = await supa
          .from('prompts')
          .update({
            title: prompt.title,
            subheadline: (prompt as any).subheadline ?? null,
            content: prompt.content,
            is_active: prompt.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', prompt.id as string);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Prompt updated successfully",
        });
      } else {
        // Create new prompt
        const { error } = await supa
          .from('prompts')
          .insert({
            category: prompt.category,
            title: prompt.title,
            subheadline: (prompt as any).subheadline ?? null,
            content: prompt.content,
            is_active: prompt.is_active
          });

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Prompt created successfully",
        });
        
        setNewPrompt({ category: '', title: '', subheadline: '', content: '', is_active: true });
      }

      setEditingPrompt(null);
      fetchPrompts();
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast({
        title: "Error",
        description: "Failed to save prompt",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePrompt = async (promptId: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    try {
      const { error } = await supa
        .from('prompts')
        .delete()
        .eq('id', promptId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Prompt deleted successfully",
      });

      fetchPrompts();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getPromptCategoryLabel = (category: string) => {
    return promptCategories.find(c => c.id === category)?.label || category;
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminTopNav title="Prompt Management" />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Prompt Management</h1>
          <p className="text-muted-foreground">
            Manage AI analysis prompts for different categories
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Existing Prompts */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Existing Prompts
                </CardTitle>
                <CardDescription>
                  Edit and manage analysis prompts by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                {prompts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No prompts configured yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {prompts.map((prompt) => (
                      <div key={prompt.id} className="border rounded-lg p-4">
                         <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-3">
                             <Badge variant="outline" className={`text-white border-none ${getCategoryGradient(prompt.category)}`}>
                               {getPromptCategoryLabel(prompt.category)}
                             </Badge>
                             <Badge variant={prompt.is_active ? 'default' : 'secondary'}>
                               {prompt.is_active ? 'Active' : 'Inactive'}
                             </Badge>
                           </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPrompt(prompt)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deletePrompt(prompt.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="font-medium mt-1">{prompt.title}</p>
                        {prompt.subheadline && (
                          <p className="text-sm text-muted-foreground">{prompt.subheadline}</p>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {prompt.content}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Updated: {new Date(prompt.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Edit/Create Prompt */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  {editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}
                </CardTitle>
                <CardDescription>
                  {editingPrompt ? 'Modify the selected prompt' : 'Add a new analysis prompt'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 {!editingPrompt ? (
                   <div>
                     <Label htmlFor="category">Category</Label>
                     <Select value={newPrompt.category} onValueChange={(value) => setNewPrompt({ ...newPrompt, category: value })}>
                       <SelectTrigger className="w-full mt-1">
                         <SelectValue placeholder="Select a category..." />
                       </SelectTrigger>
                       <SelectContent>
                         {promptCategories.map((category) => (
                           <SelectItem key={category.id} value={category.id}>
                             {category.label}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                 ) : (
                   <div>
                     <Label>Category</Label>
                     <Badge variant="outline" className={`mt-1 text-white border-none ${getCategoryGradient(editingPrompt.category)}`}>
                       {getPromptCategoryLabel(editingPrompt.category)}
                     </Badge>
                   </div>
                 )}

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="prompt_title">Headline</Label>
                    <Input
                      id="prompt_title"
                      type="text"
                      value={editingPrompt ? editingPrompt.title : (newPrompt as any).title}
                      onChange={(e) => {
                        if (editingPrompt) {
                          setEditingPrompt({ ...editingPrompt, title: e.target.value });
                        } else {
                          setNewPrompt({ ...newPrompt, title: e.target.value });
                        }
                      }}
                      placeholder="Short headline for this prompt"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="prompt_subheadline">Subheadline (optional)</Label>
                    <Input
                      id="prompt_subheadline"
                      type="text"
                      value={editingPrompt ? (editingPrompt.subheadline ?? '') : ((newPrompt as any).subheadline ?? '')}
                      onChange={(e) => {
                        if (editingPrompt) {
                          setEditingPrompt({ ...editingPrompt, subheadline: e.target.value });
                        } else {
                          setNewPrompt({ ...newPrompt, subheadline: e.target.value });
                        }
                      }}
                      placeholder="Optional supporting subheadline"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="prompt_content">Prompt Text</Label>
                    <Textarea
                      id="prompt_content"
                      value={editingPrompt ? editingPrompt.content : (newPrompt as any).content}
                      onChange={(e) => {
                        if (editingPrompt) {
                          setEditingPrompt({ ...editingPrompt, content: e.target.value });
                        } else {
                          setNewPrompt({ ...newPrompt, content: e.target.value });
                        }
                      }}
                      placeholder="Enter the analysis prompt..."
                      rows={10}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={editingPrompt ? editingPrompt.is_active : newPrompt.is_active}
                    onCheckedChange={(checked) => {
                      if (editingPrompt) {
                        setEditingPrompt({ ...editingPrompt, is_active: checked });
                      } else {
                        setNewPrompt({ ...newPrompt, is_active: checked });
                      }
                    }}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => savePrompt(editingPrompt || newPrompt)}
                    disabled={saving || (!editingPrompt && (!newPrompt.category || !newPrompt.title || !newPrompt.content))}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : editingPrompt ? 'Update' : 'Create'}
                  </Button>
                  {editingPrompt && (
                    <Button
                      variant="outline"
                      onClick={() => setEditingPrompt(null)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Category Reference */}
            <Card>
              <CardHeader>
                <CardTitle>Category Reference</CardTitle>
                <CardDescription>
                  Available analysis categories and their purposes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {promptCategories.map((category) => (
                    <div key={category.id} className="text-sm">
                      <p className="font-medium">{category.label}</p>
                      <p className="text-muted-foreground">{category.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPrompts;
