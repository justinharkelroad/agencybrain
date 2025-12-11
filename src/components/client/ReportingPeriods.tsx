import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PeriodDeleteDialog } from '@/components/PeriodDeleteDialog';
import { Link } from 'react-router-dom';
import { formatDateLocal } from '@/lib/utils';
import { usePeriodRefresh } from '@/contexts/PeriodRefreshContext';

interface PeriodRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  form_data: any | null;
}

export default function ReportingPeriods() {
  const { user } = useAuth();
  const { refreshKey, triggerRefresh } = usePeriodRefresh();
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPeriods = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('periods')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })
      .limit(5);
    setPeriods((data || []) as PeriodRow[]);
    setLoading(false);
  };

  const handleDelete = () => {
    fetchPeriods();
    triggerRefresh();
  };

  useEffect(() => {
    fetchPeriods();
  }, [user?.id, refreshKey]);

  return (
    <section aria-labelledby="reporting-periods">
      <Card className="border-border/10 bg-muted/20">
        <CardHeader>
          <CardTitle id="reporting-periods" className="font-medium">Reporting Periods</CardTitle>
          <CardDescription className="text-muted-foreground/70">Your 5 most recent periods</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <div className="h-12 rounded-md bg-muted animate-pulse" />
              <div className="h-12 rounded-md bg-muted animate-pulse" />
              <div className="h-12 rounded-md bg-muted animate-pulse" />
            </div>
          ) : periods.length === 0 ? (
            <div className="text-sm text-muted-foreground">No periods yet. Start a new submission above.</div>
          ) : (
            <ul className="space-y-3">
              {periods.map((p) => (
                <li key={p.id} className="py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="font-medium">{p.title}</div>
                      {!/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/.test(p.title) && !/\b\d{4}-\d{2}-\d{2}\b/.test(p.title) && (
                        <div className="text-sm text-muted-foreground/70">
                          {formatDateLocal(p.start_date)} – {formatDateLocal(p.end_date)}
                        </div>
                      )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/70 font-normal">
                      {p.status}
                    </span>
                    <Button asChild size="sm" variant="ghost" title="Edit this period's data - changes will replace existing data">
                      <Link to={`/submit?mode=update&periodId=${p.id}`}>Edit</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/submit?mode=new`}>+ New</Link>
                    </Button>
                    <PeriodDeleteDialog
                      period={p as any}
                      onDelete={handleDelete}
                      isAdmin={false}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
