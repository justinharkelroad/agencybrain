import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";

interface DailyActionsManagerProps {
  domainKey: string;
  dailyActions: string[];
  textColor: string;
  onSave?: (actions: string[]) => void;
}

export function DailyActionsManager({
  domainKey,
  dailyActions,
  textColor,
  onSave,
}: DailyActionsManagerProps) {
  const { selectedDailyActions, setSelectedDailyActions } = useLifeTargetsStore();
  const [newAction, setNewAction] = useState('');
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced save: trigger onSave 500ms after last change
  useEffect(() => {
    if (!onSave) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      onSave(dailyActions);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [dailyActions, onSave]);

  const handleAdd = () => {
    if (!newAction.trim()) return;

    const updated = {
      ...selectedDailyActions,
      [domainKey]: [...(selectedDailyActions[domainKey] || []), newAction.trim()],
    };
    setSelectedDailyActions(updated);
    setNewAction('');
  };

  const handleRemove = (index: number) => {
    const updated = {
      ...selectedDailyActions,
      [domainKey]: selectedDailyActions[domainKey].filter((_, i) => i !== index),
    };
    setSelectedDailyActions(updated);
  };

  return (
    <div>
      <h3 className={`font-semibold text-sm uppercase mb-3 ${textColor}`}>
        Daily Actions ({dailyActions.length})
      </h3>

      {dailyActions.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-3">
          No daily actions selected. Add one below.
        </p>
      ) : (
        <div className="space-y-2 mb-3">
          {dailyActions.map((action, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 rounded-lg border border-border/10 bg-card/50"
            >
              <CheckCircle2 className={`h-4 w-4 mt-0.5 flex-shrink-0 ${textColor}`} />
              <p className="text-sm flex-1">{action}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(index)}
                className="h-6 w-6 p-0"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Action */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a daily action..."
          value={newAction}
          onChange={(e) => setNewAction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          className="text-sm"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newAction.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
