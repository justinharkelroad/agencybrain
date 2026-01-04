import React from 'react';
import { ChevronRight } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { PayoutCalculation } from '@/lib/payout-calculator/types';

interface Props {
  payout: PayoutCalculation;
  formatCurrency: (value: number) => string;
  getStatusBadge: (status: string) => React.ReactNode;
  onClick: () => void;
}

export function PayoutDetailRow({ payout, formatCurrency, getStatusBadge, onClick }: Props) {
  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          {payout.teamMemberName}
        </div>
      </TableCell>
      <TableCell>{payout.compPlanName}</TableCell>
      <TableCell className="text-right">{formatCurrency(payout.writtenPremium)}</TableCell>
      <TableCell className="text-right">{formatCurrency(payout.netPremium)}</TableCell>
      <TableCell className="text-right">
        {payout.tierMatch 
          ? formatCurrency(payout.tierMatch.minThreshold) 
          : "-"}
      </TableCell>
      <TableCell className="text-right">
        {payout.tierCommissionValue > 0 
          ? `${payout.tierCommissionValue}%` 
          : "-"}
      </TableCell>
      <TableCell className="text-right font-bold text-primary">
        {formatCurrency(payout.totalPayout)}
      </TableCell>
      <TableCell>{getStatusBadge(payout.status)}</TableCell>
    </TableRow>
  );
}