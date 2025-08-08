import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PeriodDeleteDialog } from '@/components/PeriodDeleteDialog';
import { Link } from 'react-router-dom';
import { formatDateLocal } from '@/lib/utils';

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

  useEffect(() => {
    fetchPeriods();
  }, [user?.id]);

  return (
    <section aria-labelledby="reporting-periods">
      <Card>
        <CardHeader>
          <CardTitle id="reporting-periods">Reporting Periods</CardTitle>
          <CardDescription>Your 5 most recent periods</CardDescription>
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
            <ul className="divide-y">
              {periods.map((p) => (
                <li key={p.id} className="py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDateLocal(p.start_date)} – {formatDateLocal(p.end_date)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.status === 'complete' ? 'default' : p.status === 'active' ? 'secondary' : 'outline'}>
                      {p.status}
                    </Badge>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/submit?mode=update&periodId=${p.id}`}>Update</Link>
                    </Button>
                    <PeriodDeleteDialog
                      period={p as any}
                      onDelete={fetchPeriods}
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
