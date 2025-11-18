import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ArrowRight, Pencil, Plus, X } from "lucide-react";
import type { DailyActionsOutput } from "@/hooks/useDailyActions";
import { toast } from "sonner";

interface DailyActionsSelectorProps {
  actions: DailyActionsOutput;
  selectedActions?: Record<string, string[]>;
  onSelectionsChange?: (selections: Record<string, string[]>) => void;
  onActionsChange?: (actions: DailyActionsOutput) => void;
  onContinue?: () => void;
}

const DOMAINS = [
  { key: 'body', label: 'Body', color: 'text-blue-600 dark:text-blue-400' },
  { key: 'being', label: 'Being', color: 'text-purple-600 dark:text-purple-400' },
  { key: 'balance', label: 'Balance', color: 'text-green-600 dark:text-green-400' },
  { key: 'business', label: 'Business', color: 'text-orange-600 dark:text-orange-400' },
] as const;

function DomainActions({
  domainKey,
  label,
  color,
  actions,
  selectedActions,
  onToggle,
  editingAction,
  editText,
  onEditStart,
  onEditSave,
  onEditCancel,
  onEditTextChange,
  addingCustom,
  customText,
  onAddCustomStart,
  onAddCustomSave,
  onAddCustomCancel,
  onCustomTextChange,
}: {
  domainKey: string;
  label: string;
  color: string;
  actions: string[];
  selectedActions: string[];
  onToggle: (action: string) => void;
  editingAction: { domain: string; index: number } | null;
  editText: string;
  onEditStart: (domain: string, index: number, text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onEditTextChange: (text: string) => void;
  addingCustom: string | null;
  customText: string;
  onAddCustomStart: (domain: string) => void;
  onAddCustomSave: (domain: string) => void;
  onAddCustomCancel: () => void;
  onCustomTextChange: (text: string) => void;
}) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${color}`}>{label}</h3>
        {selectedActions.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>{selectedActions.length} selected</span>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action, index) => {
          const isSelected = selectedActions.includes(action);
          const isEditing = editingAction?.domain === domainKey && editingAction?.index === index;

          return (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors group ${
                isEditing ? 'ring-2 ring-primary' :
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              {!isEditing && (
                <Checkbox
                  checked={isSelected}
                  className="mt-0.5"
                  onClick={() => onToggle(action)}
                />
              )}
              {isEditing ? (
                <div className="flex-1 space-y-2">
                  <Input
                    value={editText}
                    onChange={(e) => onEditTextChange(e.target.value)}
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={onEditSave}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={onEditCancel}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm flex-1 cursor-pointer" onClick={() => onToggle(action)}>{action}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditStart(domainKey, index, action);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Custom Action */}
      {addingCustom === domainKey ? (
        <div className="flex gap-2 items-center p-3 border rounded-lg">
          <Input
            placeholder="Enter custom action..."
            value={customText}
            onChange={(e) => onCustomTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAddCustomSave(domainKey);
              if (e.key === 'Escape') onAddCustomCancel();
            }}
            autoFocus
          />
          <Button size="sm" onClick={() => onAddCustomSave(domainKey)}>Add</Button>
          <Button size="sm" variant="ghost" onClick={onAddCustomCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddCustomStart(domainKey)}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Custom Action
        </Button>
      )}
    </div>
  );
}

export function DailyActionsSelector({
  actions,
  selectedActions: externalSelections,
  onSelectionsChange,
  onActionsChange,
  onContinue,
}: DailyActionsSelectorProps) {
  const [selectedActions, setSelectedActions] = useState<Record<string, string[]>>(
    externalSelections || {
      body: [],
      being: [],
      balance: [],
      business: [],
    }
  );
  const [editingAction, setEditingAction] = useState<{ domain: string; index: number } | null>(null);
  const [editText, setEditText] = useState('');
  const [addingToDomain, setAddingToDomain] = useState<string | null>(null);
  const [newActionText, setNewActionText] = useState('');

  useEffect(() => {
    if (externalSelections) {
      setSelectedActions(externalSelections);
    }
  }, [externalSelections]);

  const handleToggle = (domain: string, action: string) => {
    setSelectedActions((prev) => {
      const domainSelections = prev[domain] || [];
      const isSelected = domainSelections.includes(action);
      
      const newSelections = {
        ...prev,
        [domain]: isSelected
          ? domainSelections.filter(a => a !== action)
          : [...domainSelections, action]
      };

      onSelectionsChange?.(newSelections);
      return newSelections;
    });
  };

  const handleEditAction = () => {
    if (!editText.trim()) {
      toast.error('Action cannot be empty');
      return;
    }
    if (!editingAction) return;

    const { domain, index } = editingAction;
    const updatedActions = {
      ...actions,
      [domain]: [...(actions[domain] || [])],
    };
    updatedActions[domain][index] = editText;

    // Update selection if the old action was selected
    const oldAction = actions[domain]?.[index];
    if (oldAction && selectedActions[domain]?.includes(oldAction)) {
      const newSelections = {
        ...selectedActions,
        [domain]: selectedActions[domain].map(a => a === oldAction ? editText : a)
      };
      setSelectedActions(newSelections);
      onSelectionsChange?.(newSelections);
    }

    onActionsChange?.(updatedActions as DailyActionsOutput);
    setEditingAction(null);
    setEditText('');
    toast.success('Action updated');
  };

  const handleAddCustom = (domain: string) => {
    if (!newActionText.trim()) return;

    const updatedActions = {
      ...actions,
      [domain]: [...(actions[domain] || []), newActionText.trim()],
    };

    // Auto-select the new custom action
    const newSelections = {
      ...selectedActions,
      [domain]: [...(selectedActions[domain] || []), newActionText.trim()]
    };

    setSelectedActions(newSelections);
    onSelectionsChange?.(newSelections);
    onActionsChange?.(updatedActions as DailyActionsOutput);

    setNewActionText('');
    setAddingToDomain(null);
    toast.success('Custom action added');
  };

  const totalSelected = Object.values(selectedActions).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  const hasActiveTargets = DOMAINS.some(domain => 
    actions[domain.key] && actions[domain.key].length > 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Your Daily Actions</CardTitle>
        <CardDescription>
          Choose one or more daily actions for each domain. These will form your daily habits to achieve your quarterly targets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {DOMAINS.map((domain) => {
          const domainActions = actions[domain.key];
          if (!domainActions || domainActions.length === 0) return null;

          return (
            <DomainActions
              key={domain.key}
              domainKey={domain.key}
              label={domain.label}
              color={domain.color}
              actions={domainActions}
              selectedActions={selectedActions[domain.key] || []}
              onToggle={(action) => handleToggle(domain.key, action)}
              editingAction={editingAction}
              editText={editText}
              onEditStart={(d, i, t) => {
                setEditingAction({ domain: d, index: i });
                setEditText(t);
              }}
              onEditSave={handleEditAction}
              onEditCancel={() => {
                setEditingAction(null);
                setEditText('');
              }}
              onEditTextChange={setEditText}
              addingCustom={addingToDomain}
              customText={newActionText}
              onAddCustomStart={setAddingToDomain}
              onAddCustomSave={handleAddCustom}
              onAddCustomCancel={() => {
                setAddingToDomain(null);
                setNewActionText('');
              }}
              onCustomTextChange={setNewActionText}
            />
          );
        })}

        {!hasActiveTargets && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No daily actions available. Please set your quarterly targets first.</p>
          </div>
        )}

        {hasActiveTargets && onContinue && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {totalSelected === 0 
                  ? 'Select at least one action to continue' 
                  : `${totalSelected} action${totalSelected === 1 ? '' : 's'} selected`}
              </p>
            </div>
            <Button
              onClick={onContinue}
              disabled={totalSelected === 0}
              className="w-full"
              size="lg"
            >
              Continue to Cascade View
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
