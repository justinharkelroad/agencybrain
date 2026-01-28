import { useState, useMemo, useEffect } from "react";
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
  // Total metrics (for tier qualification)
  writtenItems: number | null;
  writtenPremium: number | null;
  writtenPolicies: number | null;
  writtenHouseholds: number | null;
  writtenPoints: number | null;
  // Bundle breakdown (for commission calculation)
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
}

export function ManualOverridePanel({
  subProducerData,
  teamMembers,
  overrides,
  onChange,
}: ManualOverridePanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [bulkItems, setBulkItems] = useState<string>("");
  const [bulkPremium, setBulkPremium] = useState<string>("");
  const [bulkBundledItems, setBulkBundledItems] = useState<string>("");
  const [bulkBundledPremium, setBulkBundledPremium] = useState<string>("");
  const [bulkMonolineItems, setBulkMonolineItems] = useState<string>("");
  const [bulkMonolinePremium, setBulkMonolinePremium] = useState<string>("");
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  // Build a map of sub-producer codes to team members
  const memberByCode = useMemo(() => {
    const map = new Map<string, TeamMember>();
    teamMembers.forEach((tm) => {
      if (tm.sub_producer_code) {
        map.set(tm.sub_producer_code.trim(), tm);
      }
    });
    return map;
  }, [teamMembers]);

  // Create initial overrides from sub-producer data when it changes
  useEffect(() => {
    if (!subProducerData || subProducerData.length === 0) {
      onChange([]);
      return;
    }

    // Only initialize if overrides are empty or sub-producer data changed
    if (overrides.length === 0 || overrides.length !== subProducerData.length) {
      const initialOverrides: ManualOverride[] = subProducerData.map((sp) => {
        const code = sp.code.trim();
        const teamMember = memberByCode.get(code);

        // Check if we have existing override for this code
        const existing = overrides.find((o) => o.subProdCode === code);
        if (existing) {
          return existing;
        }

        return {
          subProdCode: code,
          teamMemberId: teamMember?.id || null,
          teamMemberName: teamMember?.name || null,
          writtenItems: null, // null means use statement data
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
      onChange(initialOverrides);
    }
  }, [subProducerData, memberByCode]);

  // Matched sub-producers with their statement data
  const producerData = useMemo(() => {
    if (!subProducerData) return [];

    return subProducerData.map((sp) => {
      const code = sp.code.trim();
      const teamMember = memberByCode.get(code);
      const override = overrides.find((o) => o.subProdCode === code);

      return {
        code,
        teamMember,
        statementData: sp,
        override,
      };
    });
  }, [subProducerData, memberByCode, overrides]);

  // Get matched producer codes for selection logic
  const matchedCodes = useMemo(() => {
    return producerData.filter((p) => p.teamMember).map((p) => p.code);
  }, [producerData]);

  const matchedCount = matchedCodes.length;
  const unmatchedCount = producerData.filter((p) => !p.teamMember).length;
  const hasOverrides = overrides.some(
    (o) =>
      o.writtenItems !== null ||
      o.writtenPremium !== null ||
      o.writtenPolicies !== null ||
      o.bundledItems !== null ||
      o.bundledPremium !== null ||
      o.monolineItems !== null ||
      o.monolinePremium !== null
  );

  // Selection helpers
  const toggleSelection = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const isAllSelected = matchedCodes.length > 0 && matchedCodes.every((code) => selectedCodes.has(code));
  const isSomeSelected = matchedCodes.some((code) => selectedCodes.has(code));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCodes(new Set()); // Deselect all
    } else {
      setSelectedCodes(new Set(matchedCodes)); // Select all matched
    }
  };

  const handleOverrideChange = (
    subProdCode: string,
    field: keyof ManualOverride,
    value: string
  ) => {
    const numValue = value === "" ? null : parseFloat(value);
    const updated = overrides.map((o) => {
      if (o.subProdCode === subProdCode) {
        return { ...o, [field]: numValue };
      }
      return o;
    });
    onChange(updated);
  };

  const handleApplyBulk = () => {
    if (selectedCodes.size === 0) {
      toast({
        title: "No rows selected",
        description: "Select one or more team members to apply the override values.",
        variant: "destructive",
      });
      return;
    }

    const itemsValue = bulkItems === "" ? null : parseInt(bulkItems, 10);
    const premiumValue = bulkPremium === "" ? null : parseFloat(bulkPremium);
    const bundledItemsValue = bulkBundledItems === "" ? null : parseInt(bulkBundledItems, 10);
    const bundledPremiumValue = bulkBundledPremium === "" ? null : parseFloat(bulkBundledPremium);
    const monolineItemsValue = bulkMonolineItems === "" ? null : parseInt(bulkMonolineItems, 10);
    const monolinePremiumValue = bulkMonolinePremium === "" ? null : parseFloat(bulkMonolinePremium);

    const updated = overrides.map((o) => {
      if (selectedCodes.has(o.subProdCode)) {
        return {
          ...o,
          writtenItems: itemsValue,
          writtenPremium: premiumValue,
          bundledItems: bundledItemsValue,
          bundledPremium: bundledPremiumValue,
          monolineItems: monolineItemsValue,
          monolinePremium: monolinePremiumValue,
        };
      }
      return o;
    });
    onChange(updated);
    setSelectedCodes(new Set()); // Clear selection after apply
  };

  const handleClearAll = () => {
    const updated = overrides.map((o) => ({
      ...o,
      writtenItems: null,
      writtenPremium: null,
      writtenPolicies: null,
      writtenHouseholds: null,
      writtenPoints: null,
      bundledItems: null,
      bundledPremium: null,
      monolineItems: null,
      monolinePremium: null,
    }));
    onChange(updated);
    setBulkItems("");
    setBulkPremium("");
    setBulkBundledItems("");
    setBulkBundledPremium("");
    setBulkMonolineItems("");
    setBulkMonolinePremium("");
    setSelectedCodes(new Set());
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (!subProducerData || subProducerData.length === 0) {
    return null;
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Edit3 className="h-5 w-5" />
                <div>
                  <CardTitle className="text-base">
                    Manual Override (Test Mode)
                  </CardTitle>
                  <CardDescription>
                    Override written items/premium for tier testing
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasOverrides && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    Overrides Active
                  </Badge>
                )}
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  {matchedCount} matched
                </Badge>
                {unmatchedCount > 0 && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {unmatchedCount} unmatched
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Bulk Apply Section */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-4">
              <Label className="text-sm font-medium">Quick Apply to Selected</Label>
              
              {/* Total metrics for tier qualification */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total (for tier qualification)
                </Label>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Items Written
                    </Label>
                    <Input
                      type="number"
                      placeholder="e.g. 60"
                      value={bulkItems}
                      onChange={(e) => setBulkItems(e.target.value)}
                      className="w-28"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Premium Written
                    </Label>
                    <Input
                      type="number"
                      placeholder="e.g. 45000"
                      value={bulkPremium}
                      onChange={(e) => setBulkPremium(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
              </div>

              {/* Bundle breakdown for commission calculation */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Bundle Breakdown (for commission calculation)
                </Label>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Bundled Items
                    </Label>
                    <Input
                      type="number"
                      placeholder="e.g. 54"
                      value={bulkBundledItems}
                      onChange={(e) => setBulkBundledItems(e.target.value)}
                      className="w-28"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Bundled Premium
                    </Label>
                    <Input
                      type="number"
                      placeholder="e.g. 40000"
                      value={bulkBundledPremium}
                      onChange={(e) => setBulkBundledPremium(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Monoline Items
                    </Label>
                    <Input
                      type="number"
                      placeholder="e.g. 6"
                      value={bulkMonolineItems}
                      onChange={(e) => setBulkMonolineItems(e.target.value)}
                      className="w-28"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Monoline Premium
                    </Label>
                    <Input
                      type="number"
                      placeholder="e.g. 5000"
                      value={bulkMonolinePremium}
                      onChange={(e) => setBulkMonolinePremium(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 items-center pt-2">
                <Button 
                  size="sm" 
                  onClick={handleApplyBulk}
                  disabled={selectedCodes.size === 0}
                >
                  Apply to Selected{selectedCodes.size > 0 && ` (${selectedCodes.size})`}
                </Button>
                <Button size="sm" variant="outline" onClick={handleClearAll}>
                  Clear All
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                <strong>Total</strong> values determine which tier you qualify for. <strong>Bundle breakdown</strong> values are used to calculate commission at different rates for bundled vs monoline business. Leave bundle breakdown blank to use original statement ratios.
              </p>
            </div>

            {/* Per-Producer Overrides Table */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all matched producers"
                        className={isSomeSelected && !isAllSelected ? "opacity-50" : ""}
                      />
                    </TableHead>
                    <TableHead className="w-[150px]">Team Member</TableHead>
                    <TableHead className="w-[80px]">Code</TableHead>
                    <TableHead className="text-right w-[80px]">
                      Stmt Items
                    </TableHead>
                    <TableHead className="text-right w-[100px]">
                      Stmt Premium
                    </TableHead>
                    <TableHead className="w-[100px]">
                      Override Items
                    </TableHead>
                    <TableHead className="w-[110px]">
                      Override Premium
                    </TableHead>
                    <TableHead className="w-[90px] bg-blue-50/50">
                      Bundled Items
                    </TableHead>
                    <TableHead className="w-[100px] bg-blue-50/50">
                      Bundled Prem
                    </TableHead>
                    <TableHead className="w-[90px] bg-amber-50/50">
                      Mono Items
                    </TableHead>
                    <TableHead className="w-[100px] bg-amber-50/50">
                      Mono Prem
                    </TableHead>
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
                      <TableCell>
                        {producer.teamMember ? (
                          <span className="font-medium text-sm">
                            {producer.teamMember.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic text-sm">
                            Unmatched
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {producer.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {producer.statementData.itemsIssued}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatCurrency(producer.statementData.premiumWritten)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="—"
                          value={producer.override?.writtenItems ?? ""}
                          onChange={(e) =>
                            handleOverrideChange(
                              producer.code,
                              "writtenItems",
                              e.target.value
                            )
                          }
                          className="h-7 text-xs w-20"
                          disabled={!producer.teamMember}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="—"
                          value={producer.override?.writtenPremium ?? ""}
                          onChange={(e) =>
                            handleOverrideChange(
                              producer.code,
                              "writtenPremium",
                              e.target.value
                            )
                          }
                          className="h-7 text-xs w-24"
                          disabled={!producer.teamMember}
                        />
                      </TableCell>
                      <TableCell className="bg-blue-50/30">
                        <Input
                          type="number"
                          placeholder="—"
                          value={producer.override?.bundledItems ?? ""}
                          onChange={(e) =>
                            handleOverrideChange(
                              producer.code,
                              "bundledItems",
                              e.target.value
                            )
                          }
                          className="h-7 text-xs w-16"
                          disabled={!producer.teamMember}
                        />
                      </TableCell>
                      <TableCell className="bg-blue-50/30">
                        <Input
                          type="number"
                          placeholder="—"
                          value={producer.override?.bundledPremium ?? ""}
                          onChange={(e) =>
                            handleOverrideChange(
                              producer.code,
                              "bundledPremium",
                              e.target.value
                            )
                          }
                          className="h-7 text-xs w-20"
                          disabled={!producer.teamMember}
                        />
                      </TableCell>
                      <TableCell className="bg-amber-50/30">
                        <Input
                          type="number"
                          placeholder="—"
                          value={producer.override?.monolineItems ?? ""}
                          onChange={(e) =>
                            handleOverrideChange(
                              producer.code,
                              "monolineItems",
                              e.target.value
                            )
                          }
                          className="h-7 text-xs w-16"
                          disabled={!producer.teamMember}
                        />
                      </TableCell>
                      <TableCell className="bg-amber-50/30">
                        <Input
                          type="number"
                          placeholder="—"
                          value={producer.override?.monolinePremium ?? ""}
                          onChange={(e) =>
                            handleOverrideChange(
                              producer.code,
                              "monolinePremium",
                              e.target.value
                            )
                          }
                          className="h-7 text-xs w-20"
                          disabled={!producer.teamMember}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> <strong>Override Items/Premium</strong> affect tier qualification. 
              <strong>Bundle breakdown</strong> (Bundled/Monoline) values determine commission rates 
              when your plan has different rates per bundle type. If bundle fields are specified, 
              they replace the statement's byBundleType data for commission calculation.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
