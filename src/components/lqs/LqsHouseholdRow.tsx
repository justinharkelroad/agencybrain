import { useState } from 'react';
import { ChevronRight, ChevronDown, AlertCircle } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { HouseholdWithRelations } from '@/hooks/useLqsData';
import { format, parseISO } from 'date-fns';

interface LqsHouseholdRowProps {
  household: HouseholdWithRelations;
  onAssignLeadSource: (householdId: string) => void;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  showCheckbox?: boolean;
}

function formatProductType(type: string): string {
  // Common product type abbreviations
  const typeMap: Record<string, string> = {
    'Auto': 'Auto',
    'Homeowners': 'Home',
    'Renters': 'Rent',
    'Umbrella': 'Umb',
    'Life': 'Life',
    'Motorcycle': 'MC',
    'Boat': 'Boat',
    'RV': 'RV',
    'Condo': 'Condo',
  };
  return typeMap[type] || type;
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'sold':
      return 'default';
    case 'quoted':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function LqsHouseholdRow({
  household,
  onAssignLeadSource,
  isSelected,
  onSelectChange,
  showCheckbox = false,
}: LqsHouseholdRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const uniqueProducts = [...new Set(household.quotes?.map(q => q.product_type) || [])];
  const totalPremium = household.quotes?.reduce((sum, q) => sum + (q.premium_cents || 0), 0) || 0;

  return (
    <>
      {/* Main Row */}
      <TableRow
        className={cn(
          'cursor-pointer hover:bg-muted/50',
          isSelected && 'bg-muted/30'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Checkbox (optional) */}
        {showCheckbox && (
          <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelectChange}
            />
          </TableCell>
        )}

        {/* Expand Chevron */}
        <TableCell className="w-10">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>

        {/* Name */}
        <TableCell className="font-medium">
          {household.last_name.toUpperCase()}, {household.first_name}
        </TableCell>

        {/* ZIP */}
        <TableCell className="text-muted-foreground">
          {household.zip_code}
        </TableCell>

        {/* Products */}
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {uniqueProducts.map(product => (
              <Badge key={product} variant="outline" className="text-xs">
                {formatProductType(product)}
              </Badge>
            ))}
          </div>
        </TableCell>

        {/* Premium */}
        <TableCell className="font-medium">
          ${(totalPremium / 100).toLocaleString()}
        </TableCell>

        {/* Lead Source */}
        <TableCell onClick={(e) => e.stopPropagation()}>
          {household.lead_source ? (
            <span className="text-sm">
              {household.lead_source.name}
              {household.lead_source.bucket && (
                <span className="text-muted-foreground text-xs ml-1">
                  ({household.lead_source.bucket.name})
                </span>
              )}
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onAssignLeadSource(household.id)}
            >
              Assign Source
            </Button>
          )}
        </TableCell>

        {/* Producer */}
        <TableCell className="text-muted-foreground">
          {household.team_member?.full_name || '—'}
        </TableCell>

        {/* Status */}
        <TableCell>
          <Badge variant={getStatusVariant(household.status)}>
            {household.status.charAt(0).toUpperCase() + household.status.slice(1)}
          </Badge>
        </TableCell>

        {/* Attention */}
        <TableCell>
          {household.needs_attention && (
            <AlertCircle className="h-4 w-4 text-orange-500" />
          )}
        </TableCell>
      </TableRow>

      {/* Expanded Quote Details */}
      {isExpanded && household.quotes?.map(quote => (
        <TableRow key={quote.id} className="bg-muted/20">
          {showCheckbox && <TableCell />}
          <TableCell />
          <TableCell className="pl-8 text-sm text-muted-foreground">
            └─ {quote.product_type}
          </TableCell>
          <TableCell />
          <TableCell />
          <TableCell className="text-sm">
            ${(quote.premium_cents / 100).toLocaleString()}
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {quote.quote_date ? format(parseISO(quote.quote_date), 'MMM d, yyyy') : '—'}
          </TableCell>
          <TableCell />
          <TableCell className="text-sm">
            {quote.issued_policy_number && (
              <span className="text-green-600 dark:text-green-400">
                Policy: {quote.issued_policy_number}
              </span>
            )}
          </TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}
