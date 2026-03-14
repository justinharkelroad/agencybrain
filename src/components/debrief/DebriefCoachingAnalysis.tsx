import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Stamp, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { DebriefScoreRing } from "./DebriefScoreRing";
import type { WeekSummaryData } from "@/hooks/useWeekSummary";

interface DebriefCoachingAnalysisProps {
  weekSummary: WeekSummaryData;
  reviewId: string | null;
  existingAnalysis: string | null;
  onRequestAnalysis: () => Promise<string>;
  onSeal: () => void;
  onBack: () => void;
  sealing: boolean;
}

export function DebriefCoachingAnalysis({
  weekSummary,
  reviewId,
  existingAnalysis,
  onRequestAnalysis,
  onSeal,
  onBack,
  sealing,
}: DebriefCoachingAnalysisProps) {
  const [analysis, setAnalysis] = useState<string | null>(existingAnalysis);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync from prop when it changes (e.g. review refetched after save)
  useEffect(() => {
    if (existingAnalysis && !analysis) {
      setAnalysis(existingAnalysis);
    }
  }, [existingAnalysis]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-request analysis on mount if we don't have one
  useEffect(() => {
    if (!analysis && !existingAnalysis && reviewId && !analyzing && !error) {
      requestAnalysis();
    }
  }, [reviewId]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const result = await onRequestAnalysis();
      setAnalysis(result);
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Coaching analysis unavailable right now. You can still seal your debrief.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-4">
        <Sparkles className="h-6 w-6 text-amber-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Your Coach's Analysis</h2>
        <p className="text-sm text-white/50 mt-1">Personalized insights from your weekly debrief</p>
      </div>

      {/* Score summary */}
      <div className="flex justify-center">
        <DebriefScoreRing total={weekSummary.totalPoints} max={55} size="sm" />
      </div>

      {/* Analysis content */}
      {analyzing ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          </div>
          <div className="text-center">
            <p className="text-sm text-white/70 font-medium">Analyzing your week...</p>
            <p className="text-xs text-white/40 mt-1">Your coach is reviewing your reflections</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 text-center space-y-3">
          <p className="text-sm text-white/60">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={requestAnalysis}
            className="text-white/50 hover:text-white hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      ) : analysis ? (
        <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] rounded-xl p-6 border border-white/10 space-y-1">
          <div className="prose prose-sm prose-invert max-w-none">
            {analysis.split('\n\n').map((paragraph, i) => (
              <p key={i} className="text-sm text-white/80 leading-relaxed mb-4 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex justify-between pt-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-white/60 hover:text-white hover:bg-white/10 rounded-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onSeal}
          disabled={sealing || analyzing}
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 rounded-full"
        >
          <Stamp className="mr-2 h-5 w-5" />
          {sealing ? "Sealing..." : "Seal Your Debrief"}
        </Button>
      </div>
    </div>
  );
}
