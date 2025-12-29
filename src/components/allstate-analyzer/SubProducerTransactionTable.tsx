import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InsuredAggregate } from '@/lib/allstate-analyzer/sub-producer-analyzer';

interface Props {
  insureds: InsuredAggregate[];
  type: 'credits' | 'chargebacks';
}

export function SubProducerTransactionTable({ insureds, type }: Props) {
  const isChargeback = type === 'chargebacks';
  
  // Filter out $0.00 net values - they shouldn't exist but just in case
  const nonZeroInsureds = insureds.filter(ins => Math.abs(ins.netPremium) > 0.01);
  
  // Already sorted by analyzer: credits desc, chargebacks asc (most negative first)
  const totalPremium = nonZeroInsureds.reduce((sum, ins) => sum + Math.abs(ins.netPremium), 0);
  const totalCommission = nonZeroInsureds.reduce((sum, ins) => sum + Math.abs(ins.netCommission), 0);
  
  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm px-1">
        <span className="text-muted-foreground">
          {nonZeroInsureds.length} insured{nonZeroInsureds.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-4">
          <span className={isChargeback ? 'text-red-500' : 'text-foreground'}>
            {isChargeback ? '-' : ''}${totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2 })} net premium
          </span>
          <span className={isChargeback ? 'text-red-500' : 'text-foreground'}>
            {isChargeback ? '-' : ''}${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })} net comm
          </span>
        </div>
      </div>
      
      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insured Name</TableHead>
              <TableHead className="text-right">Net Premium</TableHead>
              <TableHead className="text-right">Net Commission</TableHead>
              <TableHead className="text-center w-[80px]">Txns</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nonZeroInsureds.map((ins, idx) => (
              <TableRow key={`${ins.insuredName}-${idx}`}>
                <TableCell className="max-w-[200px] truncate font-medium">
                  {ins.insuredName}
                </TableCell>
                <TableCell className={`text-right ${isChargeback ? 'text-red-500' : ''}`}>
                  {isChargeback ? '-' : ''}${Math.abs(ins.netPremium).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className={`text-right ${isChargeback ? 'text-red-500' : ''}`}>
                  {isChargeback ? '-' : ''}${Math.abs(ins.netCommission).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-center text-muted-foreground text-xs">
                  {ins.transactionCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
