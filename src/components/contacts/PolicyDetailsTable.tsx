import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PremiumChangeDisplay } from './PremiumChangeDisplay';
import type { WinbackPolicyDetail, LqsQuoteDetail, LqsSaleDetail } from '@/types/contact';

// ==================== Winback Policies Table ====================

interface WinbackPoliciesTableProps {
  policies: WinbackPolicyDetail[];
}

export function WinbackPoliciesTable({ policies }: WinbackPoliciesTableProps) {
  if (policies.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">No terminated policies</p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className="h-8 px-2">Policy #</TableHead>
            <TableHead className="h-8 px-2">Product</TableHead>
            <TableHead className="h-8 px-2">Terminated</TableHead>
            <TableHead className="h-8 px-2">Reason</TableHead>
            <TableHead className="h-8 px-2">Premium</TableHead>
            <TableHead className="h-8 px-2">Winback Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {policies.map((policy) => (
            <TableRow key={policy.id} className="text-xs">
              <TableCell className="py-1.5 px-2 font-mono">
                {policy.policy_number}
              </TableCell>
              <TableCell className="py-1.5 px-2">
                {policy.product_name || policy.product_code || '—'}
              </TableCell>
              <TableCell className="py-1.5 px-2">
                {policy.termination_effective_date
                  ? format(new Date(policy.termination_effective_date), 'MMM d, yyyy')
                  : '—'}
              </TableCell>
              <TableCell className="py-1.5 px-2 max-w-[150px] truncate" title={policy.termination_reason || ''}>
                {policy.termination_reason || '—'}
              </TableCell>
              <TableCell className="py-1.5 px-2">
                <PremiumChangeDisplay
                  premiumOld={policy.premium_old_cents}
                  premiumNew={policy.premium_new_cents}
                  changePercent={policy.premium_change_percent}
                  isCents={true}
                  size="sm"
                />
              </TableCell>
              <TableCell className="py-1.5 px-2 text-purple-600 font-medium">
                {policy.calculated_winback_date
                  ? format(new Date(policy.calculated_winback_date), 'MMM d, yyyy')
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ==================== LQS Quotes Table ====================

interface LqsQuotesTableProps {
  quotes: LqsQuoteDetail[];
}

export function LqsQuotesTable({ quotes }: LqsQuotesTableProps) {
  if (quotes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">No quotes recorded</p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className="h-8 px-2">Date</TableHead>
            <TableHead className="h-8 px-2">Product</TableHead>
            <TableHead className="h-8 px-2">Items</TableHead>
            <TableHead className="h-8 px-2">Premium</TableHead>
            <TableHead className="h-8 px-2">Policy #</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((quote) => (
            <TableRow key={quote.id} className="text-xs">
              <TableCell className="py-1.5 px-2">
                {quote.quote_date
                  ? format(new Date(quote.quote_date), 'MMM d, yyyy')
                  : '—'}
              </TableCell>
              <TableCell className="py-1.5 px-2">
                {quote.product_type || '—'}
              </TableCell>
              <TableCell className="py-1.5 px-2">
                {quote.items_quoted}
              </TableCell>
              <TableCell className="py-1.5 px-2 font-medium">
                ${((quote.premium_cents || 0) / 100).toLocaleString()}
              </TableCell>
              <TableCell className="py-1.5 px-2 font-mono">
                {quote.issued_policy_number || '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ==================== LQS Sales Table ====================

interface LqsSalesTableProps {
  sales: LqsSaleDetail[];
}

export function LqsSalesTable({ sales }: LqsSalesTableProps) {
  if (sales.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">No sales recorded</p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className="h-8 px-2">Date</TableHead>
            <TableHead className="h-8 px-2">Product</TableHead>
            <TableHead className="h-8 px-2">Items</TableHead>
            <TableHead className="h-8 px-2">Policies</TableHead>
            <TableHead className="h-8 px-2">Premium</TableHead>
            <TableHead className="h-8 px-2">Policy #</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <TableRow key={sale.id} className="text-xs">
              <TableCell className="py-1.5 px-2">
                {sale.sale_date
                  ? format(new Date(sale.sale_date), 'MMM d, yyyy')
                  : '—'}
              </TableCell>
              <TableCell className="py-1.5 px-2">
                {sale.product_type || '—'}
              </TableCell>
              <TableCell className="py-1.5 px-2">
                {sale.items_sold}
              </TableCell>
              <TableCell className="py-1.5 px-2">
                {sale.policies_sold}
              </TableCell>
              <TableCell className="py-1.5 px-2 font-medium text-green-600">
                ${((sale.premium_cents || 0) / 100).toLocaleString()}
              </TableCell>
              <TableCell className="py-1.5 px-2 font-mono">
                {sale.policy_number || '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default { WinbackPoliciesTable, LqsQuotesTable, LqsSalesTable };
