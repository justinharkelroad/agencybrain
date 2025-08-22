import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Upload, Calendar, Target, Save, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { parseBusinessMetricsPdf, getMonthName, type ParsedPdf } from "@/lib/parseBusinessMetricsPdf";
import { computeRoyTargets, type RoyResult, type RoyParams } from "@/lib/computeRoyTargets";
import { getBonusGridState, getGridValidation, getMonthlyItemsNeeded, getPointsItemsMix } from "@/lib/bonusGridState";
import { supabase } from "@/integrations/supabase/client";

export default function SnapshotPlannerPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Form state
  const [snapshotDate, setSnapshotDate] = useState<Date>(new Date());
  const [parsedPdf, setParsedPdf] = useState<ParsedPdf | null>(null);
  const [ytdOverride, setYtdOverride] = useState("");
  const [dailyMode, setDailyMode] = useState<'21-day' | 'business'>('21-day');
  const [royResult, setRoyResult] = useState<RoyResult | null>(null);
  const [isSaving, setSaving] = useState(false);
  
  // Check grid validation
  const gridValidation = getGridValidation();
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file only.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const result = await parseBusinessMetricsPdf(file);
      setParsedPdf(result);
      setYtdOverride(""); // Clear override when new PDF uploaded
      
      if (result.ytdItemsTotal) {
        toast({
          title: "PDF processed successfully",
          description: `YTD Items: ${result.ytdItemsTotal} • Month: ${getMonthName(result.uploadedMonth)}`
        });
        // Automatically compute ROY targets
        computeTargets(result.ytdItemsTotal, result.uploadedMonth);
      } else {
        toast({
          title: "PDF uploaded - manual input needed",
          description: `Detected month: ${getMonthName(result.uploadedMonth)} • Please enter YTD total manually`,
          variant: "default"
        });
      }
      
    } catch (error) {
      toast({
        title: "PDF parsing failed", 
        description: error instanceof Error ? error.message : "Could not parse PDF",
        variant: "destructive"
      });
    }
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });
  
  const computeTargets = (ytdTotal: number, reportMonth: number) => {
    const monthlyItems = getMonthlyItemsNeeded();
    const m25 = getPointsItemsMix();
    
    if (monthlyItems.length !== 7) {
      toast({
        title: "Grid data missing",
        description: "Could not read Monthly Items Needed from Bonus Grid. Please ensure the grid is properly filled.",
        variant: "destructive"
      });
      return;
    }
    
    const params: RoyParams = {
      ytdItemsTotal: ytdTotal,
      reportMonth,
      oldMonthlyItemsByTier: monthlyItems,
      m25,
      dailyMode
    };
    
    const result = computeRoyTargets(params);
    setRoyResult(result);
  };
  
  const handleYtdOverrideSubmit = () => {
    const ytdValue = parseInt(ytdOverride);
    if (!ytdValue || ytdValue <= 0) {
      toast({
        title: "Invalid YTD value",
        description: "Please enter a valid positive number for YTD Items.",
        variant: "destructive"
      });
      return;
    }
    
    if (!parsedPdf) {
      toast({
        title: "No PDF uploaded",
        description: "Please upload a PDF first.",
        variant: "destructive"
      });
      return;
    }
    
    computeTargets(ytdValue, parsedPdf.uploadedMonth);
  };
  
  const handleSaveSnapshot = async () => {
    if (!royResult || !parsedPdf) {
      toast({
        title: "Cannot save snapshot",
        description: "Please upload a PDF and compute targets first.",
        variant: "destructive"
      });
      return;
    }
    
    const ytdTotal = parsedPdf.ytdItemsTotal || parseInt(ytdOverride);
    if (!ytdTotal) {
      toast({
        title: "Missing YTD data",
        description: "YTD Items Total is required to save snapshot.",
        variant: "destructive"
      });
      return;
    }
    
    setSaving(true);
    
    try {
      const { error } = await supabase.from('snapshot_planner').insert({
        snapshot_date: format(snapshotDate, 'yyyy-MM-dd'),
        uploaded_month: parsedPdf.uploadedMonth,
        ytd_items_total: ytdTotal,
        current_month_items_total: parsedPdf.currentMonthItemsTotal,
        grid_version: JSON.stringify(getBonusGridState()),
        tiers: royResult.tiers,
        raw_pdf_meta: {
          filename: 'uploaded_file.pdf',
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
  
  const ytdTotal = parsedPdf?.ytdItemsTotal || (ytdOverride ? parseInt(ytdOverride) : null);
  const showOverride = parsedPdf && !parsedPdf.ytdItemsTotal;
  const canCompute = parsedPdf && ytdTotal;
  
  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Navigation Header */}
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

      {/* Header */}
      <div className="relative rounded-2xl border border-border bg-gradient-to-br from-card via-card to-card/80 p-6 shadow-2xl backdrop-blur-sm">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-accent/20 blur-xl -z-10"></div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
              Snapshot Planner
            </h1>
            <p className="text-muted-foreground">Calculate rest-of-year targets based on YTD performance</p>
          </div>
          
          <div className="text-right">
            <Target className="h-12 w-12 text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">ROY Planning</p>
          </div>
        </div>
      </div>

      {/* Warning if grid not ready */}
      {!gridValidation.isValid && (
        <Card className="p-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Target className="h-5 w-5" />
            <div>
              <p className="font-medium">Bonus Grid Required</p>
              <p className="text-sm">Please complete and save your Bonus Grid first to use the Snapshot Planner.</p>
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

          {/* PDF Upload */}
          <Card className="p-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">Upload Your Latest Business Metrics PDF</Label>
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                  parsedPdf && "border-green-500 bg-green-50 dark:bg-green-950"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                {parsedPdf ? (
                  <div className="text-green-700 dark:text-green-300">
                    <p className="font-medium">PDF Uploaded Successfully</p>
                    <p className="text-sm">Month: {getMonthName(parsedPdf.uploadedMonth)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">Drag & drop your PDF here, or click to select</p>
                    <p className="text-sm text-muted-foreground mt-1">PDF files only</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* YTD Override (conditional) */}
          {showOverride && (
            <Card className="p-6">
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  YTD Items through {parsedPdf ? getMonthName(parsedPdf.uploadedMonth) : 'Uploaded Month'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  We couldn't extract YTD total from the PDF. Please enter the total items manually.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Enter YTD Items Total"
                    value={ytdOverride}
                    onChange={(e) => setYtdOverride(e.target.value)}
                  />
                  <Button onClick={handleYtdOverrideSubmit} disabled={!ytdOverride}>
                    Calculate
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Daily View Toggle */}
          <Card className="p-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">Daily View</Label>
              <p className="text-sm text-muted-foreground">
                Show additional breakdown columns for daily items and points targets based on your Points/Items Mix from the Bonus Grid.
              </p>
              <ToggleGroup type="single" value={dailyMode} onValueChange={(value) => value && setDailyMode(value as any)}>
                <ToggleGroupItem value="21-day">21-Day Convention</ToggleGroupItem>
                <ToggleGroupItem value="business" disabled>Business Days (Coming Soon)</ToggleGroupItem>
              </ToggleGroup>
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
                <div>
                  <h3 className="font-medium">Rest-of-Year Targets ({royResult.monthsRemaining} months remaining)</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Compare old targets with new rest-of-year targets needed to reach annual goals
                  </p>
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
                        {dailyMode === '21-day' && royResult.tiers[0].newDailyItems21 !== undefined && (
                          <>
                            <th className="text-right py-2">
                              <div>New Monthly</div>
                              <div className="font-normal">(Points)</div>
                            </th>
                            <th className="text-right py-2">
                              <div>New Daily</div>
                              <div className="font-normal">(Items)</div>
                            </th>
                            <th className="text-right py-2">
                              <div>New Daily</div>
                              <div className="font-normal">(Points)</div>
                            </th>
                          </>
                        )}
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
                            <div className="text-green-600 font-medium">{tier.newMonthlyItemsCeiling}</div>
                            <div className="text-xs text-muted-foreground">({tier.newMonthlyItemsExact.toFixed(1)} exact)</div>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {tier.deltaItemsPerMonth > 0 ? (
                                <ArrowUp className="h-3 w-3 text-red-500" />
                              ) : tier.deltaItemsPerMonth < 0 ? (
                                <ArrowDown className="h-3 w-3 text-green-500" />
                              ) : null}
                              <span className={
                                tier.deltaItemsPerMonth > 0 ? "text-red-600 font-medium" : 
                                tier.deltaItemsPerMonth < 0 ? "text-green-600 font-medium" : "text-muted-foreground"
                              }>
                                {tier.deltaItemsPerMonth > 0 ? '+' : ''}{tier.deltaItemsPerMonth.toFixed(1)}
                              </span>
                            </div>
                          </td>
                          {dailyMode === '21-day' && tier.newMonthlyPoints !== undefined && (
                            <>
                              <td className="py-3 text-right font-medium">{tier.newMonthlyPoints.toFixed(0)}</td>
                              <td className="py-3 text-right">{tier.newDailyItems21?.toFixed(1) || '—'}</td>
                              <td className="py-3 text-right">{tier.newDailyPoints21?.toFixed(1) || '—'}</td>
                            </>
                          )}
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

      {/* Save Snapshot Button */}
      {royResult && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            This does not change your Bonus Grid. Snapshots are independent.
          </p>
          <Button 
            onClick={handleSaveSnapshot} 
            disabled={isSaving || !gridValidation.isValid}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Snapshot"}
          </Button>
        </div>
      )}
    </main>
  );
}