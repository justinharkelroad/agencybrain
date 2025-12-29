import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SubProducerTransaction } from '@/lib/allstate-analyzer/sub-producer-analyzer';

interface Props {
  transactions: SubProducerTransaction[];
  type: 'credits' | 'chargebacks';
}

export function SubProducerTransactionTable({ transactions, type }: Props) {
  const isChargeback = type === 'chargebacks';
  
  // Sort by absolute premium descending
  const sorted = [...transactions].sort((a, b) => 
    Math.abs(b.premium) - Math.abs(a.premium)
  );
  
  const totalPremium = transactions.reduce((sum, tx) => sum + Math.abs(tx.premium), 0);
  const totalCommission = transactions.reduce((sum, tx) => sum + Math.abs(tx.commission), 0);
  
  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm px-1">
        <span className="text-muted-foreground">
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-4">
          <span className={isChargeback ? 'text-red-500' : 'text-foreground'}>
            {isChargeback ? '-' : ''}${totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2 })} premium
          </span>
          <span className={isChargeback ? 'text-red-500' : 'text-foreground'}>
            {isChargeback ? '-' : ''}${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })} comm
          </span>
        </div>
      </div>
      
      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Policy</TableHead>
              <TableHead>Insured</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Trans Type</TableHead>
              <TableHead className="text-right">Premium</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="w-[90px]">Orig Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((tx, idx) => (
              <TableRow key={`${tx.policyNumber}-${idx}`}>
                <TableCell className="font-mono text-xs">{tx.policyNumber}</TableCell>
                <TableCell className="max-w-[150px] truncate">{tx.insuredName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="truncate max-w-[100px]">{tx.product}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {tx.isAuto ? '6mo' : '12mo'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{tx.transType}</TableCell>
                <TableCell className={`text-right ${isChargeback ? 'text-red-500' : ''}`}>
                  {isChargeback ? '-' : ''}${Math.abs(tx.premium).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className={`text-right ${isChargeback ? 'text-red-500' : ''}`}>
                  {isChargeback ? '-' : ''}${Math.abs(tx.commission).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{tx.origPolicyEffDate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
