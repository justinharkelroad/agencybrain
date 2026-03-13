import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Target, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useFocusItems } from "@/hooks/useFocusItems";
import { usePlaybookStats } from "@/hooks/usePlaybookStats";
import { getWeekKey } from "@/lib/date-utils";
import { PlaybookItemCard } from "./PlaybookItemCard";
import type { PlaybookDomain } from "@/hooks/useFocusItems";

export function TodaysPowerPlays() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const weekKey = getWeekKey(new Date());
  const { items, isLoading, completeItem, uncompleteItem } = useFocusItems(weekKey);
  const { weeklyPoints } = usePlaybookStats();

  const todayItems = useMemo(
    () => items.filter((i) => i.zone === "power_play" && i.scheduled_date === todayStr),
    [items, todayStr]
  );

  const completedCount = todayItems.filter((i) => i.completed).length;

  const handleToggle = (id: string) => {
    const item = todayItems.find((i) => i.id === id);
    if (!item) return;
    if (item.completed) {
      uncompleteItem.mutate(id);
    } else {
      completeItem.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg font-semibold">Today&apos;s Power Plays</CardTitle>
          </div>
          <Link to="/weekly-playbook">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              View Week
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
          <span>
            Today: <span className="text-foreground font-medium">{completedCount}/{todayItems.length}</span>
          </span>
          <span className="text-border">|</span>
          <span>
            Week: <span className="text-foreground font-medium">{weeklyPoints}/20</span>
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-2">
        {todayItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
            <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No Power Plays scheduled for today</p>
            <Link to="/weekly-playbook">
              <Button variant="link" size="sm" className="mt-1">
                Plan your week
              </Button>
            </Link>
          </div>
        ) : (
          todayItems.map((item) => (
            <PlaybookItemCard
              key={item.id}
              id={item.id}
              title={item.title}
              description={item.description}
              domain={item.domain as PlaybookDomain | null}
              sourceType={item.source_type}
              sourceName={item.source_name}
              completed={item.completed}
              onToggleComplete={handleToggle}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
