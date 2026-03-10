import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Edit3, ChevronDown, ChevronRight, AlertCircle, Users } from "lucide-react";
import { SubProducerMetrics } from "@/lib/allstate-analyzer/sub-producer-analyzer";
import { useToast } from "@/hooks/use-toast";

export interface ManualOverride {
  subProdCode: string;
  teamMemberId: string | null;
  teamMemberName: string | null;
  writtenItems: number | null;
  writtenPremium: number | null;
  writtenPolicies: number | null;
  writtenHouseholds: number | null;
  writtenPoints: number | null;
  bundledItems: number | null;
  bundledPremium: number | null;
  monolineItems: number | null;
  monolinePremium: number | null;
}

interface TeamMember {
  id: string;
  name: string;
  sub_producer_code: string | null;
}

interface ManualOverridePanelProps {
  subProducerData: SubProducerMetrics[] | undefined;
  teamMembers: TeamMember[];
  overrides: ManualOverride[];
  onChange: (overrides: ManualOverride[]) => void;
  enabled: boolean;
}

type BulkField =
  | "writtenItems"
  | "writtenPremium"
  | "writtenPolicies"
  | "writtenHouseholds"
  | "writtenPoints";

export function ManualOverridePanel({
  subProducerData,
  teamMembers,
  overrides,
  onChange,
  enabled,
}: ManualOverridePanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(enabled);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [bulkValues, setBulkValues] = useState<Record<BulkField, string>>({
    writtenItems: "",
    writtenPremium: "",
    writtenPolicies: "",
    writtenHouseholds: "",
    writtenPoints: "",
  });

  useEffect(() => {
    if (enabled) {
      setIsOpen(true);
    }
  }, [enabled]);

  const memberByCode = useMemo(() => {
    const map = new Map<string, TeamMember>();
    teamMembers.forEach((tm) => {
      if (tm.sub_producer_code) {
        map.set(tm.sub_producer_code.trim(), tm);
      }
    });
    return map;
  }, [teamMembers]);

  useEffect(() => {
    if (!subProducerData || subProducerData.length === 0) {
      onChange([]);
      return;
    }

    const nextOverrides: ManualOverride[] = subProducerData.map((sp) => {
      const code = sp.code.trim();
      const teamMember = memberByCode.get(code);
      const existing = overrides.find((o) => o.subProdCode === code);

      return existing || {
        subProdCode: code,
        teamMemberId: teamMember?.id || null,
        teamMemberName: teamMember?.name || null,
        writtenItems: null,
        writtenPremium: null,
        writtenPolicies: null,
        writtenHouseholds: null,
        writtenPoints: null,
        bundledItems: null,
        bundledPremium: null,
        monolineItems: null,
        monolinePremium: null,
      };
    });

    if (
      overrides.length !== nextOverrides.length ||
      nextOverrides.some((next, index) => overrides[index]?.subProdCode !== next.subProdCode)
    ) {
      onChange(nextOverrides);
    }
  }, [memberByCode, onChange, overrides, subProducerData]);

  const producerData = useMemo(() => {
    if (!subProducerData) return [];

    return subProducerData.map((sp) => {
      const code = sp.code.trim();
      return {
        code,
        teamMember: memberByCode.get(code),
        statementData: sp,
        override: overrides.find((o) => o.subProdCode === code),
      };
    });
  }, [memberByCode, overrides, subProducerData]);

  const matchedCodes = useMemo(
    () => producerData.filter((producer) => producer.teamMember).map((producer) => producer.code),
    [producerData]
  );

  const hasOverrides = overrides.some(
    (override) =>
      override.writtenItems !== null ||
      override.writtenPremium !== null ||
      override.writtenPolicies !== null ||
      override.writtenHouseholds !== null ||
      override.writtenPoints !== null
  );

  const handleOverrideChange = (
    subProdCode: string,
    field: BulkField,
    value: string
  ) => {
    const parsedValue = value === "" ? null : Number(value);
    const nextOverrides = overrides.map((override) =>
      override.subProdCode === subProdCode ? { ...override, [field]: parsedValue } : override
    );
    onChange(nextOverrides);
  };

  const toggleSelection = (code: string) => {
    setSelectedCodes((current) => {
      const next = new Set(current);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const isAllSelected =
    matchedCodes.length > 0 && matchedCodes.every((code) => selectedCodes.has(code));

  const handleSelectAll = () => {
    setSelectedCodes(isAllSelected ? new Set() : new Set(matchedCodes));
  };

  const handleApplyBulk = () => {
    if (selectedCodes.size === 0) {
      toast({
        title: "No rows selected",
        description: "Select one or more team members to apply manual written metrics.",
        variant: "destructive",
      });
      return;
    }

    const nextOverrides = overrides.map((override) => {
      if (!selectedCodes.has(override.subProdCode)) return override;

      return {
        ...override,
        writtenItems: bulkValues.writtenItems === "" ? null : Number(bulkValues.writtenItems),
        writtenPremium: bulkValues.writtenPremium === "" ? null : Number(bulkValues.writtenPremium),
        writtenPolicies: bulkValues.writtenPolicies === "" ? null : Number(bulkValues.writtenPolicies),
        writtenHouseholds: bulkValues.writtenHouseholds === "" ? null : Number(bulkValues.writtenHouseholds),
        writtenPoints: bulkValues.writtenPoints === "" ? null : Number(bulkValues.writtenPoints),
      };
    });

    onChange(nextOverrides);
    setSelectedCodes(new Set());
  };

  const handleClearAll = () => {
    onChange(overrides.map((override) => ({
      ...override,
      writtenItems: null,
      writtenPremium: null,
      writtenPolicies: null,
      writtenHouseholds: null,
      writtenPoints: null,
    })));
    setSelectedCodes(new Set());
    setBulkValues({
      writtenItems: "",
      writtenPremium: "",
      writtenPolicies: "",
      writtenHouseholds: "",
      writtenPoints: "",
    });
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);

  if (!subProducerData || subProducerData.length === 0) {
    return null;
  }

  return (
    <Card className={!enabled ? "opacity-70" : undefined}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Edit3 className="h-5 w-5" />
                <div>
                  <CardTitle className="text-base">Manual Written Tier Metrics</CardTitle>
                  <CardDescription>
                    Enter fallback written numbers only when the dashboard was not used for the month.
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasOverrides && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    Values Entered
                  </Badge>
                )}
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  {matchedCodes.length} matched
                </Badge>
                {producerData.length > matchedCodes.length && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {producerData.length - matchedCodes.length} unmatched
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-4">
              <Label className="text-sm font-medium">Quick Apply to Selected</Label>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Items Written</Label>
                  <Input
                    type="number"
                    value={bulkValues.writtenItems}
                    onChange={(e) => setBulkValues((current) => ({ ...current, writtenItems: e.target.value }))}
                    className="w-24"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Premium Written</Label>
                  <Input
                    type="number"
                    value={bulkValues.writtenPremium}
                    onChange={(e) => setBulkValues((current) => ({ ...current, writtenPremium: e.target.value }))}
                    className="w-32"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Policies Written</Label>
                  <Input
                    type="number"
                    value={bulkValues.writtenPolicies}
                    onChange={(e) => setBulkValues((current) => ({ ...current, writtenPolicies: e.target.value }))}
                    className="w-28"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Households</Label>
                  <Input
                    type="number"
                    value={bulkValues.writtenHouseholds}
                    onChange={(e) => setBulkValues((current) => ({ ...current, writtenHouseholds: e.target.value }))}
                    className="w-24"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Points</Label>
                  <Input
                    type="number"
                    value={bulkValues.writtenPoints}
                    onChange={(e) => setBulkValues((current) => ({ ...current, writtenPoints: e.target.value }))}
                    className="w-24"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleApplyBulk} disabled={selectedCodes.size === 0 || !enabled}>
                  Apply to Selected{selectedCodes.size > 0 ? ` (${selectedCodes.size})` : ""}
                </Button>
                <Button size="sm" variant="outline" onClick={handleClearAll}>
                  Clear All
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                These values affect tier qualification only. Issued production and chargebacks still come from the uploaded reports.
              </p>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[44px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={() => handleSelectAll()}
                        aria-label="Select all matched producers"
                      />
                    </TableHead>
                    <TableHead>Team Member</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Uploaded Items</TableHead>
                    <TableHead className="text-right">Uploaded Premium</TableHead>
                    <TableHead>Manual Items</TableHead>
                    <TableHead>Manual Premium</TableHead>
                    <TableHead>Manual Policies</TableHead>
                    <TableHead>Manual Households</TableHead>
                    <TableHead>Manual Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {producerData.map((producer) => (
                    <TableRow
                      key={producer.code}
                      className={!producer.teamMember ? "bg-red-50/50" : selectedCodes.has(producer.code) ? "bg-primary/5" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedCodes.has(producer.code)}
                          onCheckedChange={() => toggleSelection(producer.code)}
                          disabled={!producer.teamMember}
                          aria-label={`Select ${producer.teamMember?.name || producer.code}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {producer.teamMember?.name || <span className="text-muted-foreground italic">Unmatched</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {producer.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {producer.statementData.itemsIssued}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(producer.statementData.premiumWritten)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="—"
                          value={producer.override?.writtenItems ?? ""}
                          onChange={(e) => handleOverrideChange(producer.code, "writtenItems", e.target.value)}
                          className="h-8 w-20"
                          disabled={!producer.teamMember || !enabled}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="—"
                          value={producer.override?.writtenPremium ?? ""}
                          onChange={(e) => handleOverrideChange(producer.code, "writtenPremium", e.target.value)}
                          className="h-8 w-24"
                          disabled={!producer.teamMember || !enabled}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="—"
                          value={producer.override?.writtenPolicies ?? ""}
                          onChange={(e) => handleOverrideChange(producer.code, "writtenPolicies", e.target.value)}
                          className="h-8 w-24"
                          disabled={!producer.teamMember || !enabled}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="—"
                          value={producer.override?.writtenHouseholds ?? ""}
                          onChange={(e) => handleOverrideChange(producer.code, "writtenHouseholds", e.target.value)}
                          className="h-8 w-24"
                          disabled={!producer.teamMember || !enabled}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="—"
                          value={producer.override?.writtenPoints ?? ""}
                          onChange={(e) => handleOverrideChange(producer.code, "writtenPoints", e.target.value)}
                          className="h-8 w-20"
                          disabled={!producer.teamMember || !enabled}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
