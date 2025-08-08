import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from 'react-router-dom';

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

export default function PerformanceMetrics() {
  const { user } = useAuth();
  const [latest, setLatest] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatest = async () => {
      if (!user) return;
      setLoading(true);
      const { data } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', user.id)
        .not('form_data', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1);
      setLatest(data && data.length > 0 ? (data[0] as Period) : null);
      setLoading(false);
    };
    fetchLatest();
  }, [user?.id]);

  const kpis = useMemo(() => {
    const fd = latest?.form_data || {};
    return {
      premium: fd?.sales?.premium as number | undefined,
      policies: fd?.sales?.policies as number | undefined,
      netProfit: fd?.cashFlow?.netProfit as number | undefined,
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-16 rounded-md bg-muted animate-pulse" />
              <div className="h-16 rounded-md bg-muted animate-pulse" />
              <div className="h-16 rounded-md bg-muted animate-pulse" />
            </div>
          ) : latest ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  {latest.title} • {new Date(latest.start_date).toLocaleDateString()} – {new Date(latest.end_date).toLocaleDateString()}
                </div>
                <Badge variant={latest.status === 'complete' ? 'default' : latest.status === 'active' ? 'secondary' : 'outline'}>
                  {latest.status}
                </Badge>
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Sales Premium</div>
                  <div className="text-2xl font-semibold">{formatNumber(kpis.premium)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Policies</div>
                  <div className="text-2xl font-semibold">{formatNumber(kpis.policies)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Net Profit</div>
                  <div className="text-2xl font-semibold">{formatNumber(kpis.netProfit)}</div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button asChild size="sm">
                  <Link to={`/submit?mode=update&periodId=${latest.id}`}>View Details</Link>
                </Button>
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
