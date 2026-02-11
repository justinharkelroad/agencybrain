import { useState, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Target, Save, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { computeRoyTargets, type RoyResult, type RoyParams } from "@/lib/computeRoyTargets";
import { getBonusGridState, getGridValidation, getPointsItemsMix, type GridValidation } from "@/lib/bonusGridState";
import { computeRounded, type CellAddr } from "@/bonus_grid_web_spec/computeWithRounding";
import { supabase } from '@/lib/supabaseClient';

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

interface SnapshotPlannerPageProps {
  embedded?: boolean;
}

export default function SnapshotPlannerPage({ embedded = false }: SnapshotPlannerPageProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Form state
  const [snapshotDate, setSnapshotDate] = useState<Date>(new Date());
  const [ytdItemsInput, setYtdItemsInput] = useState("");
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [royResult, setRoyResult] = useState<RoyResult | null>(null);
  const [isSaving, setSaving] = useState(false);
  
  // Check grid validation with async handling
  const [gridValidation, setGridValidation] = useState<GridValidation>({
    isValid: false,
    isSaved: false,
    hasRequiredValues: false
  });

  // Load grid validation on mount
  useEffect(() => {
    const loadValidation = async () => {
      const validation = await getGridValidation();
      setGridValidation(validation);
    };
    loadValidation();
  }, []);

  const computeTargets = useCallback(async () => {
    const ytdItems = parseInt(ytdItemsInput);
    if (!ytdItems || ytdItems <= 0) {
      toast({
        title: "Invalid input",
        description: "Please enter a valid positive number for YTD items total.",
        variant: "destructive"
      });
      return;
    }
    
    // Get stored bonus grid inputs
    const gridState = await getBonusGridState();
    if (!gridState) {
      toast({
        title: "Grid data missing",
        description: "Could not read bonus grid data. Please complete the Bonus Grid first.",
        variant: "destructive"
      });
      return;
    }
    
    // Compute the output values from the stored inputs
    const monthlyItemsAddrs = [38, 39, 40, 41, 42, 43, 44].map(r => `Sheet1!J${r}` as CellAddr);
    const bonusPercentAddrs = [38, 39, 40, 41, 42, 43, 44].map(r => `Sheet1!H${r}` as CellAddr);
    const allAddrs = [...monthlyItemsAddrs, ...bonusPercentAddrs];
    
    // Convert F column values (Retention %) from percentages to decimals
    const correctedGridState = { ...gridState };
    Object.keys(correctedGridState).forEach(key => {
      // Convert F column retention percentages to decimals (87.01 -> 0.8701)
      if (key.match(/^Sheet1!F\d+$/)) {
        const value = correctedGridState[key as CellAddr];
        if (typeof value === 'number' && value > 1) {
          correctedGridState[key as CellAddr] = value / 100;
        }
      }
    });
    
    // Wrap the corrected grid state in the expected WorkbookState format
    const workbookState = { inputs: correctedGridState };
    const computedValues = computeRounded(workbookState, allAddrs);
    
    const monthlyItems = monthlyItemsAddrs.map(addr => computedValues[addr] || 0);
    const bonusPercentages = bonusPercentAddrs.map(addr => computedValues[addr] || 0);
    const m25 = getPointsItemsMix();
    
    if (monthlyItems.length !== 7 || bonusPercentages.length !== 7) {
      toast({
        title: "Grid computation failed",
        description: "Could not compute required values from Bonus Grid. Please check your grid inputs.",
        variant: "destructive"
      });
      return;
    }
    
    // Use the ytd items as the YTD total (this is what the user input represents)
    const ytdItemsTotal = ytdItems;
    
    const params: RoyParams = {
      ytdItemsTotal,
      reportMonth,
      oldMonthlyItemsByTier: monthlyItems,
      bonusPercentages,
      m25,
      dailyMode: '21-day'
    };
    
    const result = computeRoyTargets(params);
    setRoyResult(result);
    
    toast({
      title: "Targets calculated",
      description: `ROY targets computed for ${reportMonth} months elapsed, ${result.monthsRemaining} months remaining.`,
    });
  }, [ytdItemsInput, reportMonth, toast]);
  
  const handleSaveSnapshot = async () => {
    if (!royResult) {
      toast({
        title: "Cannot save snapshot",
        description: "Please calculate targets first.",
        variant: "destructive"
      });
      return;
    }
    
    const ytdItems = parseInt(ytdItemsInput);
    if (!ytdItems) {
      toast({
        title: "Missing data",
        description: "YTD Items Total is required to save snapshot.",
        variant: "destructive"
      });
      return;
    }
    
    setSaving(true);
    
    try {
      const { data: { user } } = await supa.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to save snapshots.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supa.from('snapshot_planner').insert({
        user_id: user.id,
        snapshot_date: format(snapshotDate, 'yyyy-MM-dd'),
        uploaded_month: reportMonth,
        ytd_items_total: ytdItems,
        current_month_items_total: ytdItems,
        grid_version: JSON.stringify(await getBonusGridState()),
        tiers: royResult.tiers as any,
        raw_pdf_meta: {
          months_elapsed: royResult.monthsElapsed,
          months_remaining: royResult.monthsRemaining,
          pace_items_per_month: royResult.paceItemsPerMonth
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Snapshot saved successfully",
        description: "Your snapshot has been saved. Grid values remain unchanged.",
      });
      
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save failed",
        description: "Could not save snapshot. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  
  const canCompute = gridValidation.isValid && ytdItemsInput && reportMonth;
  const ytdTotal = royResult ? parseInt(ytdItemsInput) : null;
  
  return (
    <main className={embedded ? "space-y-6" : "p-6 max-w-7xl mx-auto space-y-6"}>
      {!embedded ? (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate('/bonus-grid')}>
              <ArrowLeft className="h-4 w-4" />
              Back to Bonus Grid
            </Button>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/bonus-grid">Bonus Grid</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Snapshot Planner</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>
      ) : (
        <h3 className="text-lg font-medium">Snapshot Planner</h3>
      )}

      {!embedded ? (
        <div className="relative rounded-lg border border-border bg-card p-6">
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-transparent to-accent/20 blur-xl -z-10"></div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
                Snapshot Planner
              </h1>
              <p className="text-muted-foreground">Calculate rest-of-year targets based on current month performance</p>
            </div>
            
            <div className="text-right">
              <Target className="h-12 w-12 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">ROY Planning</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Warning if grid not ready */}
      {!gridValidation.isValid && (
        <Card className="p-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Target className="h-5 w-5" />
            <div>
              <p className="font-medium">Bonus Grid Required</p>
              <p className="text-sm">Please complete and save your Bonus Grid first to use the Snapshot Planner.</p>
              <Link to="/bonus-grid" className="text-sm font-medium hover:underline">
                Go to Bonus Grid →
              </Link>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Input Section */}
        <div className="space-y-6">
          {/* Snapshot Date */}
          <Card className="p-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">Snapshot Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !snapshotDate && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {snapshotDate ? format(snapshotDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={snapshotDate}
                    onSelect={(date) => date && setSnapshotDate(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </Card>

          {/* Manual Input */}
          <Card className="p-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">
                YTD Items Total (Cumulative items from start of year through current month)
              </Label>
              <Input
                type="number"
                placeholder="Enter YTD items total"
                value={ytdItemsInput}
                onChange={(e) => setYtdItemsInput(e.target.value)}
                disabled={!gridValidation.isValid}
              />
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Report Month</Label>
                <Select 
                  value={reportMonth.toString()} 
                  onValueChange={(value) => setReportMonth(parseInt(value))}
                  disabled={!gridValidation.isValid}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={computeTargets} 
                disabled={!canCompute}
                className="w-full"
                variant="default"
              >
                Calculate ROY Targets
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column - Results Section */}
        <div className="space-y-6">
          {/* YTD Pace Card */}
          {royResult && ytdTotal && (
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">YTD Pace Analysis</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">{ytdTotal}</div>
                    <div className="text-xs text-muted-foreground">YTD Items Total</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">{royResult.monthsElapsed}</div>
                    <div className="text-xs text-muted-foreground">Months Elapsed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">{royResult.paceItemsPerMonth.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Pace Items/Month</div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ROY Targets Table */}
          {royResult && (
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Rest-of-Year Targets ({royResult.monthsRemaining} months remaining)</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Compare old targets with new rest-of-year targets needed to reach annual goals
                    </p>
                  </div>
                  <Button 
                    onClick={handleSaveSnapshot} 
                    disabled={!royResult || isSaving}
                    className="gap-2"
                    variant="default"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Snapshot"}
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2">Bonus Tier</th>
                        <th className="text-right py-2">
                          <div>Old Target</div>
                          <div className="font-normal">(Monthly Items)</div>
                        </th>
                        <th className="text-right py-2">
                          <div>New Target</div>
                          <div className="font-normal">(Monthly Items)</div>
                        </th>
                        <th className="text-right py-2">
                          <div>Δ Change</div>
                          <div className="font-normal">(Items/Month)</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {royResult.tiers.map((tier, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="py-3 font-medium">{tier.tierLabel}</td>
                          <td className="py-3 text-right">
                            <span className="text-red-600 font-medium">{tier.oldMonthlyItems}</span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-green-600 font-medium">{tier.newMonthlyItemsCeiling}</span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {tier.deltaItemsPerMonth > 0 ? (
                                <>
                                  <ArrowUp className="h-3 w-3 text-red-500" />
                                  <span className="text-red-600 font-medium">+{tier.deltaItemsPerMonth}</span>
                                </>
                              ) : tier.deltaItemsPerMonth < 0 ? (
                                <>
                                  <ArrowDown className="h-3 w-3 text-green-500" />
                                  <span className="text-green-600 font-medium">{tier.deltaItemsPerMonth}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
