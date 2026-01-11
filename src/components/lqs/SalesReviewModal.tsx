import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Check, X, User, MapPin, Package, DollarSign, Calendar, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PendingSaleReview, MatchCandidate } from '@/types/lqs';

interface SalesReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingReviews: PendingSaleReview[];
  onReviewComplete: (results: ReviewResult[]) => void;
}

export interface ReviewResult {
  sale: PendingSaleReview['sale'];
  action: 'match' | 'skip' | 'create_new';
  matchedHouseholdId?: string;
}

export function SalesReviewModal({ open, onOpenChange, pendingReviews, onReviewComplete }: SalesReviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Map<number, ReviewResult>>(new Map());

  const current = pendingReviews[currentIndex];
  const totalReviews = pendingReviews.length;
  const reviewedCount = decisions.size;

  const handleSelectCandidate = (candidate: MatchCandidate) => {
    const result: ReviewResult = {
      sale: current.sale,
      action: 'match',
      matchedHouseholdId: candidate.householdId,
    };
    setDecisions(prev => new Map(prev).set(currentIndex, result));
    
    // Auto-advance to next if available
    if (currentIndex < totalReviews - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = () => {
    const result: ReviewResult = {
      sale: current.sale,
      action: 'skip',
    };
    setDecisions(prev => new Map(prev).set(currentIndex, result));
    
    if (currentIndex < totalReviews - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleCreateNew = () => {
    const result: ReviewResult = {
      sale: current.sale,
      action: 'create_new',
    };
    setDecisions(prev => new Map(prev).set(currentIndex, result));
    
    if (currentIndex < totalReviews - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleComplete = () => {
    const results = Array.from(decisions.values());
    onReviewComplete(results);
    onOpenChange(false);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  };

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Review Ambiguous Matches</span>
            <Badge variant="outline" className="ml-2">
              {currentIndex + 1} of {totalReviews}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            These sales couldn't be auto-matched. Select the correct household or create a new one.
          </DialogDescription>
        </DialogHeader>

        {/* Sale being matched */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Package className="h-4 w-4 text-primary" />
            Sale to Match
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{current.sale.firstName} {current.sale.lastName}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{current.sale.zipCode}</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{current.sale.productType}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{formatCurrency(current.sale.premiumCents)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{current.sale.saleDate}</span>
            </div>
          </div>
        </div>

        {/* Candidate list */}
        <ScrollArea className="flex-1 min-h-0 max-h-[300px]">
          <div className="space-y-2 pr-4">
            {current.candidates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No matching households found</p>
                <p className="text-xs">You can create a new household for this sale</p>
              </div>
            ) : (
              current.candidates.map((candidate) => {
                const currentDecision = decisions.get(currentIndex);
                const isSelected = currentDecision?.matchedHouseholdId === candidate.householdId;
                
                return (
                  <button
                    key={candidate.householdId}
                    onClick={() => handleSelectCandidate(candidate)}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-colors hover:bg-accent",
                      isSelected && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium flex items-center gap-2">
                          {candidate.householdName}
                          <Badge 
                            variant={candidate.score >= 75 ? "default" : candidate.score >= 50 ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {candidate.score} pts
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          <span>{candidate.zipCode || 'No ZIP'}</span>
                          {candidate.leadSourceName && (
                            <span>Source: {candidate.leadSourceName}</span>
                          )}
                        </div>
                        {candidate.quote && (
                          <div className="text-xs text-muted-foreground">
                            Quote: {candidate.quote.productType} • {formatCurrency(candidate.quote.premium * 100)} • {candidate.quote.quoteDate}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check className="h-5 w-5 text-primary flex-shrink-0" />}
                    </div>
                    
                    {/* Match factors */}
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {candidate.matchFactors.productMatch && (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30">
                          +40 Product
                        </Badge>
                      )}
                      {candidate.matchFactors.subProducerMatch && (
                        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/30">
                          +35 Producer
                        </Badge>
                      )}
                      {candidate.matchFactors.premiumWithin10Percent && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/30">
                          +25 Premium
                        </Badge>
                      )}
                      {candidate.matchFactors.quoteDateBeforeSale && (
                        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-700 border-orange-500/30">
                          +10 Date
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Navigation and actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentIndex(Math.min(totalReviews - 1, currentIndex + 1))}
              disabled={currentIndex === totalReviews - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSkip}>
              <X className="h-4 w-4 mr-1" />
              Skip
            </Button>
            <Button variant="outline" size="sm" onClick={handleCreateNew}>
              Create New Household
            </Button>
            {reviewedCount === totalReviews && (
              <Button onClick={handleComplete}>
                Complete Review ({reviewedCount}/{totalReviews})
              </Button>
            )}
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-1">
          {pendingReviews.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                decisions.has(idx) ? "bg-primary" : idx === currentIndex ? "bg-primary/50" : "bg-muted"
              )}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}