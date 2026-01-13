import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { WinbackStatusBadge } from './WinbackStatusBadge';
import { Phone, Mail, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

export interface Household {
  id: string;
  household_key: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: 'untouched' | 'in_progress' | 'won_back' | 'declined' | 'no_contact' | 'dismissed';
  assigned_to: string | null;
  assigned_name?: string | null;
  notes: string | null;
  policy_count: number;
  total_premium_cents: number;
  earliest_winback_date: string | null;
  created_at: string;
  updated_at: string;
}

export type SortColumn = 'name' | 'policy_count' | 'total_premium_cents' | 'earliest_winback_date' | 'status' | 'assigned_name';
export type SortDirection = 'asc' | 'desc';

interface WinbackHouseholdTableProps {
  households: Household[];
  loading: boolean;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
  onRowClick: (household: Household) => void;
}

function SortHeader({
  column,
  currentColumn,
  direction,
  onSort,
  children,
  className,
}: {
  column: SortColumn;
  currentColumn: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const isActive = column === currentColumn;

  return (
    <TableHead
      className={cn('cursor-pointer hover:bg-muted/50 select-none', className)}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {isActive ? (
          direction === 'asc' ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ChevronsUpDown className="h-4 w-4 opacity-30" />
        )}
      </div>
    </TableHead>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function WinbackHouseholdTable({
  households,
  loading,
  sortColumn,
  sortDirection,
  onSort,
  onRowClick,
}: WinbackHouseholdTableProps) {
  const today = startOfDay(new Date());

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (households.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No households found</p>
        <p className="text-sm">Try adjusting your filters or upload new termination data.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader
              column="name"
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
            >
              Name
            </SortHeader>
            <TableHead>Contact</TableHead>
            <SortHeader
              column="policy_count"
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
              className="text-right"
            >
              Policies
            </SortHeader>
            <SortHeader
              column="total_premium_cents"
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
              className="text-right"
            >
              Premium
            </SortHeader>
            <SortHeader
              column="earliest_winback_date"
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
            >
              Win-Back Date
            </SortHeader>
            <SortHeader
              column="status"
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
            >
              Status
            </SortHeader>
            <SortHeader
              column="assigned_name"
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
            >
              Assigned
            </SortHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {households.map((household) => {
            const winbackDate = household.earliest_winback_date
              ? new Date(household.earliest_winback_date)
              : null;
            const isOverdue = winbackDate && isBefore(winbackDate, today);

            return (
              <TableRow
                key={household.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onRowClick(household)}
              >
                <TableCell className="font-medium">
                  {household.first_name} {household.last_name}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {household.phone && (
                      <a
                        href={`tel:${household.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:text-primary/80"
                        title={formatPhone(household.phone)}
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    {household.email && (
                      <a
                        href={`mailto:${household.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:text-primary/80"
                        title={household.email}
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">{household.policy_count}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(household.total_premium_cents)}
                </TableCell>
                <TableCell>
                  {winbackDate ? (
                    <span className={cn(isOverdue && 'text-red-500 font-medium')}>
                      {format(winbackDate, 'MMM d, yyyy')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <WinbackStatusBadge status={household.status} />
                </TableCell>
                <TableCell>
                  {household.assigned_name || (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
