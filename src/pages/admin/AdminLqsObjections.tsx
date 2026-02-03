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
import { useAdminLqsObjections } from '@/hooks/useLqsObjections';
import { SidebarLayout } from '@/components/SidebarLayout';

export default function AdminLqsObjections() {
  const [newObjectionName, setNewObjectionName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    data: objections,
    isLoading,
    createObjection,
    updateObjection,
    toggleActive,
    deleteObjection,
  } = useAdminLqsObjections();

  const handleCreate = () => {
    if (newObjectionName.trim()) {
      createObjection.mutate(newObjectionName);
      setNewObjectionName('');
    }
  };

  const handleUpdate = () => {
    if (editingId && editingName.trim()) {
      updateObjection.mutate({ id: editingId, name: editingName });
      setEditingId(null);
    }
  };

  return (
    <SidebarLayout>
      <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">LQS Objections</h1>
          <p className="text-muted-foreground">
            Manage objection options for quoted households. These are global options used by all agencies.
          </p>
        </div>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Objections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <Input
                value={newObjectionName}
                onChange={(e) => setNewObjectionName(e.target.value)}
                placeholder="New objection name..."
                className="max-w-xs"
                onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Button
                onClick={handleCreate}
                disabled={!newObjectionName.trim() || createObjection.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Objection
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
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : objections?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No objections defined yet. Add one above to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  objections?.map((objection) => (
                    <TableRow key={objection.id}>
                      <TableCell>
                        {editingId === objection.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-8 w-48"
                              autoFocus
                              onKeyPress={(e) => e.key === 'Enter' && handleUpdate()}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={handleUpdate}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="font-medium">{objection.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={objection.is_active ? 'default' : 'secondary'}>
                          {objection.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingId(objection.id);
                              setEditingName(objection.name);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => toggleActive.mutate({
                              id: objection.id,
                              is_active: !objection.is_active
                            })}
                          >
                            {objection.is_active ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteId(objection.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Objection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will remove this objection option. Households that had this objection selected will show "Not specified".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteObjection.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarLayout>
  );
}
