import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { LqsHouseholdRow } from './LqsHouseholdRow';
import { HouseholdWithRelations } from '@/hooks/useLqsData';

interface LqsHouseholdTableProps {
  households: HouseholdWithRelations[];
  loading?: boolean;
  onAssignLeadSource: (householdId: string) => void;
  onBulkAssign?: (householdIds: string[]) => void;
  showBulkSelect?: boolean;
  onViewHouseholdDetail?: (household: HouseholdWithRelations) => void;
  onViewSaleDetail?: (saleId: string) => void;
}

export function LqsHouseholdTable({
  households,
  loading,
  onAssignLeadSource,
  onBulkAssign,
  showBulkSelect = false,
  onViewHouseholdDetail,
  onViewSaleDetail,
}: LqsHouseholdTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Only households needing attention can be bulk assigned
  const selectableHouseholds = useMemo(
    () => households.filter(h => h.needs_attention),
    [households]
  );

  const allSelected = selectableHouseholds.length > 0 && 
    selectableHouseholds.every(h => selectedIds.has(h.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(selectableHouseholds.map(h => h.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAssign = () => {
    if (onBulkAssign && selectedIds.size > 0) {
      onBulkAssign(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (households.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No households found matching your filters.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Bulk Action Bar */}
      {showBulkSelect && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button size="sm" onClick={handleBulkAssign}>
            Assign Selected ({selectedIds.size})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {showBulkSelect && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    disabled={selectableHouseholds.length === 0}
                  />
                </TableHead>
              )}
              <TableHead className="w-10" />
              <TableHead>Name</TableHead>
              <TableHead>ZIP</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Premium</TableHead>
              <TableHead>Lead Source</TableHead>
              <TableHead>Producer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {households.map(household => (
              <LqsHouseholdRow
                key={household.id}
                household={household}
                onAssignLeadSource={onAssignLeadSource}
                isSelected={selectedIds.has(household.id)}
                onSelectChange={(checked) => handleSelectOne(household.id, checked)}
                showCheckbox={showBulkSelect && household.needs_attention}
                onViewDetail={onViewHouseholdDetail}
                onViewSaleDetail={onViewSaleDetail}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
