import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  BookOpen,
  Loader2,
  ChevronRight,
  Users,
  Building2,
  Briefcase,
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
import { toast } from 'sonner';

interface SPCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  access_tiers: string[];
  display_order: number;
  is_published: boolean;
  module_count?: number;
}

const TIER_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  boardroom: { label: 'Boardroom', icon: <Building2 className="h-3 w-3" />, color: 'bg-purple-500/20 text-purple-400' },
  one_on_one: { label: '1:1 Coaching', icon: <Briefcase className="h-3 w-3" />, color: 'bg-blue-500/20 text-blue-400' },
  staff: { label: 'Staff', icon: <Users className="h-3 w-3" />, color: 'bg-green-500/20 text-green-400' },
};

export default function AdminStandardPlaybook() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<SPCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sp_categories')
        .select(`*, sp_modules(count)`)
        .order('display_order', { ascending: true });

      if (error) throw error;

      const categoriesWithCount = (data || []).map(cat => ({
        ...cat,
        module_count: cat.sp_modules?.[0]?.count || 0,
      }));

      setCategories(categoriesWithCount);
    } catch (err) {
      console.error('Error fetching categories:', err);
      toast.error('Error loading categories');
    } finally {
      setLoading(false);
    }
  };

  const togglePublished = async (category: SPCategory) => {
    try {
      const newState = !category.is_published;
      const { error } = await supabase
        .from('sp_categories')
        .update({
          is_published: newState,
          published_at: newState ? new Date().toISOString() : null,
        })
        .eq('id', category.id);

      if (error) throw error;

      setCategories(prev =>
        prev.map(c => c.id === category.id ? { ...c, is_published: newState } : c)
      );

      toast.success(`Category ${newState ? 'published' : 'unpublished'}`);
    } catch (err) {
      console.error('Error toggling category:', err);
      toast.error('Error updating category');
    }
  };

  const deleteCategory = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('sp_categories')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      setCategories(prev => prev.filter(c => c.id !== deleteId));
      toast.success('Category deleted');
    } catch (err) {
      console.error('Error deleting category:', err);
      toast.error('Error deleting category');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium flex items-center gap-2">
            <BookOpen className="h-6 w-6" strokeWidth={1.5} />
            Standard Playbook
          </h1>
          <p className="text-muted-foreground/70 mt-1">
            Create training content pushed to users by membership tier
          </p>
        </div>

        <Button onClick={() => navigate('/admin/standard-playbook/category/new')}>
          <Plus className="h-4 w-4 mr-2" strokeWidth={1.5} />
          New Category
        </Button>
      </div>

      {/* Categories List */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" strokeWidth={1} />
            <h3 className="font-medium mb-2">No training categories yet</h3>
            <p className="text-sm text-muted-foreground/70 mb-4">
              Create your first category to start building Standard Playbook content.
            </p>
            <Button onClick={() => navigate('/admin/standard-playbook/category/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <Card
              key={category.id}
              className={`transition-opacity ${!category.is_published ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Drag Handle */}
                  <div className="text-muted-foreground/40 cursor-grab">
                    <GripVertical className="h-5 w-5" />
                  </div>

                  {/* Icon */}
                  <div className="text-3xl w-12 text-center">
                    {category.icon || '📚'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{category.name}</h3>
                      {!category.is_published && (
                        <Badge variant="outline" className="text-xs">Draft</Badge>
                      )}
                    </div>

                    {/* Access Tiers */}
                    <div className="flex flex-wrap gap-1 mb-1">
                      {category.access_tiers.map(tier => {
                        const tierInfo = TIER_LABELS[tier];
                        return tierInfo ? (
                          <span
                            key={tier}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${tierInfo.color}`}
                          >
                            {tierInfo.icon}
                            {tierInfo.label}
                          </span>
                        ) : null;
                      })}
                      {category.access_tiers.length === 0 && (
                        <span className="text-xs text-muted-foreground/50">No access tiers set</span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground/50">
                      {category.module_count} module{category.module_count !== 1 ? 's' : ''} • 
                      slug: {category.slug}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={category.is_published}
                      onCheckedChange={() => togglePublished(category)}
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/standard-playbook/category/${category.id}`)}
                    >
                      <ChevronRight className="h-4 w-4 mr-1" />
                      Manage
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/admin/standard-playbook/category/${category.id}/edit`)}
                    >
                      <Pencil className="h-4 w-4" strokeWidth={1.5} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(category.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the category and all its modules and lessons.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteCategory}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Category'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
