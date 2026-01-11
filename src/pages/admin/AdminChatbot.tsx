import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Pencil, Trash2, MessageSquare, FileText, Tag, BarChart3, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { StanAvatar } from "@/components/chatbot/StanAvatar";
import { SuggestedQuestionsManager } from "@/components/chatbot/SuggestedQuestionsManager";
import { ProactiveTipsManager } from "@/components/chatbot/ProactiveTipsManager";
import { PageContextsTable } from "@/components/admin/PageContextsTable";
import { format } from "date-fns";

const SUPABASE_URL = "https://wjqyccbytctqwceuhzhk.supabase.co";

// Default categories
const DEFAULT_CATEGORIES = [
  'dashboard', 'submit', 'metrics', 'agency', 'training',
  'bonus-grid', 'snapshot-planner', 'roleplay', 'call-scoring',
  'exchange', 'staff-portal', 'settings', 'navigation', 'troubleshooting', 'general'
];

const PORTAL_OPTIONS = [
  { value: 'brain', label: 'Brain Portal' },
  { value: 'staff', label: 'Staff Portal' },
];

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
  { value: 'key_employee', label: 'Key Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
];

const TIER_OPTIONS = [
  { value: 'all', label: 'All Tiers' },
  { value: '1:1 Coaching', label: '1:1 Coaching' },
  { value: 'Boardroom', label: 'Boardroom' },
  { value: 'Call Scoring', label: 'Call Scoring' },
];

interface FAQ {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string;
  applies_to_portals: string[];
  applies_to_roles: string[];
  applies_to_tiers: string[];
  page_context: string[];
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FAQFormData {
  question: string;
  answer: string;
  keywords: string;
  category: string;
  applies_to_portals: string[];
  applies_to_roles: string[];
  applies_to_tiers: string[];
  page_context: string;
  priority: number;
  is_active: boolean;
}

const defaultFormData: FAQFormData = {
  question: '',
  answer: '',
  keywords: '',
  category: 'general',
  applies_to_portals: ['brain', 'staff'],
  applies_to_roles: ['owner', 'key_employee', 'manager', 'staff'],
  applies_to_tiers: ['all'],
  page_context: '',
  priority: 5,
  is_active: true,
};

export default function AdminChatbot() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FAQFormData>(defaultFormData);

  // Fetch FAQs - use RPC or direct query with admin privileges
  const { data: faqs = [], isLoading } = useQuery({
    queryKey: ['admin-chatbot-faqs'],
    queryFn: async () => {
      // Direct query - admin RLS policy allows full access
      const { data, error } = await supabase
        .from('chatbot_faqs')
        .select('*')
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return (data || []) as FAQ[];
    },
  });

  // Fetch conversation count for today
  const { data: conversationsToday = 0 } = useQuery({
    queryKey: ['admin-chatbot-conversations-today'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error } = await supabase
        .from('chatbot_conversations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());
      
      if (error) throw error;
      return count || 0;
    },
  });

  // Create/Update FAQ mutation
  const saveMutation = useMutation({
    mutationFn: async (data: FAQFormData) => {
      const payload = {
        question: data.question,
        answer: data.answer,
        keywords: data.keywords.split(',').map(k => k.trim()).filter(Boolean),
        category: data.category,
        applies_to_portals: data.applies_to_portals,
        applies_to_roles: data.applies_to_roles,
        applies_to_tiers: data.applies_to_tiers,
        page_context: data.page_context.split(',').map(p => p.trim()).filter(Boolean),
        priority: data.priority,
        is_active: data.is_active,
      };

      if (editingFaq) {
        const { error } = await supabase
          .from('chatbot_faqs')
          .update(payload)
          .eq('id', editingFaq.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('chatbot_faqs')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-chatbot-faqs'] });
      setIsDialogOpen(false);
      setEditingFaq(null);
      setFormData(defaultFormData);
      toast.success(editingFaq ? 'FAQ updated successfully' : 'FAQ created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save FAQ');
    },
  });

  // Delete FAQ mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('chatbot_faqs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-chatbot-faqs'] });
      setDeleteConfirmId(null);
      toast.success('FAQ deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete FAQ');
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('chatbot_faqs')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-chatbot-faqs'] });
    },
  });

  // Filter FAQs
  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = !searchTerm || 
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.keywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'all' || faq.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && faq.is_active) ||
      (statusFilter === 'inactive' && !faq.is_active);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Get unique categories from existing FAQs
  const existingCategories = [...new Set(faqs.map(f => f.category))];
  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...existingCategories])].sort();

  // Stats
  const totalFaqs = faqs.length;
  const activeFaqs = faqs.filter(f => f.is_active).length;
  const categoryCount = allCategories.length;

  const handleEdit = (faq: FAQ) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      keywords: faq.keywords.join(', '),
      category: faq.category,
      applies_to_portals: faq.applies_to_portals,
      applies_to_roles: faq.applies_to_roles,
      applies_to_tiers: faq.applies_to_tiers,
      page_context: faq.page_context.join(', '),
      priority: faq.priority,
      is_active: faq.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingFaq(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const handlePortalToggle = (value: string) => {
    setFormData(prev => {
      const current = prev.applies_to_portals;
      if (current.includes(value)) {
        return { ...prev, applies_to_portals: current.filter(v => v !== value) };
      }
      return { ...prev, applies_to_portals: [...current, value] };
    });
  };

  const handleRoleToggle = (value: string) => {
    setFormData(prev => {
      const current = prev.applies_to_roles;
      if (current.includes(value)) {
        return { ...prev, applies_to_roles: current.filter(v => v !== value) };
      }
      return { ...prev, applies_to_roles: [...current, value] };
    });
  };

  const handleTierToggle = (value: string) => {
    setFormData(prev => {
      const current = prev.applies_to_tiers;
      if (current.includes(value)) {
        return { ...prev, applies_to_tiers: current.filter(v => v !== value) };
      }
      return { ...prev, applies_to_tiers: [...current, value] };
    });
  };

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <StanAvatar variant="waving" size="xl" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stan Chatbot Management</h1>
          <p className="text-muted-foreground">Manage FAQ knowledge base and view conversation analytics</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total FAQs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{totalFaqs}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active FAQs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{activeFaqs}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{categoryCount}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversations Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">{conversationsToday}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="faqs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
          <TabsTrigger value="contexts">Page Contexts</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="proactive">Proactive Tips</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="faqs" className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search questions, answers, keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add FAQ
            </Button>
          </div>

          {/* FAQ Table */}
          <Card>
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Priority</TableHead>
                    <TableHead className="min-w-[250px]">Question</TableHead>
                    <TableHead className="w-[120px]">Category</TableHead>
                    <TableHead className="w-[120px]">Portals</TableHead>
                    <TableHead className="w-[80px]">Roles</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Loading FAQs...
                      </TableCell>
                    </TableRow>
                  ) : filteredFaqs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No FAQs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFaqs.map(faq => (
                      <TableRow key={faq.id}>
                        <TableCell>
                          <Badge variant={faq.priority >= 8 ? "default" : faq.priority >= 5 ? "secondary" : "outline"}>
                            {faq.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">
                                  {faq.question.length > 60 
                                    ? faq.question.slice(0, 60) + '...' 
                                    : faq.question}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md">
                                <p className="font-medium">{faq.question}</p>
                                <p className="text-xs text-muted-foreground mt-1">{faq.answer.slice(0, 200)}...</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{faq.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {faq.applies_to_portals.includes('brain') && (
                              <Badge variant="secondary" className="text-xs">Brain</Badge>
                            )}
                            {faq.applies_to_portals.includes('staff') && (
                              <Badge variant="secondary" className="text-xs">Staff</Badge>
                            )}
                            {faq.applies_to_portals.includes('both') && (
                              <Badge variant="secondary" className="text-xs">Both</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline">{faq.applies_to_roles.length} roles</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {faq.applies_to_roles.join(', ')}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={faq.is_active}
                            onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: faq.id, is_active: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(faq)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(faq.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="contexts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Page Contexts
              </CardTitle>
              <CardDescription>
                Rich page descriptions that Stan loads FIRST before searching FAQs. This prevents cross-contamination 
                (like answering about Call Scoring when the user is on the Flows page).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PageContextsTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <SuggestedQuestionsManager />
        </TabsContent>

        <TabsContent value="proactive" className="space-y-4">
          <ProactiveTipsManager />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>FAQ Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allCategories.map(category => {
                  const count = faqs.filter(f => f.category === category).length;
                  return (
                    <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium capitalize">{category}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <StanAvatar variant="thinking" size="xl" />
              <p className="text-muted-foreground mt-4">Analytics coming in Phase 2!</p>
              <p className="text-sm text-muted-foreground">We'll track conversation metrics, popular questions, and more.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFaq ? 'Edit FAQ' : 'Add New FAQ'}</DialogTitle>
            <DialogDescription>
              {editingFaq ? 'Update the FAQ details below.' : 'Create a new FAQ entry for Stan\'s knowledge base.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Question */}
            <div className="space-y-2">
              <Label htmlFor="question">Question *</Label>
              <Textarea
                id="question"
                value={formData.question}
                onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                placeholder="What question should this FAQ answer?"
                rows={2}
              />
            </div>

            {/* Answer */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="answer">Answer *</Label>
                <span className="text-xs text-muted-foreground">{formData.answer.length} characters</span>
              </div>
              <Textarea
                id="answer"
                value={formData.answer}
                onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                placeholder="Stan's response to this question..."
                rows={4}
              />
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Input
                id="keywords"
                value={formData.keywords}
                onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                placeholder="submit, reporting, period, save"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Applies to Portals */}
            <div className="space-y-2">
              <Label>Applies to Portals</Label>
              <div className="flex flex-wrap gap-4">
                {PORTAL_OPTIONS.map(option => (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`portal-${option.value}`}
                      checked={formData.applies_to_portals.includes(option.value)}
                      onCheckedChange={() => handlePortalToggle(option.value)}
                    />
                    <Label htmlFor={`portal-${option.value}`} className="text-sm font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Applies to Roles */}
            <div className="space-y-2">
              <Label>Applies to Roles</Label>
              <div className="flex flex-wrap gap-4">
                {ROLE_OPTIONS.map(option => (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`role-${option.value}`}
                      checked={formData.applies_to_roles.includes(option.value)}
                      onCheckedChange={() => handleRoleToggle(option.value)}
                    />
                    <Label htmlFor={`role-${option.value}`} className="text-sm font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Applies to Tiers */}
            <div className="space-y-2">
              <Label>Applies to Tiers</Label>
              <div className="flex flex-wrap gap-4">
                {TIER_OPTIONS.map(option => (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`tier-${option.value}`}
                      checked={formData.applies_to_tiers.includes(option.value)}
                      onCheckedChange={() => handleTierToggle(option.value)}
                    />
                    <Label htmlFor={`tier-${option.value}`} className="text-sm font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Page Context */}
            <div className="space-y-2">
              <Label htmlFor="page_context">Page Context (comma-separated routes)</Label>
              <Input
                id="page_context"
                value={formData.page_context}
                onChange={(e) => setFormData(prev => ({ ...prev, page_context: e.target.value }))}
                placeholder="/dashboard, /submit, /metrics"
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Priority</Label>
                <span className="text-sm font-medium">{formData.priority}</span>
              </div>
              <Slider
                value={[formData.priority]}
                onValueChange={([v]) => setFormData(prev => ({ ...prev, priority: v }))}
                min={1}
                max={10}
                step={1}
              />
              <p className="text-xs text-muted-foreground">Higher priority = more important/common question</p>
            </div>

            {/* Is Active */}
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.question || !formData.answer || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : (editingFaq ? 'Update FAQ' : 'Create FAQ')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this FAQ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
