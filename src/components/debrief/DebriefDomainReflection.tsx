import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, CheckCircle2, Heart, Brain, Scale, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { DebriefDomainTabs } from "./DebriefDomainTabs";
import type { WeekSummaryData } from "@/hooks/useWeekSummary";
import type { DomainReflection } from "@/hooks/useWeeklyDebrief";

const DOMAIN_CONFIG = {
  body: {
    icon: Heart,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    prompts: [
      "What wins did you have in Body this week?",
      "What's one thing you want to carry forward?",
    ],
  },
  being: {
    icon: Brain,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    prompts: [
      "What wins did you have in Being this week?",
      "What's one thing you want to carry forward?",
    ],
  },
  balance: {
    icon: Scale,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    prompts: [
      "What wins did you have in Balance this week?",
      "What's one thing you want to carry forward?",
    ],
  },
  business: {
    icon: Briefcase,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    prompts: [
      "What wins did you have in Business this week?",
      "What's one thing you want to carry forward?",
    ],
  },
} as const;

const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface DebriefDomainReflectionProps {
  weekSummary: WeekSummaryData;
  domainReflections: Record<string, DomainReflection>;
  onSaveDomainReflection: (domain: string, reflection: DomainReflection) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DebriefDomainReflection({
  weekSummary,
  domainReflections,
  onSaveDomainReflection,
  onNext,
  onBack,
}: DebriefDomainReflectionProps) {
  const domains = ["body", "being", "balance", "business"] as const;
  const [activeDomain, setActiveDomain] = useState<string>(domains[0]);
  const [localReflections, setLocalReflections] = useState<Record<string, DomainReflection>>({
    body: { wins: "", carry_forward: "", rating: 0 },
    being: { wins: "", carry_forward: "", rating: 0 },
    balance: { wins: "", carry_forward: "", rating: 0 },
    business: { wins: "", carry_forward: "", rating: 0 },
    ...domainReflections,
  });

  // Sync from parent when domainReflections changes
  useEffect(() => {
    setLocalReflections((prev) => ({
      ...prev,
      ...domainReflections,
    }));
  }, [domainReflections]);

  const currentReflection = localReflections[activeDomain] || { wins: "", carry_forward: "", rating: 0 };
  const domainConfig = DOMAIN_CONFIG[activeDomain as keyof typeof DOMAIN_CONFIG];
  const DomainIcon = domainConfig.icon;

  const updateField = (field: keyof DomainReflection, value: string | number) => {
    const updated = { ...currentReflection, [field]: value };
    setLocalReflections((prev) => ({ ...prev, [activeDomain]: updated }));
  };

  const completedDomains = domains.filter((d) => {
    const r = localReflections[d];
    return r && r.rating > 0;
  });

  const domainAccomplishments = weekSummary.domains[activeDomain as keyof typeof weekSummary.domains];

  // Save current domain reflection before switching or advancing
  const saveCurrentDomain = () => {
    onSaveDomainReflection(activeDomain, currentReflection);
  };

  const handleDomainChange = (domain: string) => {
    saveCurrentDomain();
    setActiveDomain(domain);
  };

  const handleNext = () => {
    saveCurrentDomain();
    onNext();
  };

  const handleBack = () => {
    saveCurrentDomain();
    onBack();
  };

  const allDomainsRated = domains.every((d) => {
    const r = localReflections[d];
    return r && r.rating > 0;
  });

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-white">Domain Reflections</h2>
        <p className="text-sm text-white/50 mt-1">Reflect on each area of your life</p>
      </div>

      <DebriefDomainTabs
        activeDomain={activeDomain}
        onDomainChange={handleDomainChange}
        completedDomains={completedDomains}
      />

      {/* Domain-specific accomplishments */}
      <div className={cn("rounded-xl p-4 border border-white/10", domainConfig.bgColor)}>
        <div className="flex items-center gap-2 mb-2">
          <DomainIcon className={cn("h-4 w-4", domainConfig.color)} />
          <span className="text-sm font-semibold text-white capitalize">{activeDomain} this week</span>
        </div>
        {domainAccomplishments && (
          <div className="space-y-1.5">
            {domainAccomplishments.core4Days > 0 && (
              <p className="text-xs text-white/60">
                Core 4: checked <span className="text-white font-medium">{domainAccomplishments.core4Days}</span> day{domainAccomplishments.core4Days !== 1 ? "s" : ""}
              </p>
            )}
            {domainAccomplishments.powerPlays.length > 0 && (
              <div className="space-y-1">
                {domainAccomplishments.powerPlays.map((pp) => (
                  <div key={pp.id} className="flex items-center gap-1.5 text-xs">
                    {pp.completed ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    ) : (
                      <div className="h-3 w-3 rounded-full border border-white/30 shrink-0" />
                    )}
                    <span className={pp.completed ? "text-white/70" : "text-white/40"}>{pp.title}</span>
                  </div>
                ))}
              </div>
            )}
            {domainAccomplishments.core4Days === 0 && domainAccomplishments.powerPlays.length === 0 && (
              <p className="text-xs text-white/40 italic">No tracked activity this week</p>
            )}
          </div>
        )}
      </div>

      {/* Reflection prompts */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/70">{domainConfig.prompts[0]}</label>
          <Textarea
            value={currentReflection.wins}
            onChange={(e) => updateField("wins", e.target.value)}
            placeholder="What went well..."
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px] resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white/70">{domainConfig.prompts[1]}</label>
          <Textarea
            value={currentReflection.carry_forward}
            onChange={(e) => updateField("carry_forward", e.target.value)}
            placeholder="What will you carry into next week..."
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px] resize-none"
          />
        </div>

        {/* Rating chips */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/70">
            Rate your <span className="capitalize">{activeDomain}</span> effort this week
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {RATING_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => updateField("rating", n)}
                className={cn(
                  "w-9 h-9 rounded-lg text-sm font-semibold transition-all",
                  currentReflection.rating === n
                    ? "bg-white text-[#020817] scale-110"
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-white/60 hover:text-white hover:bg-white/10 rounded-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!allDomainsRated}
          className="bg-white text-[#020817] hover:bg-white/90 rounded-full px-6 disabled:opacity-40"
        >
          {allDomainsRated ? "Continue" : `Rate all domains to continue`}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
