import React from 'react';
import { ChevronRight, Trophy, Sparkles } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { PayoutCalculation } from '@/lib/payout-calculator/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  payout: PayoutCalculation;
  formatCurrency: (value: number) => string;
  onClick: () => void;
}

export function PayoutDetailRow({ payout, formatCurrency, onClick }: Props) {
  const hasPromos = payout.achievedPromos && payout.achievedPromos.length > 0;
  const hasSelfGenKicker = payout.selfGenKickerAmount && payout.selfGenKickerAmount > 0;
  const hasBonuses = hasPromos || hasSelfGenKicker;

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          {payout.teamMemberName}
          {/* Bonus indicators */}
          <TooltipProvider>
            {hasPromos && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Trophy className="h-4 w-4 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{payout.achievedPromos!.length} promo{payout.achievedPromos!.length > 1 ? 's' : ''} achieved</p>
                </TooltipContent>
              </Tooltip>
            )}
            {hasSelfGenKicker && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Self-gen kicker: {formatCurrency(payout.selfGenKickerAmount!)}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </TableCell>
      <TableCell className="text-right">{formatCurrency(payout.writtenPremium)}</TableCell>
      <TableCell className="text-right">{formatCurrency(payout.issuedPremium)}</TableCell>
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
    </TableRow>
  );
}