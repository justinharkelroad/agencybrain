import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from 'react-router-dom';
import { FormViewer } from '@/components/FormViewer';
import { PeriodDeleteDialog } from '@/components/PeriodDeleteDialog';
import { formatDateLocal } from '@/lib/utils';

interface Period {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  form_data: any | null;
}

const formatNumber = (n: number | undefined | null) => {
  if (n === null || n === undefined || isNaN(Number(n))) return '-';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(n));
};

const formatCurrency = (n: number | undefined | null) => {
  if (n === null || n === undefined || isNaN(Number(n))) return '-';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n));
};

export default function PerformanceMetrics() {
  const { user } = useAuth();
  const [latest, setLatest] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);

const fetchLatest = async () => {
  if (!user) return;
  setLoading(true);
  const { data } = await supa
    .from('periods')
    .select('*')
    .eq('user_id', user.id)
    .not('form_data', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1);
  setLatest(data && data.length > 0 ? (data[0] as Period) : null);
  setLoading(false);
};

useEffect(() => {
  fetchLatest();
}, [user?.id]);

const kpis = useMemo(() => {
  const fd = latest?.form_data || {};
  const sales = fd?.sales || {};
  const marketing = fd?.marketing || {};
  const cashFlow = fd?.cashFlow || {};
  return {
    premium: sales.premium as number | undefined,
    policies: sales.policies as number | undefined,
    policiesQuoted: marketing.policiesQuoted as number | undefined,
    achievedVC: Boolean(sales.achievedVC),
    totalMarketingSpend: marketing.totalSpend as number | undefined,
    compensation: cashFlow.compensation as number | undefined,
    expenses: cashFlow.expenses as number | undefined,
    netProfit: (cashFlow.netProfit as number | undefined) ?? (typeof cashFlow.compensation === 'number' && typeof cashFlow.expenses === 'number' ? (cashFlow.compensation - cashFlow.expenses) : undefined),
  };
}, [latest]);

  return (
    <section aria-labelledby="performance-metrics">
      <Card>
        <CardHeader>
          <CardTitle id="performance-metrics">Performance Metrics</CardTitle>
          <CardDescription>Key stats from your most recent submission</CardDescription>
        </CardHeader>
        <CardContent>
{loading ? (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div className="h-16 rounded-md bg-muted animate-pulse" />
    <div className="h-16 rounded-md bg-muted animate-pulse" />
    <div className="h-16 rounded-md bg-muted animate-pulse" />
    <div className="h-16 rounded-md bg-muted animate-pulse" />
  </div>
) : latest ? (
  <div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-sm text-muted-foreground">
        {( /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/.test(latest.title) || /\b\d{4}-\d{2}-\d{2}\b/.test(latest.title) )
          ? latest.title
          : `${latest.title} • ${formatDateLocal(latest.start_date)} – ${formatDateLocal(latest.end_date)}`}

      </div>
      <Badge variant={latest.status === 'complete' ? 'default' : latest.status === 'active' ? 'secondary' : 'outline'}>
        {latest.status}
      </Badge>
    </div>
    <Separator className="my-4" />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">Premium Sold</div>
        <div className="text-2xl font-semibold">{formatCurrency(kpis.premium)}</div>
      </div>
      <div className="rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">Policies Sold</div>
        <div className="text-2xl font-semibold">{formatNumber(kpis.policies)}</div>
      </div>
      <div className="rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">Policies Quoted</div>
        <div className="text-2xl font-semibold">{formatNumber(kpis.policiesQuoted)}</div>
      </div>
      <div className="rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">VC Achieved</div>
        <div className={`text-2xl font-semibold ${kpis.achievedVC ? 'text-green-600' : 'text-red-600'}`}>{kpis.achievedVC ? '✓ Yes' : '✗ No'}</div>
      </div>
      <div className="rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">Total Marketing Spend</div>
        <div className="text-2xl font-semibold">{formatCurrency(kpis.totalMarketingSpend)}</div>
      </div>
      <div className="rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">Agency Compensation</div>
        <div className="text-2xl font-semibold">{formatCurrency(kpis.compensation)}</div>
      </div>
      <div className="rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">Expenses</div>
        <div className="text-2xl font-semibold">{formatCurrency(kpis.expenses)}</div>
      </div>
      <div className="rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">Net Profit</div>
        <div className={`text-2xl font-bold ${typeof kpis.netProfit === 'number' && (kpis.netProfit ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(kpis.netProfit as number | undefined)}</div>
      </div>
    </div>
    <div className="mt-4 flex justify-end gap-2">
      <FormViewer period={latest} triggerButton={<Button size="sm" variant="secondary">View Details</Button>} />
      <Button asChild size="sm">
        <Link to={`/submit?mode=update&periodId=${latest.id}`}>Update</Link>
      </Button>
      <PeriodDeleteDialog period={latest} onDelete={fetchLatest} />
    </div>
  </div>
) : (
  <div className="text-sm text-muted-foreground">No submissions found yet.</div>
)}
        </CardContent>
      </Card>
    </section>
  );
}
