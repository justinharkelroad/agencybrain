import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, LayoutDashboard, Upload, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface FormData {
  sales: {
    premium: number;
    items: number;
    policies: number;
    achievedVC: boolean;
  };
  marketing: {
    totalSpend: number;
    policiesQuoted: number;
    leadSources: { name: string; spend: number; soldPremium?: number; commissionRate?: number }[];
  };
  operations: {
    currentAlrTotal: number;
    currentAapProjection: string;
    currentBonusTrend: number;
    teamRoster: { name: string; role: string }[];
  };
  retention: {
    numberTerminated: number;
    currentRetentionPercent: number;
  };
  cashFlow: {
    compensation: number;
    expenses: number;
    netProfit: number;
  };
  qualitative: {
    biggestStress: string;
    gutAction: string;
    biggestPersonalWin: string;
    biggestBusinessWin: string;
    attackItems: { item1: string; item2: string; item3: string };
  };
}

interface SubmissionSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: FormData;
  startDate?: Date;
  endDate?: Date;
  onViewDashboard: () => void;
  onUploadDocuments: () => void;
  onSubmitAnother: () => void;
}

export function SubmissionSuccessDialog({
  open,
  onOpenChange,
  formData,
  startDate,
  endDate,
  onViewDashboard,
  onUploadDocuments,
  onSubmitAnother,
}: SubmissionSuccessDialogProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const periodLabel = startDate && endDate
    ? `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`
    : 'your period';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Form Submitted Successfully!
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Your 1:1 Coaching Call form for <strong>{periodLabel}</strong> has been saved.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Summary Stats */}
        <div className="my-4 rounded-lg bg-muted/50 p-4">
          <h4 className="mb-3 text-sm font-medium text-muted-foreground">Submission Summary</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {formData.sales.premium > 0 && (
              <div>
                <p className="text-muted-foreground">Premium</p>
                <p className="font-semibold">{formatCurrency(formData.sales.premium)}</p>
              </div>
            )}
            {formData.sales.policies > 0 && (
              <div>
                <p className="text-muted-foreground">Policies</p>
                <p className="font-semibold">{formData.sales.policies}</p>
              </div>
            )}
            {formData.sales.items > 0 && (
              <div>
                <p className="text-muted-foreground">Items</p>
                <p className="font-semibold">{formData.sales.items}</p>
              </div>
            )}
            {formData.marketing.totalSpend > 0 && (
              <div>
                <p className="text-muted-foreground">Marketing Spend</p>
                <p className="font-semibold">{formatCurrency(formData.marketing.totalSpend)}</p>
              </div>
            )}
            {formData.cashFlow.netProfit !== 0 && (
              <div>
                <p className="text-muted-foreground">Net Profit</p>
                <p className={`font-semibold ${formData.cashFlow.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(formData.cashFlow.netProfit)}
                </p>
              </div>
            )}
            {formData.retention.currentRetentionPercent > 0 && (
              <div>
                <p className="text-muted-foreground">Retention</p>
                <p className="font-semibold">{formData.retention.currentRetentionPercent}%</p>
              </div>
            )}
          </div>
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={onViewDashboard}
            className="w-full"
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            View Dashboard
          </Button>
          <Button
            variant="outline"
            onClick={onUploadDocuments}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Documents
          </Button>
          <Button
            variant="ghost"
            onClick={onSubmitAnother}
            className="w-full text-muted-foreground"
          >
            <Plus className="mr-2 h-4 w-4" />
            Submit Another Period
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
