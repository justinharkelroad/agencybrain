import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useFixQuarterMonths } from "@/hooks/useFixQuarterMonths";
import type { MonthlyMissionsOutput } from "@/hooks/useMonthlyMissions";

interface WrongMonthsAlertProps {
  quarter: string;
  missions: MonthlyMissionsOutput | null;
}

const QUARTER_MONTHS: Record<string, string[]> = {
  'Q1': ['January', 'February', 'March'],
  'Q2': ['April', 'May', 'June'],
  'Q3': ['July', 'August', 'September'],
  'Q4': ['October', 'November', 'December'],
};

function hasWrongMonths(missions: MonthlyMissionsOutput | null, quarter: string): boolean {
  if (!missions) return false;
  
  const quarterPart = quarter.split('-')[1] as keyof typeof QUARTER_MONTHS;
  const expectedMonths = QUARTER_MONTHS[quarterPart];
  
  if (!expectedMonths) return false;
  
  // Check if any domain has missions with wrong month names
  const domains = ['body', 'being', 'balance', 'business'] as const;
  
  for (const domain of domains) {
    const domainMissions = missions[domain];
    if (!domainMissions || typeof domainMissions !== 'object') continue;
    
    // Check target1 and target2
    for (const target of ['target1', 'target2'] as const) {
      const targetMissions = domainMissions[target];
      if (!targetMissions || typeof targetMissions !== 'object') continue;
      
      const monthKeys = Object.keys(targetMissions);
      
      // If any month key is not in the expected months, it's wrong
      for (const monthKey of monthKeys) {
        if (!expectedMonths.includes(monthKey)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

export function WrongMonthsAlert({ quarter, missions }: WrongMonthsAlertProps) {
  const fixQuarterMonths = useFixQuarterMonths();
  
  if (!hasWrongMonths(missions, quarter)) return null;

  const quarterPart = quarter.split('-')[1];
  const expectedMonths = QUARTER_MONTHS[quarterPart as keyof typeof QUARTER_MONTHS] || [];

  return (
    <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium text-foreground mb-1">
            Wrong month labels detected
          </p>
          <p className="text-sm text-muted-foreground">
            Your {quarterPart} plan has incorrect month labels. It should show {expectedMonths.join(", ")} but has different months. Click "Fix Month Labels" to correct this.
          </p>
        </div>
        <Button
          onClick={() => fixQuarterMonths.mutate(quarter)}
          disabled={fixQuarterMonths.isPending}
          size="sm"
          variant="default"
        >
          {fixQuarterMonths.isPending ? 'Fixing...' : 'Fix Month Labels'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
