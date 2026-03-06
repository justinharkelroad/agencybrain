import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useOnboardingTrainingItems, type OnboardingTrainingItem } from "@/hooks/useOnboardingTrainingItems";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUp, ArrowDown, Copy, Plus, Trash2, StickyNote } from "lucide-react";
import CopyChecklistModal from "./CopyChecklistModal";

interface Props {
  memberId: string;
  agencyId: string;
  checklistType?: string;
  title?: string;
  description?: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function OnboardingTrainingChecklist({
  memberId,
  agencyId,
  checklistType = "onboarding",
  title = "Onboarding Training Checklist",
  description = "Track training items for this team member",
}: Props) {
  const qc = useQueryClient();
  const { query, addItem, toggleComplete, removeItem, reorderItems, copyToMembers } =
    useOnboardingTrainingItems(memberId, agencyId, checklistType);

  const [newLabel, setNewLabel] = useState("");
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  // Track which item is being checked off (to show note input)
  const [checkingItemId, setCheckingItemId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`oti-${memberId}-${checklistType}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "onboarding_training_items", filter: `member_id=eq.${memberId}` },
        () => qc.invalidateQueries({ queryKey: ["onboarding-training-items", memberId, checklistType] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [memberId, checklistType, qc]);

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) return;
    addItem.mutate(label);
    setNewLabel("");
  };

  const handleCheck = (item: OnboardingTrainingItem) => {
    if (item.completed) {
      // Un-checking: clear immediately
      toggleComplete.mutate({ id: item.id, completed: false });
    } else {
      // Checking: show note input
      setCheckingItemId(item.id);
      setNoteText("");
    }
  };

  const handleDone = (id: string) => {
    toggleComplete.mutate({ id, completed: true, note: noteText.trim() || undefined });
    setCheckingItemId(null);
    setNoteText("");
  };

  const handleCancel = () => {
    setCheckingItemId(null);
    setNoteText("");
  };

  const items = query.data || [];

  // Clear stale note input if the item was completed or deleted by another user via realtime
  useEffect(() => {
    if (!checkingItemId) return;
    const checkingItem = items.find((it) => it.id === checkingItemId);
    if (!checkingItem || checkingItem.completed) {
      setCheckingItemId(null);
      setNoteText("");
    }
  }, [checkingItemId, items]);

  return (
    <TooltipProvider>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setCopyModalOpen(true)}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy to Others
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add row */}
        <div className="flex items-center gap-2">
          <Input
            placeholder={checklistType === "offboarding" ? "Add an offboarding item..." : "Add a training item..."}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            className="flex-1"
          />
          <Button
            size="sm"
            className="rounded-full"
            onClick={handleAdd}
            disabled={!newLabel.trim() || addItem.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">
            {checklistType === "offboarding" ? "No offboarding items yet" : "No training items yet"}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-20"></TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <React.Fragment key={item.id}>
                  <TableRow>
                    <TableCell>
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => handleCheck(item)}
                        disabled={toggleComplete.isPending}
                        className={item.completed ? "border-green-600 bg-green-600 text-white data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" : ""}
                      />
                    </TableCell>
                    <TableCell className={item.completed ? "line-through text-muted-foreground" : ""}>
                      {item.label}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {item.completed_at ? formatDate(item.completed_at) : ""}
                    </TableCell>
                    <TableCell>
                      {item.note && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span role="button" tabIndex={0} className="inline-flex text-muted-foreground" aria-label="View note">
                              <StickyNote className="h-4 w-4" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p>{item.note}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => reorderItems.mutate({ id: item.id, direction: 'up' })}
                          disabled={idx === 0 || reorderItems.isPending}
                        >
                          <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => reorderItems.mutate({ id: item.id, direction: 'down' })}
                          disabled={idx === items.length - 1 || reorderItems.isPending}
                        >
                          <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeItem.mutate(item.id)}
                        disabled={removeItem.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {checkingItemId === item.id && (
                    <TableRow>
                      <TableCell />
                      <TableCell colSpan={6}>
                        <div className="flex items-center gap-2 py-1">
                          <Input
                            placeholder="Optional note..."
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleDone(item.id); }}
                            className="flex-1"
                            autoFocus
                          />
                          <Button size="sm" className="rounded-full" onClick={() => handleDone(item.id)}>
                            Done
                          </Button>
                          <Button size="sm" variant="ghost" className="rounded-full" onClick={handleCancel}>
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    <CopyChecklistModal
      open={copyModalOpen}
      onOpenChange={setCopyModalOpen}
      agencyId={agencyId}
      sourceMemberId={memberId}
      items={items.map((it) => ({ label: it.label, sort_order: it.sort_order }))}
      copyToMembers={copyToMembers}
      itemLabel={checklistType === "offboarding" ? "offboarding item" : "training item"}
    />
    </TooltipProvider>
  );
}
