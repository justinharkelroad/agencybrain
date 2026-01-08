import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLeadSourceMonthlySpend } from '@/hooks/useLeadSourceMonthlySpend';
import { CostType } from '@/types/lqs';
import { format } from 'date-fns';

interface LeadSourceSpendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadSourceId: string | null;
  leadSourceName: string;
  costType: CostType;
  agencyId: string;
}

const COST_TYPE_LABELS: Record<CostType, { unitLabel: string; pluralLabel: string }> = {
  per_lead: { unitLabel: 'Cost Per Lead', pluralLabel: 'Leads Received' },
  per_transfer: { unitLabel: 'Cost Per Transfer', pluralLabel: 'Transfers Received' },
  per_mailer: { unitLabel: 'Cost Per Mailer', pluralLabel: 'Mailers Sent' },
  monthly_fixed: { unitLabel: 'Total Monthly Spend', pluralLabel: '' },
};

export const LeadSourceSpendModal = ({
  open,
  onOpenChange,
  leadSourceId,
  leadSourceName,
  costType,
  agencyId,
}: LeadSourceSpendModalProps) => {
  const {
    spendHistory,
    currentSpend,
    loading,
    fetchSpendHistory,
    fetchSpendForMonth,
    upsertSpend,
    getMonthOptions,
  } = useLeadSourceMonthlySpend(leadSourceId, agencyId);

  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [costPerUnit, setCostPerUnit] = useState<string>('');
  const [unitsCount, setUnitsCount] = useState<string>('');
  const [totalSpend, setTotalSpend] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthOptions = getMonthOptions(12);
  const isFixedCost = costType === 'monthly_fixed';
  const labels = COST_TYPE_LABELS[costType];

  // Load data when modal opens or month changes
  useEffect(() => {
    if (open && leadSourceId) {
      fetchSpendHistory();
      fetchSpendForMonth(selectedMonth);
    }
  }, [open, leadSourceId, selectedMonth]);

  // Populate form when current spend loads
  useEffect(() => {
    if (currentSpend) {
      setCostPerUnit(currentSpend.cost_per_unit_cents ? (currentSpend.cost_per_unit_cents / 100).toString() : '');
      setUnitsCount(currentSpend.units_count ? currentSpend.units_count.toString() : '');
      setTotalSpend((currentSpend.total_spend_cents / 100).toString());
      setNotes(currentSpend.notes || '');
    } else {
      setCostPerUnit('');
      setUnitsCount('');
      setTotalSpend('');
      setNotes('');
    }
  }, [currentSpend]);

  // Auto-calculate total for per-unit cost types
  useEffect(() => {
    if (!isFixedCost) {
      const cost = parseFloat(costPerUnit) || 0;
      const units = parseInt(unitsCount) || 0;
      setTotalSpend((cost * units).toFixed(2));
    }
  }, [costPerUnit, unitsCount, isFixedCost]);

  const handleMonthChange = (monthStr: string) => {
    const date = new Date(monthStr);
    setSelectedMonth(date);
    setError(null);
  };

  const handleSave = async () => {
    if (!leadSourceId) return;

    const total = parseFloat(totalSpend) || 0;
    if (total <= 0) {
      setError('Total spend must be greater than 0');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const success = await upsertSpend(selectedMonth, {
        cost_per_unit_cents: isFixedCost ? null : Math.round((parseFloat(costPerUnit) || 0) * 100),
        units_count: isFixedCost ? null : parseInt(unitsCount) || null,
        total_spend_cents: Math.round(total * 100),
        notes: notes.trim() || null,
      });

      if (!success) {
        setError('Failed to save spend data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Monthly Spend - {leadSourceName}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Month Selector */}
          <div className="grid gap-2">
            <Label>Select Month</Label>
            <Select
              value={selectedMonth.toISOString()}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value.toISOString()} value={option.value.toISOString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Spend Entry Form */}
          <div className="grid gap-4">
            {!isFixedCost && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="cost-per-unit">{labels.unitLabel}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      id="cost-per-unit"
                      type="number"
                      min={0}
                      step={0.01}
                      value={costPerUnit}
                      onChange={(e) => setCostPerUnit(e.target.value)}
                      placeholder="0.00"
                      className="w-32"
                      disabled={loading || saving}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="units-count">{labels.pluralLabel}</Label>
                  <Input
                    id="units-count"
                    type="number"
                    min={0}
                    step={1}
                    value={unitsCount}
                    onChange={(e) => setUnitsCount(e.target.value)}
                    placeholder="0"
                    className="w-32"
                    disabled={loading || saving}
                  />
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="total-spend">
                {isFixedCost ? 'Total Monthly Spend' : 'Total Spend (calculated)'}
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  id="total-spend"
                  type="number"
                  min={0}
                  step={0.01}
                  value={totalSpend}
                  onChange={(e) => setTotalSpend(e.target.value)}
                  placeholder="0.00"
                  className="w-32"
                  disabled={loading || saving || !isFixedCost}
                  readOnly={!isFixedCost}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this month's spend..."
                className="resize-none"
                rows={2}
                disabled={loading || saving}
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button onClick={handleSave} disabled={loading || saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>

          {/* Historical View */}
          {spendHistory.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Spend History (Last 6 Months)</h4>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      {!isFixedCost && <TableHead>Cost/Unit</TableHead>}
                      {!isFixedCost && <TableHead>Units</TableHead>}
                      <TableHead>Total</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spendHistory.map((spend) => (
                      <TableRow key={spend.id}>
                        <TableCell>{format(new Date(spend.month + 'T12:00:00'), 'MMM yyyy')}</TableCell>
                        {!isFixedCost && (
                          <TableCell>
                            {spend.cost_per_unit_cents
                              ? formatCurrency(spend.cost_per_unit_cents)
                              : '-'}
                          </TableCell>
                        )}
                        {!isFixedCost && (
                          <TableCell>{spend.units_count || '-'}</TableCell>
                        )}
                        <TableCell>{formatCurrency(spend.total_spend_cents)}</TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {spend.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
