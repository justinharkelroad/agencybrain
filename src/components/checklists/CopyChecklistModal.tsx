import { useEffect, useRef, useState } from "react";
import { useQuery, type UseMutationResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  sourceMemberId: string;
  items: { label: string; sort_order: number }[];
  copyToMembers: UseMutationResult<
    { copied: number; skipped: number },
    any,
    { targetMemberIds: string[]; items: { label: string; sort_order: number }[] }
  >;
  itemLabel?: string;
}

export default function CopyChecklistModal({
  open,
  onOpenChange,
  agencyId,
  sourceMemberId,
  items,
  copyToMembers,
  itemLabel = "training item",
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ copied: number; skipped: number } | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const membersQuery = useQuery({
    queryKey: ["team-members-for-copy", agencyId, sourceMemberId],
    enabled: !!agencyId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, role, status")
        .eq("agency_id", agencyId)
        .eq("status", "active")
        .neq("id", sourceMemberId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const members = membersQuery.data || [];

  // Reset state when modal opens; clear any pending auto-close timer
  useEffect(() => {
    if (open) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setSelected(new Set());
      setResult(null);
    }
  }, [open]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const allSelected = members.length > 0 && selected.size === members.length;
  const someSelected = selected.size > 0 && selected.size < members.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(members.map((m) => m.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = () => {
    copyToMembers.mutate(
      { targetMemberIds: Array.from(selected), items },
      {
        onSuccess: (data) => {
          setResult(data);
          closeTimerRef.current = setTimeout(() => onOpenChange(false), 1500);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Checklist to Others</DialogTitle>
          <DialogDescription>
            Copy {items.length} {itemLabel}{items.length !== 1 ? "s" : ""} to selected team members. Duplicates will be skipped.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="text-sm font-medium">
              {result.copied} item{result.copied !== 1 ? "s" : ""} copied
              {result.skipped > 0 && `, ${result.skipped} duplicate${result.skipped !== 1 ? "s" : ""} skipped`}
            </p>
          </div>
        ) : (
          <>
            {membersQuery.isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No other active team members</p>
            ) : (
              <>
                <div className="flex items-center gap-2 pb-1 border-b">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    id="select-all"
                  />
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer select-none">
                    Select All ({members.length})
                  </label>
                </div>
                <ScrollArea className="max-h-64">
                  <div className="space-y-1 pr-3">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 py-1.5">
                        <Checkbox
                          checked={selected.has(m.id)}
                          onCheckedChange={() => toggleOne(m.id)}
                          id={`member-${m.id}`}
                        />
                        <label htmlFor={`member-${m.id}`} className="text-sm cursor-pointer select-none flex-1">
                          {m.name}
                        </label>
                        <span className="text-xs text-muted-foreground">{m.role}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCopy}
                disabled={selected.size === 0 || copyToMembers.isPending}
              >
                {copyToMembers.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Copying...
                  </>
                ) : (
                  `Copy to ${selected.size} Member${selected.size !== 1 ? "s" : ""}`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
