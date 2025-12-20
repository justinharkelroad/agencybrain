import { useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Edit2, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { supabase } from '@/lib/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SidebarLayout } from '@/components/SidebarLayout';

interface ExchangeTag {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminExchangeTags() {
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const { data: tags, isLoading } = useQuery({
    queryKey: ['admin-exchange-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_tags')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as ExchangeTag[];
    },
  });
  
  const createTag = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('exchange_tags')
        .insert({ name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exchange-tags'] });
      setNewTagName('');
      toast.success('Tag created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create tag');
    },
  });
  
  const updateTag = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('exchange_tags')
        .update({ name: name.trim() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exchange-tags'] });
      setEditingId(null);
      toast.success('Tag updated');
    },
  });
  
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('exchange_tags')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exchange-tags'] });
    },
  });
  
  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('exchange_tags')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exchange-tags'] });
      setDeleteId(null);
      toast.success('Tag deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete tag. It may be in use.');
    },
  });
  
  return (
    <SidebarLayout>
      <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Exchange Tags</h1>
          <p className="text-muted-foreground">Manage topic tags for The Exchange</p>
        </div>
        
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Tags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name..."
                className="max-w-xs"
                onKeyPress={(e) => e.key === 'Enter' && createTag.mutate(newTagName)}
              />
              <Button onClick={() => createTag.mutate(newTagName)} disabled={!newTagName.trim() || createTag.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Add Tag
              </Button>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : tags?.map(tag => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      {editingId === tag.id ? (
                        <div className="flex items-center gap-2">
                          <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-8 w-48" autoFocus />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateTag.mutate({ id: editingId, name: editingName })}><Check className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      ) : <span className="font-medium">{tag.name}</span>}
                    </TableCell>
                    <TableCell><Badge variant={tag.is_active ? 'default' : 'secondary'}>{tag.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(tag.id); setEditingName(tag.name); }}><Edit2 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleActive.mutate({ id: tag.id, is_active: !tag.is_active })}>{tag.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}</Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(tag.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This will remove it from all posts.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteTag.mutate(deleteId)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarLayout>
  );
}
