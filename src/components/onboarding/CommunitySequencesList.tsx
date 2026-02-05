import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Search,
  Download,
  Users,
  Loader2,
  Globe,
  AlertCircle,
} from "lucide-react";
import { useCommunitySequences, type CommunitySequence } from "@/hooks/useCommunitySequences";
import type { SequenceTargetType } from "@/hooks/useOnboardingSequences";

interface CommunitySequencesListProps {
  onClone: (sequenceId: string) => Promise<void>;
  cloning: string | null;
}

const targetTypeLabels: Record<string, string> = {
  onboarding: "Onboarding",
  lead_nurturing: "Lead Nurturing",
  requote: "Re-quote",
  retention: "Retention",
  other: "Other",
};

const targetTypeColors: Record<string, string> = {
  onboarding: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  lead_nurturing: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  requote: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  retention: "bg-green-500/10 text-green-700 border-green-500/20",
  other: "bg-gray-500/10 text-gray-700 border-gray-500/20",
};

function getTypeLabel(sequence: CommunitySequence): string {
  if (sequence.target_type === "other" && sequence.custom_type_label) {
    return sequence.custom_type_label;
  }
  return targetTypeLabels[sequence.target_type] || sequence.target_type;
}

function getTypeColorClasses(targetType: string): string {
  return targetTypeColors[targetType] || targetTypeColors.other;
}

export function CommunitySequencesList({
  onClone,
  cloning,
}: CommunitySequencesListProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [targetTypeFilter, setTargetTypeFilter] = React.useState<string>("all");

  const { data: sequences = [], isLoading, error } = useCommunitySequences({
    targetType: targetTypeFilter !== "all" ? (targetTypeFilter as SequenceTargetType) : undefined,
    searchQuery: searchQuery || undefined,
  });

  const handleClone = async (sequenceId: string) => {
    await onClone(sequenceId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive/50 mb-4" />
          <h3 className="font-medium text-lg mb-2">Failed to load community templates</h3>
          <p className="text-muted-foreground">
            There was an error loading the community library. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search community templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="onboarding">Onboarding</SelectItem>
            <SelectItem value="lead_nurturing">Lead Nurturing</SelectItem>
            <SelectItem value="requote">Re-quote</SelectItem>
            <SelectItem value="retention">Retention</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Community Library */}
      {sequences.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Globe className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-lg mb-2">No community templates yet</h3>
            <p className="text-muted-foreground">
              {searchQuery || targetTypeFilter !== "all"
                ? "Try adjusting your filters."
                : "Be the first to share a template with the community!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sequences.map((sequence) => {
            const isCloning = cloning === sequence.id;

            return (
              <Card
                key={sequence.id}
                className="transition-all hover:shadow-md"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium truncate">{sequence.name}</h3>
                          <Badge
                            variant="outline"
                            className={cn("text-xs shrink-0", getTypeColorClasses(sequence.target_type))}
                          >
                            {getTypeLabel(sequence)}
                          </Badge>
                        </div>
                        {sequence.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {sequence.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Stats and Actions */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{sequence.step_count} step{sequence.step_count !== 1 ? "s" : ""}</span>
                        {sequence.agency_name && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {sequence.agency_name}
                          </span>
                        )}
                        {sequence.clone_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {sequence.clone_count} clone{sequence.clone_count !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleClone(sequence.id)}
                        disabled={isCloning}
                      >
                        {isCloning ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Cloning...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Clone
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
