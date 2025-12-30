import React from 'react';
import { Users, Download, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SubProducerCard } from './SubProducerCard';
import { SubProducerSummary } from '@/lib/allstate-analyzer/sub-producer-analyzer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: SubProducerSummary;
  period: string;
}

export function SubProducerModal({ isOpen, onClose, data, period }: Props) {
  
  // Filter out sub-producers with zero activity (net premium AND net commission both zero)
  const activeProducers = data.producers.filter(
    p => Math.abs(p.netPremium) > 0.005 || Math.abs(p.netCommission) > 0.005
  );
  
  const formatCutoffDate = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    // Handle both Date objects and ISO string dates (from JSON serialization)
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'N/A';
    return dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };
  
  const exportToCsv = () => {
    const headers = [
      'Sub-Producer Code',
      'Premium Written',
      'Premium Chargebacks',
      'Net Premium',
      'Policies Issued',
      'Items Issued',
      'Chargebacks',
      'Commission Earned',
      'Commission Chargebacks',
      'Net Commission',
      'Effective Rate %'
    ];
    
    const rows = data.producers.map(p => [
      p.code || 'Agency',
      p.premiumWritten.toFixed(2),
      p.premiumChargebacks.toFixed(2),
      p.netPremium.toFixed(2),
      p.policiesIssued,
      p.itemsIssued,
      p.chargebackCount,
      p.commissionEarned.toFixed(2),
      p.commissionChargebacks.toFixed(2),
      p.netCommission.toFixed(2),
      p.effectiveRate.toFixed(2)
    ]);
    
    // Add totals row
    rows.push([
      'TOTAL',
      data.totals.premiumWritten.toFixed(2),
      data.totals.premiumChargebacks.toFixed(2),
      data.totals.netPremium.toFixed(2),
      data.totals.policiesIssued.toString(),
      data.totals.itemsIssued.toString(),
      data.totals.chargebackCount.toString(),
      data.totals.commissionEarned.toFixed(2),
      data.totals.commissionChargebacks.toFixed(2),
      data.totals.netCommission.toFixed(2),
      data.totals.effectiveRate.toFixed(2)
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sub_producer_breakdown_${period.replace(/\s/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sub-Producer Breakdown
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={exportToCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            New Business Performance by Sub-Producer Code • {period}
          </p>
          {/* First-term cutoff info */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              First-term only: Auto policies from {formatCutoffDate(data.autoCutoffDate)}+, 
              Home/Other from {formatCutoffDate(data.homeCutoffDate)}+
            </span>
          </div>
        </DialogHeader>
        
        {/* Totals Summary */}
        <div className="grid grid-cols-4 gap-4 py-4 border-b">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {activeProducers.length}
            </div>
            <div className="text-xs text-muted-foreground">Active Producers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              ${data.totals.netPremium.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground">Net Premium</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              ${data.totals.netCommission.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground">Net Commission</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">
              ${data.totals.premiumChargebacks.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground">Total Chargebacks</div>
          </div>
        </div>
        
        {/* Producer Cards */}
        <div className="grid gap-4 mt-4">
          {activeProducers.map((producer) => (
            <SubProducerCard key={producer.code || 'agency'} producer={producer} isAgency={producer.code === ''} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
