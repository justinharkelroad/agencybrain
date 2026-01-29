import React, { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Workflow,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Phone,
  MessageSquare,
  Mail,
  MoreHorizontal,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Sequence, SequenceEditorModal, SequenceTargetType } from "@/components/prototype/SequenceEditorModal";
import { SequenceStep, ActionType } from "@/components/prototype/SequenceStepEditor";

// Mock data for sequences
const generateMockSequences = (): Sequence[] => [
  {
    id: 'seq-1',
    name: 'New Auto Policy',
    description: 'Standard 14-day onboarding sequence for new auto insurance customers. Includes welcome call, document delivery, and payment setup reminders.',
    targetType: 'onboarding',
    isActive: true,
    steps: [
      { id: 's1-1', dayNumber: 0, actionType: 'call', title: 'Welcome Call', description: 'Introduce yourself and confirm policy details', scriptTemplate: 'Hi [Customer Name], this is [Agent Name]...', sortOrder: 0 },
      { id: 's1-2', dayNumber: 0, actionType: 'email', title: 'Send Welcome Email', description: 'Email welcome packet with ID cards and policy documents', sortOrder: 1 },
      { id: 's1-3', dayNumber: 2, actionType: 'text', title: 'Auto-Pay Reminder', description: 'Text reminder to set up automatic payments', sortOrder: 2 },
      { id: 's1-4', dayNumber: 5, actionType: 'call', title: 'Check-in Call', description: 'Follow up to answer any questions', sortOrder: 3 },
      { id: 's1-5', dayNumber: 14, actionType: 'call', title: 'Review Call', description: 'Final review and discuss bundling opportunities', sortOrder: 4 },
    ],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: 'seq-2',
    name: 'New Home Policy',
    description: 'Comprehensive onboarding for homeowners policy customers with focus on coverage education.',
    targetType: 'onboarding',
    isActive: true,
    steps: [
      { id: 's2-1', dayNumber: 0, actionType: 'call', title: 'Welcome Call', description: 'Welcome new homeowner and review coverage', sortOrder: 0 },
      { id: 's2-2', dayNumber: 1, actionType: 'email', title: 'Coverage Summary Email', description: 'Send detailed coverage breakdown', sortOrder: 1 },
      { id: 's2-3', dayNumber: 3, actionType: 'text', title: 'ID Card Check', description: 'Confirm receipt of insurance ID cards', sortOrder: 2 },
      { id: 's2-4', dayNumber: 7, actionType: 'email', title: 'Home Safety Tips', description: 'Send home safety and claims prevention tips', sortOrder: 3 },
      { id: 's2-5', dayNumber: 14, actionType: 'call', title: 'Two Week Check-in', description: 'Address any questions or concerns', sortOrder: 4 },
      { id: 's2-6', dayNumber: 21, actionType: 'call', title: 'Auto Bundle Discussion', description: 'Discuss potential auto insurance bundle', sortOrder: 5 },
    ],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-18'),
  },
  {
    id: 'seq-3',
    name: 'Home Bundle Upsell',
    description: 'Cross-sell sequence for existing auto customers who may benefit from adding home insurance.',
    targetType: 'onboarding',
    isActive: true,
    steps: [
      { id: 's3-1', dayNumber: 0, actionType: 'call', title: 'Bundle Opportunity Call', description: 'Discuss home insurance bundling benefits', sortOrder: 0 },
      { id: 's3-2', dayNumber: 3, actionType: 'email', title: 'Bundle Quote Email', description: 'Send comparison showing bundle savings', sortOrder: 1 },
      { id: 's3-3', dayNumber: 7, actionType: 'text', title: 'Follow-up Text', description: 'Check if they reviewed the quote', sortOrder: 2 },
      { id: 's3-4', dayNumber: 10, actionType: 'call', title: 'Decision Call', description: 'Final call to answer questions and close', sortOrder: 3 },
    ],
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: 'seq-4',
    name: 'Life Insurance Follow-up',
    description: 'Lead nurturing sequence for life insurance prospects.',
    targetType: 'lead_nurturing',
    isActive: false,
    steps: [
      { id: 's4-1', dayNumber: 0, actionType: 'call', title: 'Initial Consultation', description: 'Discuss life insurance needs and options', sortOrder: 0 },
      { id: 's4-2', dayNumber: 2, actionType: 'email', title: 'Quote Delivery', description: 'Send life insurance quotes', sortOrder: 1 },
      { id: 's4-3', dayNumber: 7, actionType: 'call', title: 'Follow-up Call', description: 'Review quotes and answer questions', sortOrder: 2 },
    ],
    createdAt: new Date('2024-01-25'),
    updatedAt: new Date('2024-01-25'),
  },
];

const targetTypeLabels: Record<SequenceTargetType, string> = {
  onboarding: 'Onboarding',
  lead_nurturing: 'Lead Nurturing',
  requote: 'Re-quote',
  retention: 'Retention',
  other: 'Other',
};

const targetTypeColors: Record<SequenceTargetType, string> = {
  onboarding: 'bg-green-500/10 text-green-500 border-green-500/20',
  lead_nurturing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  requote: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  retention: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  other: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const actionIcons: Record<ActionType, React.ElementType> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  other: MoreHorizontal,
};

export default function SequenceBuilderPrototype() {
  const { toast } = useToast();
  const [sequences, setSequences] = useState<Sequence[]>(generateMockSequences);
  const [searchQuery, setSearchQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sequenceToDelete, setSequenceToDelete] = useState<Sequence | null>(null);

  // Filter sequences by search
  const filteredSequences = sequences.filter(seq =>
    seq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seq.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateNew = () => {
    setEditingSequence(null);
    setEditorOpen(true);
  };

  const handleEdit = (sequence: Sequence) => {
    setEditingSequence(sequence);
    setEditorOpen(true);
  };

  const handleDuplicate = (sequence: Sequence) => {
    const newSequence: Sequence = {
      ...sequence,
      id: `seq-${Date.now()}`,
      name: `${sequence.name} (Copy)`,
      isActive: false,
      steps: sequence.steps.map(s => ({ ...s, id: `step-${Date.now()}-${s.sortOrder}` })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSequences(current => [newSequence, ...current]);
    toast({
      title: "Sequence Duplicated",
      description: `"${newSequence.name}" has been created.`,
    });
  };

  const handleDelete = (sequence: Sequence) => {
    setSequenceToDelete(sequence);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (sequenceToDelete) {
      setSequences(current => current.filter(s => s.id !== sequenceToDelete.id));
      toast({
        title: "Sequence Deleted",
        description: `"${sequenceToDelete.name}" has been deleted.`,
      });
      setSequenceToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleToggleActive = (sequence: Sequence) => {
    setSequences(current =>
      current.map(s =>
        s.id === sequence.id
          ? { ...s, isActive: !s.isActive, updatedAt: new Date() }
          : s
      )
    );
    toast({
      title: sequence.isActive ? "Sequence Deactivated" : "Sequence Activated",
      description: `"${sequence.name}" is now ${sequence.isActive ? 'inactive' : 'active'}.`,
    });
  };

  const handleSaveSequence = (sequenceData: Omit<Sequence, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (sequenceData.id) {
      // Update existing
      setSequences(current =>
        current.map(s =>
          s.id === sequenceData.id
            ? { ...s, ...sequenceData, updatedAt: new Date() }
            : s
        )
      );
      toast({
        title: "Sequence Updated",
        description: `"${sequenceData.name}" has been updated.`,
      });
    } else {
      // Create new
      const newSequence: Sequence = {
        ...sequenceData,
        id: `seq-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setSequences(current => [newSequence, ...current]);
      toast({
        title: "Sequence Created",
        description: `"${newSequence.name}" has been created.`,
      });
    }
  };

  // Stats
  const activeCount = sequences.filter(s => s.isActive).length;
  const totalSteps = sequences.reduce((acc, s) => acc + s.steps.length, 0);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Workflow className="w-6 h-6 text-primary" />
              Sequence Builder
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage automated follow-up sequences
            </p>
          </div>

          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Create Sequence
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Workflow className="w-4 h-4" />
                <span className="text-sm">Total Sequences</span>
              </div>
              <p className="text-2xl font-semibold mt-1">{sequences.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">Active</span>
              </div>
              <p className="text-2xl font-semibold mt-1">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Total Steps</span>
              </div>
              <p className="text-2xl font-semibold mt-1">{totalSteps}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search sequences..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sequences List */}
        <div className="space-y-4">
          {filteredSequences.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Workflow className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  {searchQuery ? 'No sequences match your search' : 'No sequences yet'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery ? 'Try a different search term' : 'Create your first sequence to get started'}
                </p>
                {!searchQuery && (
                  <Button className="mt-4" onClick={handleCreateNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Sequence
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredSequences.map((sequence) => {
              const totalDays = sequence.steps.length > 0
                ? Math.max(...sequence.steps.map(s => s.dayNumber))
                : 0;

              // Count action types
              const actionCounts = sequence.steps.reduce((acc, step) => {
                acc[step.actionType] = (acc[step.actionType] || 0) + 1;
                return acc;
              }, {} as Record<ActionType, number>);

              return (
                <Card
                  key={sequence.id}
                  className={cn(
                    "transition-all hover:shadow-md",
                    !sequence.isActive && "opacity-60"
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{sequence.name}</h3>
                          <Badge className={cn("text-xs", targetTypeColors[sequence.targetType])}>
                            {targetTypeLabels[sequence.targetType]}
                          </Badge>
                          {!sequence.isActive && (
                            <Badge variant="outline" className="text-xs">
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {sequence.description || 'No description'}
                        </p>

                        {/* Step Summary */}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>{sequence.steps.length} steps</span>
                            <span className="text-muted-foreground/50">•</span>
                            <span>{totalDays} days</span>
                          </div>

                          {/* Action type icons */}
                          <div className="flex items-center gap-2">
                            {(Object.entries(actionCounts) as [ActionType, number][]).map(([type, count]) => {
                              const Icon = actionIcons[type];
                              return (
                                <div
                                  key={type}
                                  className="flex items-center gap-1 text-xs text-muted-foreground"
                                  title={`${count} ${type}${count !== 1 ? 's' : ''}`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  <span>{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={sequence.isActive}
                          onCheckedChange={() => handleToggleActive(sequence)}
                        />

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(sequence)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(sequence)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(sequence)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Prototype Notice */}
        <div className="text-center text-xs text-muted-foreground/50 py-4">
          <p>UI Prototype - No database connection. Using mock data.</p>
          <p className="mt-1">Navigate to: <code className="bg-muted px-1 py-0.5 rounded">/prototype/sequence-builder</code></p>
        </div>
      </div>

      {/* Sequence Editor Modal */}
      <SequenceEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        sequence={editingSequence}
        onSave={handleSaveSequence}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sequence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{sequenceToDelete?.name}"? This action cannot be undone.
              {sequenceToDelete?.isActive && (
                <span className="block mt-2 text-orange-500">
                  Warning: This sequence is currently active and may be in use.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
