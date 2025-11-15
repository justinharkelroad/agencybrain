import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Target, Sparkles, CheckCircle } from "lucide-react";
import type { QuarterlyTargets } from "@/hooks/useQuarterlyTargets";

interface QuarterlyTargetsFormProps {
  initialData?: QuarterlyTargets | null;
  onSave: (targets: QuarterlyTargets) => void;
  onAnalyze?: (targets: QuarterlyTargets) => void;
  onLockIn?: () => void;
  isSaving?: boolean;
  isAnalyzing?: boolean;
  hasUnsavedChanges?: boolean;
  isLockedIn?: boolean;
  hasAnalysis?: boolean;
}

const DOMAINS = [
  { key: 'body', label: 'Body', description: 'Physical health and fitness goals' },
  { key: 'being', label: 'Being', description: 'Mental and spiritual well-being' },
  { key: 'balance', label: 'Balance', description: 'Life balance and relationships' },
  { key: 'business', label: 'Business', description: 'Career and professional goals' },
] as const;

export function QuarterlyTargetsForm({
  initialData,
  onSave,
  onAnalyze,
  onLockIn,
  isSaving,
  isAnalyzing,
  hasUnsavedChanges = false,
  isLockedIn = false,
  hasAnalysis = false,
}: QuarterlyTargetsFormProps) {
  const [formData, setFormData] = useState<QuarterlyTargets>({
    quarter: initialData?.quarter || 'Q1',
    body_target: initialData?.body_target || '',
    body_target2: initialData?.body_target2 || '',
    body_narrative: initialData?.body_narrative || '',
    body_narrative2: initialData?.body_narrative2 || '',
    body_primary_is_target1: initialData?.body_primary_is_target1,
    body_daily_habit: initialData?.body_daily_habit || null,
    body_monthly_missions: initialData?.body_monthly_missions || null,
    being_target: initialData?.being_target || '',
    being_target2: initialData?.being_target2 || '',
    being_narrative: initialData?.being_narrative || '',
    being_narrative2: initialData?.being_narrative2 || '',
    being_primary_is_target1: initialData?.being_primary_is_target1,
    being_daily_habit: initialData?.being_daily_habit || null,
    being_monthly_missions: initialData?.being_monthly_missions || null,
    balance_target: initialData?.balance_target || '',
    balance_target2: initialData?.balance_target2 || '',
    balance_narrative: initialData?.balance_narrative || '',
    balance_narrative2: initialData?.balance_narrative2 || '',
    balance_primary_is_target1: initialData?.balance_primary_is_target1,
    balance_daily_habit: initialData?.balance_daily_habit || null,
    balance_monthly_missions: initialData?.balance_monthly_missions || null,
    business_target: initialData?.business_target || '',
    business_target2: initialData?.business_target2 || '',
    business_narrative: initialData?.business_narrative || '',
    business_narrative2: initialData?.business_narrative2 || '',
    business_primary_is_target1: initialData?.business_primary_is_target1,
    business_daily_habit: initialData?.business_daily_habit || null,
    business_monthly_missions: initialData?.business_monthly_missions || null,
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const hasAnyTarget = DOMAINS.some(
    domain => formData[`${domain.key}_target` as keyof QuarterlyTargets]
  );

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, id: initialData?.id });
  }, [formData, initialData?.id, onSave]);

  const handleAnalyze = useCallback(() => {
    if (onAnalyze && hasAnyTarget) {
      onAnalyze({ ...formData, id: initialData?.id });
    }
  }, [formData, hasAnyTarget, initialData?.id, onAnalyze]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in" aria-label="Quarterly targets form">
      {hasUnsavedChanges && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 animate-fade-in" role="alert">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <p className="text-sm font-medium">
              You have unsaved changes. Click "Save Targets" below to finalize your updates.
            </p>
          </div>
        </div>
      )}
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" aria-hidden="true" />
                Quarterly Life Targets
              </CardTitle>
              <CardDescription>
                Set your goals across the four key life domains
              </CardDescription>
            </div>
            <Select
              value={formData.quarter}
              onValueChange={(value) => setFormData({ ...formData, quarter: value })}
              aria-label="Select quarter"
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Q1">Q1 (Jan-Mar)</SelectItem>
                <SelectItem value="Q2">Q2 (Apr-Jun)</SelectItem>
                <SelectItem value="Q3">Q3 (Jul-Sep)</SelectItem>
                <SelectItem value="Q4">Q4 (Oct-Dec)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {DOMAINS.map((domain, index) => (
            <div 
              key={domain.key} 
              className="space-y-4 pb-6 border-b last:border-b-0 animate-scale-in hover:border-primary/30 transition-colors"
              style={{ animationDelay: `${index * 0.1}s` }}
              role="group"
              aria-labelledby={`${domain.key}-heading`}
            >
              <div>
                <h3 id={`${domain.key}-heading`} className="text-lg font-semibold">{domain.label}</h3>
                <p className="text-sm text-muted-foreground">{domain.description}</p>
              </div>
              
              {/* Target 1 */}
              <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">Target #1</Label>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`${domain.key}_target`}>Target</Label>
                  <Input
                    id={`${domain.key}_target`}
                    value={(formData[`${domain.key}_target` as keyof QuarterlyTargets] as string) || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      [`${domain.key}_target`]: e.target.value
                    })}
                    placeholder={`What do you want to achieve in ${domain.label}?`}
                    className="h-11"
                    aria-describedby={`${domain.key}-target-desc`}
                    maxLength={500}
                  />
                  <span id={`${domain.key}-target-desc`} className="sr-only">
                    Enter your {domain.label.toLowerCase()} target for this quarter
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${domain.key}_narrative`}>
                    Context (Optional)
                  </Label>
                  <Textarea
                    id={`${domain.key}_narrative`}
                    value={(formData[`${domain.key}_narrative` as keyof QuarterlyTargets] as string) || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      [`${domain.key}_narrative`]: e.target.value
                    })}
                    placeholder="Why is this important? What's the context?"
                    className="min-h-[80px] resize-none"
                    aria-describedby={`${domain.key}-narrative-desc`}
                    maxLength={2000}
                  />
                  <span id={`${domain.key}-narrative-desc`} className="sr-only">
                    Provide context for your {domain.label.toLowerCase()} target
                  </span>
                </div>
              </div>

              {/* Target 2 */}
              <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">Target #2 (Optional)</Label>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`${domain.key}_target2`}>Target</Label>
                  <Input
                    id={`${domain.key}_target2`}
                    value={(formData[`${domain.key}_target2` as keyof QuarterlyTargets] as string) || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      [`${domain.key}_target2`]: e.target.value
                    })}
                    placeholder={`Second ${domain.label.toLowerCase()} goal for this quarter (optional)`}
                    className="h-11"
                    maxLength={500}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${domain.key}_narrative2`}>
                    Context (Optional)
                  </Label>
                  <Textarea
                    id={`${domain.key}_narrative2`}
                    value={(formData[`${domain.key}_narrative2` as keyof QuarterlyTargets] as string) || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      [`${domain.key}_narrative2`]: e.target.value
                    })}
                    placeholder="Why is this second target important?"
                    className="min-h-[80px] resize-none"
                    maxLength={2000}
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        {onAnalyze && (
          <Button
            type="button"
            variant="outline"
            onClick={handleAnalyze}
            disabled={!hasAnyTarget || isAnalyzing || isLockedIn}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze Clarity
              </>
            )}
          </Button>
        )}
        
        {onLockIn && hasAnalysis && !isLockedIn && (
          <Button
            type="button"
            variant="secondary"
            onClick={onLockIn}
            className="hover-scale"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Lock In Targets
          </Button>
        )}
        
        <Button 
          type="submit" 
          disabled={!hasAnyTarget || !isLockedIn || isSaving}
          className={`hover-scale ${hasUnsavedChanges ? 'animate-pulse' : ''}`}
          aria-label="Save targets"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : (
            'Save Targets'
          )}
        </Button>
      </div>
    </form>
  );
}
