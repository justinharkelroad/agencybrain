import React, { useState, useMemo } from 'react';
import { Users, ChevronRight, TrendingDown, DollarSign, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SubProducerModal } from './SubProducerModal';
import { SubProducerSummary, TeamMemberForLookup, getProducerDisplayName } from '@/lib/allstate-analyzer/sub-producer-analyzer';

interface Props {
  data: SubProducerSummary;
  period: string;
  teamMembers?: TeamMemberForLookup[];
}

export function SubProducerSummaryCard({ data, period, teamMembers = [] }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { totals, producerCount } = data;
  
  // Enrich producers with team member names
  const enrichedData = useMemo(() => {
    return {
      ...data,
      producers: data.producers.map(p => ({
        ...p,
        displayName: getProducerDisplayName(p.code, teamMembers)
      }))
    };
  }, [data, teamMembers]);
  
  // Find producer with most chargebacks (for highlighting)
  const highestChargebackProducer = enrichedData.producers
    .filter(p => p.premiumChargebacks > 0)
    .sort((a, b) => b.premiumChargebacks - a.premiumChargebacks)[0];
  
  // Don't render if no producers found
  if (producerCount === 0) {
    return null;
  }
  
  return (
    <>
      <Card 
        className="cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => setIsModalOpen(true)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sub-Producer Breakdown
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1">
              View All <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            New Business by Sub-Producer Code
          </p>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="flex justify-center mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold">{producerCount}</div>
              <div className="text-xs text-muted-foreground">Producers</div>
            </div>
            
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="flex justify-center mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold">
                ${totals.premiumWritten.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-muted-foreground">Issued</div>
            </div>
            
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="flex justify-center mb-1">
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
              <div className="text-xl font-bold text-red-500">
                ${totals.premiumChargebacks.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-muted-foreground">Chargebacks</div>
            </div>
            
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="flex justify-center mb-1">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold">
                {totals.creditCount || 0} / {totals.chargebackCount || 0}
              </div>
              <div className="text-xs text-muted-foreground">Credits / CB</div>
            </div>
          </div>
          
          {/* Chargeback Alert */}
          {highestChargebackProducer && highestChargebackProducer.premiumChargebacks > 1000 && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">
                <span className="font-medium">
                  {highestChargebackProducer.displayName}
                </span>
                {' '}has the highest chargebacks: 
                <span className="font-bold">
                  {' '}-${highestChargebackProducer.premiumChargebacks.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <SubProducerModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        data={enrichedData}
        period={period}
      />
    </>
  );
}
