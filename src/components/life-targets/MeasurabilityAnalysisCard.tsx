import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import type { MeasurabilityAnalysis, ItemAnalysis } from "@/hooks/useTargetMeasurability";

interface MeasurabilityAnalysisCardProps {
  analysis: MeasurabilityAnalysis;
  onApplySuggestion?: (domain: string, index: number, rewrittenTarget: string) => void;
}

const DOMAINS = [
  { key: 'body', label: 'Body' },
  { key: 'being', label: 'Being' },
  { key: 'balance', label: 'Balance' },
  { key: 'business', label: 'Business' },
] as const;

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-600 dark:text-green-400';
  if (score >= 5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreBadgeVariant(score: number): "default" | "secondary" | "destructive" {
  if (score >= 8) return 'default';
  if (score >= 5) return 'secondary';
  return 'destructive';
}

function AnalysisItem({ 
  item, 
  domain, 
  index, 
  onApply 
}: { 
  item: ItemAnalysis; 
  domain: string; 
  index: number;
  onApply?: (domain: string, index: number, rewrittenTarget: string) => void;
}) {
  return (
    <div 
      className="space-y-3 p-4 rounded-lg border bg-card animate-scale-in hover:border-primary/30 transition-all"
      role="article"
      aria-label={`Analysis for ${domain} target`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium mb-2">Current Target:</p>
          <p className="text-sm text-muted-foreground">{item.original}</p>
        </div>
        <Badge 
          variant={getScoreBadgeVariant(item.clarity_score)}
          aria-label={`Clarity score: ${item.clarity_score} out of 10`}
        >
          Score: {item.clarity_score}/10
        </Badge>
      </div>

      <div className="flex items-center gap-2 text-muted-foreground" role="presentation">
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-medium">Suggested Rewrite</span>
      </div>

      <div className="space-y-3">
        <div className="p-3 rounded-md bg-muted/50 animate-fade-in">
          <p className="text-sm">{item.rewritten_target}</p>
        </div>

        {onApply && item.clarity_score < 8 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onApply(domain, index, item.rewritten_target)}
            className="w-full hover-scale"
            aria-label={`Apply suggestion for ${domain} target`}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Apply This Suggestion
          </Button>
        )}
      </div>
    </div>
  );
}

export function MeasurabilityAnalysisCard({ 
  analysis, 
  onApplySuggestion 
}: MeasurabilityAnalysisCardProps) {
  const hasAnyAnalysis = DOMAINS.some(
    domain => analysis[domain.key as keyof MeasurabilityAnalysis]?.length > 0
  );

  if (!hasAnyAnalysis) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No analysis results available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Measurability Analysis</CardTitle>
        <CardDescription>
          Review clarity scores and suggestions for your targets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {DOMAINS.map((domain, domainIndex) => {
          const items = analysis[domain.key as keyof MeasurabilityAnalysis];
          if (!items || items.length === 0) return null;

          return (
            <div 
              key={domain.key} 
              className="space-y-3 animate-scale-in"
              style={{ animationDelay: `${domainIndex * 0.1}s` }}
              role="region"
              aria-labelledby={`${domain.key}-analysis-heading`}
            >
              <h3 id={`${domain.key}-analysis-heading`} className="text-lg font-semibold">{domain.label}</h3>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <AnalysisItem
                    key={index}
                    item={item}
                    domain={domain.key}
                    index={index}
                    onApply={onApplySuggestion}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
