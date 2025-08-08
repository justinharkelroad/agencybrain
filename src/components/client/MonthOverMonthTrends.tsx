import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatDateLocal } from '@/lib/utils';

interface PeriodRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  form_data: any | null;
}

function numberOrUndefined(v: any): number | undefined {
  return typeof v === 'number' && !isNaN(v) ? v : undefined;
}

function formatNumber(n: number | undefined | null) {
  if (n === null || n === undefined || isNaN(Number(n))) return '-';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(n));
}

function formatCurrency(n: number | undefined | null) {
  if (n === null || n === undefined || isNaN(Number(n))) return '-';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n));
}

function labelForPeriod(p: PeriodRow): string {
  const titleHasDate = /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/.test(p.title) || /\b\d{4}-\d{2}-\d{2}\b/.test(p.title);
  return titleHasDate ? p.title : `${p.title} • ${formatDateLocal(p.start_date)} – ${formatDateLocal(p.end_date)}`;
}

export default function MonthOverMonthTrends() {
  const { user } = useAuth();
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPeriods = async () => {
      if (!user) return;
      setLoading(true);
      const { data } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(6);
      setPeriods((data || []) as PeriodRow[]);
      setLoading(false);
    };
    fetchPeriods();
  }, [user?.id]);

  const [current, previous] = periods;

  const kpis = useMemo(() => {
    const curr = current?.form_data || {};
    const prev = previous?.form_data || {};

    const cSales = curr.sales || {};
    const pSales = prev.sales || {};
    const cMarketing = curr.marketing || {};
    const pMarketing = prev.marketing || {};
    const cCash = curr.cashFlow || {};
    const pCash = prev.cashFlow || {};

    const cPremium = numberOrUndefined(cSales.premium);
    const pPremium = numberOrUndefined(pSales.premium);
    const cPolicies = numberOrUndefined(cSales.policies);
    const pPolicies = numberOrUndefined(pSales.policies);

    const cQuoted = numberOrUndefined(cMarketing.policiesQuoted);
    const pQuoted = numberOrUndefined(pMarketing.policiesQuoted);
    const cSpend = numberOrUndefined(cMarketing.totalSpend);
    const pSpend = numberOrUndefined(pMarketing.totalSpend);

    const cComp = numberOrUndefined(cCash.compensation);
    const pComp = numberOrUndefined(pCash.compensation);
    const cExp = numberOrUndefined(cCash.expenses);
    const pExp = numberOrUndefined(pCash.expenses);

    const cNet = typeof cCash.netProfit === 'number' ? cCash.netProfit : (typeof cComp === 'number' && typeof cExp === 'number' ? cComp - cExp : undefined);
    const pNet = typeof pCash.netProfit === 'number' ? pCash.netProfit : (typeof pComp === 'number' && typeof pExp === 'number' ? pComp - pExp : undefined);

    return {
      premium: { curr: cPremium, prev: pPremium },
      policies: { curr: cPolicies, prev: pPolicies },
      quoted: { curr: cQuoted, prev: pQuoted },
      marketingSpend: { curr: cSpend, prev: pSpend },
      compensation: { curr: cComp, prev: pComp },
      expenses: { curr: cExp, prev: pExp },
      netProfit: { curr: cNet, prev: pNet },
    };
  }, [current, previous]);

  function delta(a?: number, b?: number) {
    if (typeof a !== 'number' || typeof b !== 'number') return { abs: undefined as number | undefined, pct: undefined as number | undefined };
    const d = a - b;
    const pct = b === 0 ? undefined : (d / b) * 100;
    return { abs: d, pct };
  }

  const dPremium = delta(kpis.premium.curr, kpis.premium.prev);
  const dPolicies = delta(kpis.policies.curr, kpis.policies.prev);
  const dQuoted = delta(kpis.quoted.curr, kpis.quoted.prev);
  const dSpend = delta(kpis.marketingSpend.curr, kpis.marketingSpend.prev);
  const dComp = delta(kpis.compensation.curr, kpis.compensation.prev);
  const dExp = delta(kpis.expenses.curr, kpis.expenses.prev);
  const dNet = delta(kpis.netProfit.curr, kpis.netProfit.prev);

  const Trend = ({ label, curr, del, isCurrency }: { label: string; curr?: number; del: { abs?: number; pct?: number }; isCurrency?: boolean }) => {
    const up = typeof del.abs === 'number' ? del.abs > 0 : undefined;
    const down = typeof del.abs === 'number' ? del.abs < 0 : undefined;
    const zero = typeof del.abs === 'number' ? del.abs === 0 : undefined;
    const Color = up ? 'text-primary' : down ? 'text-destructive' : 'text-muted-foreground';
    const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
    return (
      <div className="rounded-lg border p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{isCurrency ? formatCurrency(curr) : formatNumber(curr)}</div>
        {typeof del.abs === 'number' ? (
          <div className={`mt-1 flex items-center gap-1 text-sm ${Color}`}>
            <Icon className="h-4 w-4" />
            <span>{isCurrency ? formatCurrency(del.abs) : formatNumber(del.abs)}</span>
            {typeof del.pct === 'number' && (
              <span className="text-muted-foreground">({new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(del.pct)}%)</span>
            )}
          </div>
        ) : (
          <div className="mt-1 text-sm text-muted-foreground">No previous period</div>
        )}
      </div>
    );
  };

  return (
    <section aria-labelledby="mom-trends">
      <Card>
        <CardHeader>
          <CardTitle id="mom-trends">Month-over-Month Trends</CardTitle>
          <CardDescription>Latest vs previous period</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="h-16 rounded-md bg-muted animate-pulse" />
              <div className="h-16 rounded-md bg-muted animate-pulse" />
              <div className="h-16 rounded-md bg-muted animate-pulse" />
              <div className="h-16 rounded-md bg-muted animate-pulse" />
              <div className="h-16 rounded-md bg-muted animate-pulse" />
              <div className="h-16 rounded-md bg-muted animate-pulse" />
              <div className="h-16 rounded-md bg-muted animate-pulse" />
            </div>
          ) : !current ? (
            <div className="text-sm text-muted-foreground">No submissions yet.</div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <div>
                  {labelForPeriod(current)}
                  {previous && (
                    <>
                      {' '}vs{' '}
                      <span>{labelForPeriod(previous)}</span>
                    </>
                  )}
                </div>
                {periods.length > 1 && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">View comparisons</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-5xl">
                      <DialogHeader>
                        <DialogTitle>Comparisons</DialogTitle>
                      </DialogHeader>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Period</TableHead>
                              <TableHead className="text-right">Premium Sold</TableHead>
                              <TableHead className="text-right">Policies Sold</TableHead>
                              <TableHead className="text-right">Policies Quoted</TableHead>
                              <TableHead className="text-right">Total Marketing Spend</TableHead>
                              <TableHead className="text-right">Agency Compensation</TableHead>
                              <TableHead className="text-right">Expenses</TableHead>
                              <TableHead className="text-right">Net Profit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {periods.map((p) => {
                              const fd = (p.form_data || {}) as any;
                              const sales = fd.sales || {};
                              const marketing = fd.marketing || {};
                              const cash = fd.cashFlow || {};
                              const premium = numberOrUndefined(sales.premium);
                              const policies = numberOrUndefined(sales.policies);
                              const quoted = numberOrUndefined(marketing.policiesQuoted);
                              const spend = numberOrUndefined(marketing.totalSpend);
                              const comp = numberOrUndefined(cash.compensation);
                              const exp = numberOrUndefined(cash.expenses);
                              const net = typeof cash.netProfit === 'number' ? cash.netProfit : (typeof comp === 'number' && typeof exp === 'number' ? comp - exp : undefined);
                              return (
                                <TableRow key={p.id}>
                                  <TableCell className="max-w-[280px] truncate">{labelForPeriod(p)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(premium)}</TableCell>
                                  <TableCell className="text-right">{formatNumber(policies)}</TableCell>
                                  <TableCell className="text-right">{formatNumber(quoted)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(spend)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(comp)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(exp)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(net)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <Trend label="Premium Sold" curr={kpis.premium.curr} del={dPremium} isCurrency />
                <Trend label="Policies Sold" curr={kpis.policies.curr} del={dPolicies} />
                <Trend label="Policies Quoted" curr={kpis.quoted.curr} del={dQuoted} />
                <Trend label="Total Marketing Spend" curr={kpis.marketingSpend.curr} del={dSpend} isCurrency />
                <Trend label="Agency Compensation" curr={kpis.compensation.curr} del={dComp} isCurrency />
                <Trend label="Expenses" curr={kpis.expenses.curr} del={dExp} isCurrency />
                <Trend label="Net Profit" curr={kpis.netProfit.curr} del={dNet} isCurrency />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
