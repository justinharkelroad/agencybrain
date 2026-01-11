import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SuggestedQuestion {
  id: string;
  page_route: string;
  question: string;
  sort_order: number;
  applies_to_portals: string[];
  is_active: boolean;
}

const PAGE_ROUTE_OPTIONS = [
  { value: '_default', label: 'Default (Fallback)' },
  { value: '/dashboard', label: 'Dashboard (Brain)' },
  { value: '/submit', label: 'Submit Form' },
  { value: '/metrics', label: 'Metrics' },
  { value: '/agency', label: 'Agency Management' },
  { value: '/training', label: 'Training (Brain)' },
  { value: '/bonus-grid', label: 'Bonus Grid' },
  { value: '/snapshot-planner', label: 'Snapshot Planner' },
  { value: '/call-scoring', label: 'Call Scoring (Brain)' },
  { value: '/roleplaybot', label: 'Roleplay Bot' },
  { value: '/exchange', label: 'The Exchange' },
  { value: '/staff/dashboard', label: 'Staff Dashboard' },
  { value: '/staff/training', label: 'Staff Training' },
  { value: '/staff/call-scoring', label: 'Staff Call Scoring' },
  { value: '/staff/core4', label: 'Staff Core 4' },
  { value: '/staff/flows', label: 'Staff Flows' },
  { value: '/staff/metrics', label: 'Staff Metrics' },
];

export function SuggestedQuestionsManager() {
  const queryClient = useQueryClient();
  const [selectedRoute, setSelectedRoute] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SuggestedQuestion | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<SuggestedQuestion | null>(null);
  
  const [formData, setFormData] = useState({
    page_route: '/dashboard',
    question: '',
    sort_order: 1,
    applies_to_portals: ['both'] as string[],
    is_active: true,
  });

  // Fetch all suggested questions
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['suggested-questions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_suggested_questions')
        .select('*')
        .order('page_route')
        .order('sort_order');
      if (error) throw error;
      return data as SuggestedQuestion[];
    },
  });

  // Group questions by route
  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.page_route]) acc[q.page_route] = [];
    acc[q.page_route].push(q);
    return acc;
  }, {} as Record<string, SuggestedQuestion[]>);

  // Filter by selected route
  const filteredQuestions = selectedRoute === 'all' 
    ? questions 
    : questions.filter(q => q.page_route === selectedRoute);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('chatbot_suggested_questions')
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggested-questions'] });
      toast.success('Question added');
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add question');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & typeof formData) => {
      const { error } = await supabase
        .from('chatbot_suggested_questions')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggested-questions'] });
      toast.success('Question updated');
      setIsEditDialogOpen(false);
      setEditingQuestion(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update question');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('chatbot_suggested_questions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggested-questions'] });
      toast.success('Question deleted');
      setIsDeleteDialogOpen(false);
      setDeletingQuestion(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete question');
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('chatbot_suggested_questions')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggested-questions'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  const resetForm = () => {
    setFormData({
      page_route: '/dashboard',
      question: '',
      sort_order: 1,
      applies_to_portals: ['both'],
      is_active: true,
    });
  };

  const openEditDialog = (question: SuggestedQuestion) => {
    setEditingQuestion(question);
    setFormData({
      page_route: question.page_route,
      question: question.question,
      sort_order: question.sort_order,
      applies_to_portals: question.applies_to_portals,
      is_active: question.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const getRouteLabel = (route: string) => {
    return PAGE_ROUTE_OPTIONS.find(r => r.value === route)?.label || route;
  };

  const getPortalBadge = (portals: string[]) => {
    if (portals.includes('both')) return <Badge variant="outline">Both</Badge>;
    if (portals.includes('brain')) return <Badge variant="secondary">Brain</Badge>;
    if (portals.includes('staff')) return <Badge>Staff</Badge>;
    return null;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Suggested Questions</CardTitle>
            <CardDescription>
              Manage the quick-action questions shown to users based on their current page
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </CardHeader>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          {/* Filter by route */}
          <div className="flex items-center gap-4 mb-4">
            <Label>Filter by Page:</Label>
            <Select value={selectedRoute} onValueChange={setSelectedRoute}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="All Pages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pages</SelectItem>
                {PAGE_ROUTE_OPTIONS.map(route => (
                  <SelectItem key={route.value} value={route.value}>
                    {route.label} ({groupedQuestions[route.value]?.length || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Questions table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Order</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-[180px]">Page</TableHead>
                <TableHead className="w-[100px]">Portal</TableHead>
                <TableHead className="w-[80px]">Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredQuestions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No suggested questions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuestions.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell>
                      <Badge variant="outline">{question.sort_order}</Badge>
                    </TableCell>
                    <TableCell>{question.question}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{getRouteLabel(question.page_route)}</span>
                    </TableCell>
                    <TableCell>{getPortalBadge(question.applies_to_portals)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={question.is_active}
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ id: question.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(question)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingQuestion(question);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Suggested Question</DialogTitle>
            <DialogDescription>
              Add a quick-action question for a specific page
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Page Route</Label>
              <Select
                value={formData.page_route}
                onValueChange={(value) => setFormData({ ...formData, page_route: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select page" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_ROUTE_OPTIONS.map(route => (
                    <SelectItem key={route.value} value={route.value}>
                      {route.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Question</Label>
              <Input
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                placeholder="How do I...?"
              />
            </div>

            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">Lower numbers appear first (1-3 recommended)</p>
            </div>

            <div className="space-y-2">
              <Label>Portal</Label>
              <Select
                value={formData.applies_to_portals[0]}
                onValueChange={(value) => setFormData({ ...formData, applies_to_portals: [value] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select portal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both Portals</SelectItem>
                  <SelectItem value="brain">Brain Portal Only</SelectItem>
                  <SelectItem value="staff">Staff Portal Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.question.trim()}
            >
              Add Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Suggested Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Page Route</Label>
              <Select
                value={formData.page_route}
                onValueChange={(value) => setFormData({ ...formData, page_route: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select page" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_ROUTE_OPTIONS.map(route => (
                    <SelectItem key={route.value} value={route.value}>
                      {route.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Question</Label>
              <Input
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div className="space-y-2">
              <Label>Portal</Label>
              <Select
                value={formData.applies_to_portals[0]}
                onValueChange={(value) => setFormData({ ...formData, applies_to_portals: [value] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select portal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both Portals</SelectItem>
                  <SelectItem value="brain">Brain Portal Only</SelectItem>
                  <SelectItem value="staff">Staff Portal Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => editingQuestion && updateMutation.mutate({ id: editingQuestion.id, ...formData })}
              disabled={!formData.question.trim()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingQuestion?.question}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingQuestion && deleteMutation.mutate(deletingQuestion.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
