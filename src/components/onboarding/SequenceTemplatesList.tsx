import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import {
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
  Workflow,
  Loader2,
} from "lucide-react";
import type { OnboardingSequence, SequenceTargetType, ActionType } from "@/hooks/useOnboardingSequences";

interface SequenceTemplatesListProps {
  sequences: OnboardingSequence[];
  loading: boolean;
  onCreateNew: () => void;
  onEdit: (sequence: OnboardingSequence) => void;
  onDuplicate: (sequenceId: string) => Promise<void>;
  onDelete: (sequenceId: string) => Promise<void>;
  onToggleActive: (sequenceId: string, isActive: boolean) => Promise<void>;
}

const targetTypeLabels: Record<SequenceTargetType, string> = {
  onboarding: 'Onboarding',
  lead_nurturing: 'Lead Nurturing',
  requote: 'Re-quote',
  retention: 'Retention',
  other: 'Other',
};

const targetTypeColors: Record<SequenceTargetType, string> = {
  onboarding: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  lead_nurturing: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  requote: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  retention: 'bg-green-500/10 text-green-700 border-green-500/20',
  other: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
};

const actionIcons: Record<ActionType, React.ElementType> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  other: MoreHorizontal,
};

export function SequenceTemplatesList({
  sequences,
  loading,
  onCreateNew,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleActive,
}: SequenceTemplatesListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [sequenceToDelete, setSequenceToDelete] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const filteredSequences = sequences.filter(seq =>
    seq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seq.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = sequences.filter(s => s.is_active).length;
  const totalSteps = sequences.reduce((sum, s) => sum + (s.steps?.length || 0), 0);

  const handleDuplicate = async (sequenceId: string) => {
    setActionLoading(sequenceId);
    try {
      await onDuplicate(sequenceId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!sequenceToDelete) return;
    setActionLoading(sequenceToDelete);
    try {
      await onDelete(sequenceToDelete);
    } finally {
      setActionLoading(null);
      setDeleteDialogOpen(false);
      setSequenceToDelete(null);
    }
  };

  const handleToggleActive = async (sequenceId: string, isActive: boolean) => {
    setActionLoading(sequenceId);
    try {
      await onToggleActive(sequenceId, isActive);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelete = (sequenceId: string) => {
    setSequenceToDelete(sequenceId);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{sequences.length}</div>
            <p className="text-xs text-muted-foreground">Total Sequences</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalSteps}</div>
            <p className="text-xs text-muted-foreground">Total Steps</p>
          </CardContent>
        </Card>
      </div>

      {/* Header with Search and Create */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search sequences..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={onCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          New Sequence
        </Button>
      </div>

      {/* Sequences List */}
      {filteredSequences.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Workflow className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            {sequences.length === 0 ? (
              <>
                <h3 className="font-medium text-lg mb-2">No sequences yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first sequence template to start automating follow-up tasks.
                </p>
                <Button onClick={onCreateNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Sequence
                </Button>
              </>
            ) : (
              <>
                <h3 className="font-medium text-lg mb-2">No matching sequences</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search query.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSequences.map((sequence) => {
            const isLoading = actionLoading === sequence.id;
            const stepCounts = sequence.steps?.reduce(
              (acc, step) => {
                acc[step.action_type] = (acc[step.action_type] || 0) + 1;
                return acc;
              },
              {} as Record<ActionType, number>
            ) || {};

            const totalDays = sequence.steps?.length
              ? Math.max(...sequence.steps.map(s => s.day_number))
              : 0;

            return (
              <Card
                key={sequence.id}
                className={cn(
                  "transition-all hover:shadow-md",
                  !sequence.is_active && "opacity-60"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{sequence.name}</h3>
                        <Badge
                          variant="outline"
                          className={cn("text-xs shrink-0", targetTypeColors[sequence.target_type])}
                        >
                          {targetTypeLabels[sequence.target_type]}
                        </Badge>
                        {!sequence.is_active && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      {sequence.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                          {sequence.description}
                        </p>
                      )}

                      {/* Steps Summary */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          {sequence.steps?.length || 0} step{(sequence.steps?.length || 0) !== 1 ? 's' : ''}
                        </span>
                        <span>{totalDays} day{totalDays !== 1 ? 's' : ''}</span>

                        {/* Action type breakdown */}
                        <div className="flex items-center gap-2">
                          {Object.entries(stepCounts).map(([type, count]) => {
                            const Icon = actionIcons[type as ActionType];
                            return (
                              <span key={type} className="flex items-center gap-1">
                                <Icon className="w-3 h-3" />
                                {count as React.ReactNode}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Active</span>
                        <Switch
                          checked={sequence.is_active}
                          onCheckedChange={(checked) => handleToggleActive(sequence.id, checked)}
                          disabled={isLoading}
                        />
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isLoading}>
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MoreVertical className="w-4 h-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(sequence)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(sequence.id)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => confirmDelete(sequence.id)}
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
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sequence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sequence? This action cannot be undone.
              Any active instances using this sequence will continue to run but won't receive template updates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
