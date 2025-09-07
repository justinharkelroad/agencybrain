import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadSourceAnalytics } from '@/components/analytics/LeadSourceAnalytics';
import { TrendingUp, Target, DollarSign, Users } from 'lucide-react';

export default function Analytics() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Lead source performance, ROI metrics, and conversion analytics
          </p>
        </div>
      </div>

      <LeadSourceAnalytics />
    </div>
  );
}