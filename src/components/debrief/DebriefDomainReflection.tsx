import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, CheckCircle2, Heart, Brain, Scale, Briefcase, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DebriefDomainTabs } from "./DebriefDomainTabs";
import type { WeekSummaryData } from "@/hooks/useWeekSummary";
import type { DomainReflection } from "@/hooks/useWeeklyDebrief";

const DOMAIN_CONFIG = {
  body: {
    icon: Heart,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  being: {
    icon: Brain,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  balance: {
    icon: Scale,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  business: {
    icon: Briefcase,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
} as const;

const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface DebriefDomainReflectionProps {
  weekSummary: WeekSummaryData;
  domainReflections: Record<string, DomainReflection>;
  onSaveDomainReflection: (domain: string, reflection: DomainReflection) => void;
  onAddToBench: (title: string, domain: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DebriefDomainReflection({
  weekSummary,
  domainReflections,
  onSaveDomainReflection,
  onAddToBench,
  onNext,
  onBack,
}: DebriefDomainReflectionProps) {
  const domains = ["body", "being", "balance", "business"] as const;
  const [activeDomain, setActiveDomain] = useState<string>(domains[0]);
  const [localReflections, setLocalReflections] = useState<Record<string, DomainReflection>>(() => {
    const base: Record<string, DomainReflection> = {};
    for (const d of domains) {
      base[d] = { wins: "", carry_forward: "", course_correction: false, course_correction_note: "", rating: 0 };
    }
    return { ...base, ...domainReflections };
  });

  // New task input per domain
  const [newTaskText, setNewTaskText] = useState("");
  // Track tasks added during this session (for display)
  const [addedTasks, setAddedTasks] = useState<Record<string, string[]>>({
    body: [], being: [], balance: [], business: [],
  });

  // Sync from parent when domainReflections changes
  useEffect(() => {
    setLocalReflections((prev) => ({
      ...prev,
      ...domainReflections,
    }));
  }, [domainReflections]);

  const currentReflection = localReflections[activeDomain] || {
    wins: "", carry_forward: "", course_correction: false, course_correction_note: "", rating: 0,
  };
  const domainConfig = DOMAIN_CONFIG[activeDomain as keyof typeof DOMAIN_CONFIG];
  const DomainIcon = domainConfig.icon;

  const updateField = (field: keyof DomainReflection, value: string | number | boolean) => {
    const updated = { ...currentReflection, [field]: value };
    setLocalReflections((prev) => ({ ...prev, [activeDomain]: updated }));
  };

  const completedDomains = domains.filter((d) => {
    const r = localReflections[d];
    return r && r.rating > 0;
  });

  const domainAccomplishments = weekSummary.domains[activeDomain as keyof typeof weekSummary.domains];

  const saveCurrentDomain = () => {
    onSaveDomainReflection(activeDomain, currentReflection);
  };

  const handleDomainChange = (domain: string) => {
    saveCurrentDomain();
    setActiveDomain(domain);
    setNewTaskText("");
  };

  const handleNext = () => {
    saveCurrentDomain();
    onNext();
  };

  const handleBack = () => {
    saveCurrentDomain();
    onBack();
  };

  const handleAddTask = () => {
    const text = newTaskText.trim();
    if (!text) return;
    onAddToBench(text, activeDomain);
    setAddedTasks((prev) => ({
      ...prev,
      [activeDomain]: [...(prev[activeDomain] || []), text],
    }));
    setNewTaskText("");
    toast.success("Added to bench");
  };

  const allDomainsRated = domains.every((d) => {
    const r = localReflections[d];
    return r && r.rating > 0;
  });

  const currentAddedTasks = addedTasks[activeDomain] || [];

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
        {/* Wins */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/70">
            What wins did you have in <span className="capitalize">{activeDomain}</span> this week?
          </label>
          <Textarea
            value={currentReflection.wins}
            onChange={(e) => updateField("wins", e.target.value)}
            placeholder="What went well..."
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px] resize-none"
          />
        </div>

        {/* Course correction */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-white/70">
            Any course corrections you want to make?
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => updateField("course_correction", true)}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border",
                currentReflection.course_correction
                  ? "bg-white text-[#020817] border-white"
                  : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
              )}
            >
              Yes
            </button>
            <button
              onClick={() => {
                const updated = { ...currentReflection, course_correction: false, course_correction_note: "" };
                setLocalReflections((prev) => ({ ...prev, [activeDomain]: updated }));
              }}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border",
                !currentReflection.course_correction
                  ? "bg-white text-[#020817] border-white"
                  : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
              )}
            >
              No
            </button>
          </div>
          {currentReflection.course_correction && (
            <Textarea
              value={currentReflection.course_correction_note}
              onChange={(e) => updateField("course_correction_note", e.target.value)}
              placeholder="What would you change or do differently..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px] resize-none animate-in fade-in slide-in-from-top-2 duration-300"
            />
          )}
        </div>

        {/* Add tasks for next week */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-white/70">
            What do you want to accomplish in <span className="capitalize">{activeDomain}</span> next week?
          </label>
          <div className="flex gap-2">
            <Input
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder={`Add a ${activeDomain} task for next week...`}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTask();
                }
              }}
            />
            <Button
              onClick={handleAddTask}
              disabled={!newTaskText.trim()}
              size="icon"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/10 shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {currentAddedTasks.length > 0 && (
            <div className="space-y-1.5">
              {currentAddedTasks.map((task, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-white/60 bg-white/5 rounded-lg px-3 py-2">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                  <span className="flex-1">{task}</span>
                  <span className="text-white/30 text-[10px]">on bench</span>
                </div>
              ))}
            </div>
          )}
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
          {allDomainsRated ? "Continue" : "Rate all domains to continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
