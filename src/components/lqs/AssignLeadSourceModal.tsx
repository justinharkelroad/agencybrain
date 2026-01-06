import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { LqsLeadSource, HouseholdWithRelations } from '@/hooks/useLqsData';

interface AssignLeadSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  household: HouseholdWithRelations | null;
  leadSources: LqsLeadSource[];
  onAssign: (householdId: string, leadSourceId: string) => void;
  isAssigning?: boolean;
  // For bulk assign
  bulkMode?: boolean;
  bulkCount?: number;
  onBulkAssign?: (leadSourceId: string) => void;
}

export function AssignLeadSourceModal({
  open,
  onOpenChange,
  household,
  leadSources,
  onAssign,
  isAssigning,
  bulkMode,
  bulkCount,
  onBulkAssign,
}: AssignLeadSourceModalProps) {
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');

  const handleAssign = () => {
    if (!selectedSourceId) return;

    if (bulkMode && onBulkAssign) {
      onBulkAssign(selectedSourceId);
    } else if (household) {
      onAssign(household.id, selectedSourceId);
    }
    setSelectedSourceId('');
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedSourceId('');
    }
    onOpenChange(isOpen);
  };

  // Group lead sources by bucket
  const groupedSources = leadSources.reduce((acc, source) => {
    const bucketName = source.bucket?.name || 'Unassigned';
    if (!acc[bucketName]) {
      acc[bucketName] = [];
    }
    acc[bucketName].push(source);
    return acc;
  }, {} as Record<string, LqsLeadSource[]>);

  const title = bulkMode
    ? `Assign Lead Source to ${bulkCount} Households`
    : `Assign Lead Source`;

  const description = bulkMode
    ? 'All selected households will be assigned to this lead source.'
    : household
      ? `Assign a lead source to ${household.last_name}, ${household.first_name}`
      : '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="lead-source">Lead Source</Label>
            <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a lead source..." />
              </SelectTrigger>
              <SelectContent side="bottom" position="popper" className="max-h-[300px]">
                {Object.entries(groupedSources).map(([bucketName, sources]) => (
                  <div key={bucketName}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {bucketName}
                    </div>
                    {sources.map(source => (
                      <SelectItem key={source.id} value={source.id}>
                        <div className="flex items-center gap-2">
                          <span>{source.name}</span>
                          {source.is_self_generated && (
                            <span className="text-xs text-muted-foreground">(Self-gen)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={!selectedSourceId || isAssigning}
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
