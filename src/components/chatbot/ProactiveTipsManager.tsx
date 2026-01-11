import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Clock, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

interface ProactiveTip {
  id: string;
  page_route: string;
  tip_message: string;
  suggested_question: string | null;
  delay_seconds: number;
  applies_to_portals: string[];
  applies_to_tiers: string[];
  is_active: boolean;
}

const PAGE_ROUTE_OPTIONS = [
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
];

const TIER_OPTIONS = [
  { value: 'all', label: 'All Tiers' },
  { value: '1:1 Coaching', label: '1:1 Coaching' },
  { value: 'Boardroom', label: 'Boardroom' },
  { value: 'Call Scoring', label: 'Call Scoring' },
];

export function ProactiveTipsManager() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTip, setEditingTip] = useState<ProactiveTip | null>(null);
  const [deletingTip, setDeletingTip] = useState<ProactiveTip | null>(null);
  
  const [formData, setFormData] = useState({
    page_route: '/dashboard',
    tip_message: '',
    suggested_question: '',
    delay_seconds: 45,
    applies_to_portals: ['both'] as string[],
    applies_to_tiers: ['all'] as string[],
    is_active: true,
  });

  // Fetch all tips
  const { data: tips = [], isLoading } = useQuery({
    queryKey: ['proactive-tips-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_proactive_tips')
        .select('*')
        .order('page_route')
        .order('sort_order');
      if (error) throw error;
      return data as ProactiveTip[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('chatbot_proactive_tips')
        .insert([{
          ...data,
          suggested_question: data.suggested_question || null,
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-tips-admin'] });
      queryClient.invalidateQueries({ queryKey: ['proactive-tips'] });
      toast.success('Proactive tip added');
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add tip');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & typeof formData) => {
      const { error } = await supabase
        .from('chatbot_proactive_tips')
        .update({
          ...data,
          suggested_question: data.suggested_question || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-tips-admin'] });
      queryClient.invalidateQueries({ queryKey: ['proactive-tips'] });
      toast.success('Proactive tip updated');
      setIsEditDialogOpen(false);
      setEditingTip(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update tip');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('chatbot_proactive_tips')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-tips-admin'] });
      queryClient.invalidateQueries({ queryKey: ['proactive-tips'] });
      toast.success('Proactive tip deleted');
      setIsDeleteDialogOpen(false);
      setDeletingTip(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete tip');
    },
  });

  // Toggle active
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('chatbot_proactive_tips')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-tips-admin'] });
      queryClient.invalidateQueries({ queryKey: ['proactive-tips'] });
    },
  });

  const resetForm = () => {
    setFormData({
      page_route: '/dashboard',
      tip_message: '',
      suggested_question: '',
      delay_seconds: 45,
      applies_to_portals: ['both'],
      applies_to_tiers: ['all'],
      is_active: true,
    });
  };

  const openEditDialog = (tip: ProactiveTip) => {
    setEditingTip(tip);
    setFormData({
      page_route: tip.page_route,
      tip_message: tip.tip_message,
      suggested_question: tip.suggested_question || '',
      delay_seconds: tip.delay_seconds,
      applies_to_portals: tip.applies_to_portals,
      applies_to_tiers: tip.applies_to_tiers,
      is_active: tip.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const getRouteLabel = (route: string) => {
    return PAGE_ROUTE_OPTIONS.find(r => r.value === route)?.label || route;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Proactive Tips
            </CardTitle>
            <CardDescription>
              Configure tips that appear after users spend time on a page without interacting with Stan
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tip
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead>Tip Message</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Delay
                </div>
              </TableHead>
              <TableHead>Portal</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading tips...
                </TableCell>
              </TableRow>
            ) : tips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No proactive tips configured
                </TableCell>
              </TableRow>
            ) : (
              tips.map((tip) => (
                <TableRow key={tip.id}>
                  <TableCell className="font-medium">
                    {getRouteLabel(tip.page_route)}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm line-clamp-2">{tip.tip_message}</p>
                    {tip.suggested_question && (
                      <p className="text-xs text-muted-foreground mt-1">
                        → {tip.suggested_question}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tip.delay_seconds}s</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {tip.applies_to_portals.includes('both') ? 'Both' : 
                       tip.applies_to_portals.includes('brain') ? 'Brain' : 'Staff'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {tip.applies_to_tiers.includes('all') ? 'All' : tip.applies_to_tiers.join(', ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={tip.is_active}
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ id: tip.id, is_active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(tip)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingTip(tip);
                          setIsDeleteDialogOpen(true);
                        }}
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

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Proactive Tip</DialogTitle>
            <DialogDescription>
              Create a tip that appears after users spend time on a page
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
                  <SelectValue />
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
              <Label>Tip Message</Label>
              <Textarea
                value={formData.tip_message}
                onChange={(e) => setFormData({ ...formData, tip_message: e.target.value })}
                placeholder="Need help with this page? I can explain!"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">Short, friendly message shown in the bubble</p>
            </div>
            <div className="space-y-2">
              <Label>Suggested Question (Optional)</Label>
              <Input
                value={formData.suggested_question}
                onChange={(e) => setFormData({ ...formData, suggested_question: e.target.value })}
                placeholder="How does this feature work?"
              />
              <p className="text-xs text-muted-foreground">Auto-sends this question when user clicks the tip</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delay (seconds)</Label>
                <Input
                  type="number"
                  min={10}
                  max={300}
                  value={formData.delay_seconds}
                  onChange={(e) => setFormData({ ...formData, delay_seconds: parseInt(e.target.value) || 45 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Portal</Label>
                <Select 
                  value={formData.applies_to_portals[0]} 
                  onValueChange={(value) => setFormData({ ...formData, applies_to_portals: [value] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both Portals</SelectItem>
                    <SelectItem value="brain">Brain Only</SelectItem>
                    <SelectItem value="staff">Staff Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tier Restriction</Label>
              <Select 
                value={formData.applies_to_tiers[0]} 
                onValueChange={(value) => setFormData({ ...formData, applies_to_tiers: [value] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map(tier => (
                    <SelectItem key={tier.value} value={tier.value}>
                      {tier.label}
                    </SelectItem>
                  ))}
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
              disabled={!formData.tip_message.trim()}
            >
              Add Tip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Proactive Tip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Page Route</Label>
              <Select 
                value={formData.page_route} 
                onValueChange={(value) => setFormData({ ...formData, page_route: value })}
              >
                <SelectTrigger>
                  <SelectValue />
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
              <Label>Tip Message</Label>
              <Textarea
                value={formData.tip_message}
                onChange={(e) => setFormData({ ...formData, tip_message: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Suggested Question (Optional)</Label>
              <Input
                value={formData.suggested_question}
                onChange={(e) => setFormData({ ...formData, suggested_question: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delay (seconds)</Label>
                <Input
                  type="number"
                  min={10}
                  max={300}
                  value={formData.delay_seconds}
                  onChange={(e) => setFormData({ ...formData, delay_seconds: parseInt(e.target.value) || 45 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Portal</Label>
                <Select 
                  value={formData.applies_to_portals[0]} 
                  onValueChange={(value) => setFormData({ ...formData, applies_to_portals: [value] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both Portals</SelectItem>
                    <SelectItem value="brain">Brain Only</SelectItem>
                    <SelectItem value="staff">Staff Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tier Restriction</Label>
              <Select 
                value={formData.applies_to_tiers[0]} 
                onValueChange={(value) => setFormData({ ...formData, applies_to_tiers: [value] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map(tier => (
                    <SelectItem key={tier.value} value={tier.value}>
                      {tier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => editingTip && updateMutation.mutate({ id: editingTip.id, ...formData })}
              disabled={!formData.tip_message.trim()}
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
            <AlertDialogTitle>Delete Proactive Tip</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tip for "{deletingTip && getRouteLabel(deletingTip.page_route)}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTip && deleteMutation.mutate(deletingTip.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
