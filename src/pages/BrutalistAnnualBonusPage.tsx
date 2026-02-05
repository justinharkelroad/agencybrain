import { useState, useMemo, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Target,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Calculator,
  Percent,
  BarChart3,
  Clock,
  CheckCircle2,
  HelpCircle,
  Upload,
  Download,
  FileSpreadsheet,
  Image,
  X,
  Loader2,
  File,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { BrutalistSidebar } from '@/components/brutalist';
import { toast } from 'sonner';

// Import bonus grid computation utilities
import inputsSchema from '../bonus_grid_web_spec/schema_inputs.json';
import { computeRounded, type CellAddr, type WorkbookState } from '../bonus_grid_web_spec/computeWithRounding';
import outputsMap from '../bonus_grid_web_spec/outputs_addresses.json';
import { buildNormalizedState } from '../bonus_grid_web_spec/normalize';
import { getBonusGridState, saveBonusGridState } from '@/lib/bonusGridState';
import { BASELINE_ROWS, NEW_BIZ_ROWS } from '../bonus_grid_web_spec/rows';

// ===========================================================================
// BRUTALIST ANNUAL BONUS TOOL PAGE
// A Neo-Brutalist take on the Allstate Bonus Grid calculator
// ===========================================================================

const PPI_DEFAULTS: Record<CellAddr, number> = {
  'Sheet1!D9': 10, 'Sheet1!D10': 0, 'Sheet1!D11': 0, 'Sheet1!D12': 5, 'Sheet1!D13': 20, 'Sheet1!D14': 20,
  'Sheet1!D15': 5, 'Sheet1!D16': 5, 'Sheet1!D17': 5, 'Sheet1!D18': 5, 'Sheet1!D19': 5, 'Sheet1!D20': 0,
  'Sheet1!D21': 0, 'Sheet1!D22': 0, 'Sheet1!D23': 10,
  'Sheet1!L9': 10, 'Sheet1!L10': 0, 'Sheet1!L11': 0, 'Sheet1!L12': 5, 'Sheet1!L13': 20, 'Sheet1!L14': 20,
  'Sheet1!L15': 5, 'Sheet1!L16': 5, 'Sheet1!L17': 5, 'Sheet1!L18': 5, 'Sheet1!L19': 5, 'Sheet1!L20': 0,
  'Sheet1!L21': 0, 'Sheet1!L22': 0, 'Sheet1!L23': 10,
};

// Baseline row labels
const BASELINE_LABELS: Record<string, string> = {
  '9': 'AUTO',
  '10': 'MOTORCYCLE',
  '11': 'RV',
  '12': 'BOAT',
  '13': 'FIRE',
  '14': 'RENTERS',
  '15': 'CONDO',
  '16': 'LANDLORD',
  '17': 'LIFE',
  '18': 'ANNUITY',
  '19': 'AFR',
  '20': 'HEALTH',
  '21': 'DEALER',
  '22': 'COMMERCIAL',
  '23': 'UMBRELLA',
};

export default function BrutalistAnnualBonusPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLightMode] = useState(false);

  // State
  const [state, setState] = useState<Record<CellAddr, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [savedSig, setSavedSig] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['baseline', 'summary']));

  // Note: Access check removed for mockup/prototype testing

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const dbState = await getBonusGridState();

        if (dbState && Object.keys(dbState).length > 0) {
          setState(dbState);
          setLastSaved(new Date());
        } else {
          // Fallback to schema defaults plus PPI defaults
          const base = Object.fromEntries(
            (inputsSchema as any).all_fields.map((f: any) => [`${f.sheet}!${f.cell}` as CellAddr, f.default ?? ''])
          );
          const filled = { ...base, ...PPI_DEFAULTS };
          setState(filled);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        const base = Object.fromEntries(
          (inputsSchema as any).all_fields.map((f: any) => [`${f.sheet}!${f.cell}` as CellAddr, f.default ?? ''])
        );
        const filled = { ...base, ...PPI_DEFAULTS };
        setState(filled);
      } finally {
        setIsLoading(false);
        // Set baseline signature after loading
        setTimeout(() => {
          setSavedSig(JSON.stringify(state));
        }, 100);
      }
    };

    loadData();
  }, []);

  // Auto-save
  useEffect(() => {
    if (savedSig === null || isLoading) return;

    const currentSig = JSON.stringify(state);
    if (currentSig === savedSig) return;

    const saveData = async () => {
      setIsAutoSaving(true);
      try {
        const result = await saveBonusGridState(state);
        if (result.success) {
          setLastSaved(new Date());
          setSavedSig(currentSig);
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsAutoSaving(false);
      }
    };

    const t = setTimeout(saveData, 1500);
    return () => clearTimeout(t);
  }, [state, savedSig, isLoading]);

  // Computed outputs
  const outputAddrs = useMemo(
    () =>
      [
        ...outputsMap.bonus_percent_preset,
        ...outputsMap.bonus_dollars,
        ...outputsMap.daily_points_needed,
        ...outputsMap.daily_items_needed,
      ] as CellAddr[],
    []
  );

  const allComputedAddrs = useMemo(() => {
    const baseline = BASELINE_ROWS.flatMap(r => [r.items, r.total, r.loss]);
    const baselineTotals: CellAddr[] = ['Sheet1!C24', 'Sheet1!E24', 'Sheet1!G24'];
    const newBiz = NEW_BIZ_ROWS.map(r => r.total);
    const newBizTotals: CellAddr[] = ['Sheet1!K24', 'Sheet1!M24', 'Sheet1!M25'];
    const gbf: CellAddr[] = ['Sheet1!D30', 'Sheet1!D31', 'Sheet1!D32'];
    const growthGrid: CellAddr[] = Array.from({ length: 7 }, (_, i) => 38 + i).flatMap(r =>
      [
        `Sheet1!C${r}`,
        `Sheet1!D${r}`,
        `Sheet1!E${r}`,
        `Sheet1!F${r}`,
        `Sheet1!G${r}`,
        `Sheet1!H${r}`,
        `Sheet1!I${r}`,
        `Sheet1!J${r}`,
        `Sheet1!K${r}`,
        `Sheet1!L${r}`,
      ] as CellAddr[]
    );
    return [
      ...outputAddrs,
      ...baseline,
      ...baselineTotals,
      ...newBiz,
      ...newBizTotals,
      ...gbf,
      ...growthGrid,
      'Sheet1!K45' as CellAddr,
      'Sheet1!L45' as CellAddr,
    ];
  }, [outputAddrs]);

  const allOutputs = useMemo(() => {
    const normalized = buildNormalizedState(state, inputsSchema as any);
    return computeRounded({ inputs: normalized } as WorkbookState, allComputedAddrs);
  }, [state, allComputedAddrs]);

  // Key metrics
  const bonusPercent = allOutputs['Sheet1!H38'] ?? 0;
  const bonusDollars = allOutputs['Sheet1!D38'] ?? 0;
  const dailyPointsNeeded = allOutputs['Sheet1!K38'] ?? 0;
  const dailyItemsNeeded = allOutputs['Sheet1!L38'] ?? 0;

  // Maximum bonus
  const maxBonus = useMemo(() => {
    const bonusAmounts = outputsMap.bonus_dollars.map(addr => allOutputs[addr] ?? 0);
    return Math.max(...bonusAmounts);
  }, [allOutputs]);

  const setField = (addr: CellAddr, val: any) => setState(p => ({ ...p, [addr]: val }));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const isDirty = savedSig !== null && JSON.stringify(state) !== savedSig;

  // File upload state
  const [metricsFile, setMetricsFile] = useState<File | null>(null);
  const [metricsStatus, setMetricsStatus] = useState<'empty' | 'selected' | 'processing' | 'success' | 'error'>('empty');
  const [qualifiersFile, setQualifiersFile] = useState<File | null>(null);
  const [qualifiersStatus, setQualifiersStatus] = useState<'empty' | 'selected' | 'processing' | 'success' | 'error'>('empty');

  // Metrics dropzone
  const onMetricsDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setMetricsFile(file);
      setMetricsStatus('selected');
    }
  }, []);

  const metricsDropzone = useDropzone({
    onDrop: onMetricsDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  // Qualifiers dropzone
  const onQualifiersDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setQualifiersFile(file);
      setQualifiersStatus('selected');
    }
  }, []);

  const qualifiersDropzone = useDropzone({
    onDrop: onQualifiersDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  });

  const handleExtractFiles = async () => {
    if (metricsFile) {
      setMetricsStatus('processing');
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      setMetricsStatus('success');
      toast.success('Business Metrics extracted!');
    }
    if (qualifiersFile) {
      setQualifiersStatus('processing');
      await new Promise(resolve => setTimeout(resolve, 2500));
      setQualifiersStatus('success');
      toast.success('Bonus Qualifiers extracted!');
    }
  };

  const removeMetricsFile = () => {
    setMetricsFile(null);
    setMetricsStatus('empty');
  };

  const removeQualifiersFile = () => {
    setQualifiersFile(null);
    setQualifiersStatus('empty');
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="brutalist-app brutalist-app-bg flex h-screen overflow-hidden font-brutalist">
      {/* Sidebar */}
      <BrutalistSidebar agencyName={null} isLightMode={isLightMode} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b-2 border-white px-6 py-4 flex items-center justify-between bg-[#1A1A2E]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--brutalist-yellow)] flex items-center justify-center">
              <Trophy className="w-6 h-6 text-[#1A1A2E]" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white uppercase tracking-wide">
                ANNUAL BONUS GRID
              </h1>
              <p className="text-white/50 text-sm uppercase tracking-wider mt-1">
                ALLSTATE BONUS CALCULATOR
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Save Status */}
            <div className="flex items-center gap-2 text-sm mr-4">
              {isAutoSaving ? (
                <span className="text-[var(--brutalist-yellow)] flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  SAVING...
                </span>
              ) : isDirty ? (
                <span className="text-[#FF5252] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  UNSAVED
                </span>
              ) : lastSaved ? (
                <span className="text-[#4CAF50] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  SAVED
                </span>
              ) : null}
            </div>
            <button className="border-2 border-white/30 text-white/60 px-4 py-2 font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:border-white hover:text-white transition-colors">
              <Upload className="w-4 h-4" />
              IMPORT
            </button>
            <button className="border-2 border-white text-white px-4 py-2 font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:bg-white hover:text-[#0D0D0D] transition-colors">
              <Download className="w-4 h-4" />
              EXPORT
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-white">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="uppercase tracking-wider">Loading...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Hero KPI Strip */}
              <div className="grid grid-cols-4 gap-0 border-2 border-white">
                <KPICard
                  value={`${(bonusPercent * 100).toFixed(2)}%`}
                  label="BONUS %"
                  icon={<Percent className="w-5 h-5" />}
                  color="var(--brutalist-yellow)"
                  borderRight
                />
                <KPICard
                  value={bonusDollars.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                  label="BONUS $"
                  icon={<DollarSign className="w-5 h-5" />}
                  color="#4CAF50"
                  borderRight
                />
                <KPICard
                  value={dailyPointsNeeded.toFixed(2)}
                  label="DAILY POINTS"
                  icon={<Target className="w-5 h-5" />}
                  color="#FFFFFF"
                  borderRight
                />
                <KPICard
                  value={dailyItemsNeeded.toFixed(2)}
                  label="DAILY ITEMS"
                  icon={<BarChart3 className="w-5 h-5" />}
                  color="#FFFFFF"
                />
              </div>

              {/* Maximum Bonus Potential */}
              <div className="border-2 border-[var(--brutalist-yellow)] bg-[var(--brutalist-yellow)]/10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">🏆🏆🏆🏆</div>
                  <div>
                    <div className="text-[var(--brutalist-yellow)] text-xs uppercase tracking-widest font-bold">
                      MAXIMUM BONUS POTENTIAL
                    </div>
                    <div className="text-white text-3xl font-black">
                      {maxBonus.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                    </div>
                  </div>
                </div>
                <button className="border-2 border-[var(--brutalist-yellow)] text-[var(--brutalist-yellow)] px-4 py-2 font-bold uppercase text-sm tracking-wider hover:bg-[var(--brutalist-yellow)] hover:text-[#1A1A2E] transition-colors flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  SNAPSHOT PLANNER
                </button>
              </div>

              {/* DRAG & DROP UPLOAD SECTION */}
              <div className="border-2 border-white bg-[#1A1A2E]">
                <div className="p-4 border-b border-white/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 border-2 border-[#4CAF50] flex items-center justify-center">
                      <Upload className="w-5 h-5 text-[#4CAF50]" />
                    </div>
                    <div>
                      <span className="text-white font-bold uppercase tracking-wider">
                        QUICK SETUP
                      </span>
                      <p className="text-white/40 text-xs uppercase tracking-wider">
                        DRAG & DROP YOUR ALLSTATE REPORTS
                      </p>
                    </div>
                  </div>
                  {(metricsFile || qualifiersFile) && (
                    <button
                      onClick={handleExtractFiles}
                      disabled={metricsStatus === 'processing' || qualifiersStatus === 'processing'}
                      className="bg-[#4CAF50] text-[#0D0D0D] px-5 py-2.5 font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:bg-[#66BB6A] transition-colors disabled:opacity-50"
                    >
                      {(metricsStatus === 'processing' || qualifiersStatus === 'processing') ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          EXTRACTING...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          EXTRACT DATA
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Business Metrics Dropzone */}
                  <BrutalistDropzone
                    dropzone={metricsDropzone}
                    status={metricsStatus}
                    file={metricsFile}
                    onRemove={removeMetricsFile}
                    icon={<FileSpreadsheet className="w-8 h-8" />}
                    title="BUSINESS METRICS"
                    subtitle="DROP XLSX FILE HERE"
                    acceptText=".xlsx or .xls files"
                    successText="METRICS EXTRACTED"
                    accentColor="var(--brutalist-yellow)"
                  />

                  {/* Bonus Qualifiers Dropzone */}
                  <BrutalistDropzone
                    dropzone={qualifiersDropzone}
                    status={qualifiersStatus}
                    file={qualifiersFile}
                    onRemove={removeQualifiersFile}
                    icon={<Image className="w-8 h-8" />}
                    title="BONUS QUALIFIERS"
                    subtitle="DROP IMAGE OR PDF HERE"
                    acceptText="PNG, JPG, or PDF"
                    successText="QUALIFIERS EXTRACTED"
                    accentColor="#4CAF50"
                  />
                </div>

                <div className="px-4 pb-4">
                  <p className="text-white/30 text-xs uppercase tracking-wider text-center">
                    💡 DOWNLOAD YOUR REPORTS FROM THE ALLSTATE PORTAL • OR ENTER DATA MANUALLY BELOW
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* Baseline Section */}
                  <CollapsibleSection
                    title="BASELINE"
                    subtitle="CURRENT TOTAL ITEMS IN FORCE"
                    isOpen={expandedSections.has('baseline')}
                    onToggle={() => toggleSection('baseline')}
                    accentColor="var(--brutalist-yellow)"
                  >
                    <div className="space-y-2">
                      {BASELINE_ROWS.map(row => {
                        const rowNum = row.items.split('!')[1].replace(/\D/g, '');
                        const label = BASELINE_LABELS[rowNum] || `ROW ${rowNum}`;
                        const itemsAddr = row.items as CellAddr;
                        const lossAddr = `Sheet1!F${rowNum}` as CellAddr;

                        return (
                          <div
                            key={row.items}
                            className="flex items-center gap-4 border border-white/10 p-3"
                          >
                            <div className="w-24 text-white/50 text-xs uppercase tracking-wider font-bold">
                              {label}
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <label className="text-white/30 text-xs w-12">ITEMS</label>
                              <input
                                type="number"
                                value={state[itemsAddr] ?? ''}
                                onChange={e => setField(itemsAddr, e.target.value)}
                                className="flex-1 bg-[#0D0D0D] border border-white/30 text-white px-3 py-2 text-sm font-bold focus:border-[var(--brutalist-yellow)] focus:outline-none"
                                placeholder="0"
                              />
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <label className="text-white/30 text-xs w-12">LOSS%</label>
                              <input
                                type="number"
                                value={state[lossAddr] ?? ''}
                                onChange={e => setField(lossAddr, e.target.value)}
                                className="flex-1 bg-[#0D0D0D] border border-white/30 text-white px-3 py-2 text-sm font-bold focus:border-[var(--brutalist-yellow)] focus:outline-none"
                                placeholder="0"
                              />
                            </div>
                            <div className="w-20 text-right">
                              <span className="text-[var(--brutalist-yellow)] font-bold">
                                {(allOutputs[row.total] ?? 0).toFixed(0)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {/* Totals */}
                      <div className="flex items-center justify-between border-t-2 border-white/20 pt-3 mt-3">
                        <span className="text-white font-bold uppercase">TOTAL BASELINE</span>
                        <span className="text-2xl font-black text-[var(--brutalist-yellow)]">
                          {(allOutputs['Sheet1!E24'] ?? 0).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* New Business Section */}
                  <CollapsibleSection
                    title="NEW BUSINESS"
                    subtitle="PRIOR YEAR PRODUCTION"
                    isOpen={expandedSections.has('newbiz')}
                    onToggle={() => toggleSection('newbiz')}
                    accentColor="#4CAF50"
                  >
                    <div className="space-y-2">
                      {NEW_BIZ_ROWS.map(row => {
                        const rowNum = row.items.split('!')[1].replace(/\D/g, '');
                        const label = BASELINE_LABELS[rowNum] || `ROW ${rowNum}`;
                        const itemsAddr = row.items as CellAddr;
                        const premiumAddr = row.premium as CellAddr;

                        return (
                          <div
                            key={row.items}
                            className="flex items-center gap-4 border border-white/10 p-3"
                          >
                            <div className="w-24 text-white/50 text-xs uppercase tracking-wider font-bold">
                              {label}
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <label className="text-white/30 text-xs w-12">ITEMS</label>
                              <input
                                type="number"
                                value={state[itemsAddr] ?? ''}
                                onChange={e => setField(itemsAddr, e.target.value)}
                                className="flex-1 bg-[#0D0D0D] border border-white/30 text-white px-3 py-2 text-sm font-bold focus:border-[#4CAF50] focus:outline-none"
                                placeholder="0"
                              />
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <label className="text-white/30 text-xs w-12">PREM$</label>
                              <input
                                type="number"
                                value={state[premiumAddr] ?? ''}
                                onChange={e => setField(premiumAddr, e.target.value)}
                                className="flex-1 bg-[#0D0D0D] border border-white/30 text-white px-3 py-2 text-sm font-bold focus:border-[#4CAF50] focus:outline-none"
                                placeholder="0"
                              />
                            </div>
                            <div className="w-20 text-right">
                              <span className="text-[#4CAF50] font-bold">
                                {(allOutputs[row.total] ?? 0).toFixed(0)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {/* Totals */}
                      <div className="flex items-center justify-between border-t-2 border-white/20 pt-3 mt-3">
                        <span className="text-white font-bold uppercase">TOTAL NEW BUSINESS</span>
                        <span className="text-2xl font-black text-[#4CAF50]">
                          {(allOutputs['Sheet1!M24'] ?? 0).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* Growth Bonus Factors */}
                  <CollapsibleSection
                    title="GROWTH BONUS FACTORS"
                    isOpen={expandedSections.has('gbf')}
                    onToggle={() => toggleSection('gbf')}
                    accentColor="#FF5252"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border border-white/10 p-3">
                        <span className="text-white/50 text-xs uppercase tracking-wider">
                          GROWTH FACTOR
                        </span>
                        <span className="text-xl font-black text-white">
                          {(allOutputs['Sheet1!D30'] ?? 0).toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border border-white/10 p-3">
                        <span className="text-white/50 text-xs uppercase tracking-wider">
                          RETENTION FACTOR
                        </span>
                        <span className="text-xl font-black text-white">
                          {(allOutputs['Sheet1!D31'] ?? 0).toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border border-white/10 p-3">
                        <span className="text-white/50 text-xs uppercase tracking-wider">
                          COMBINED FACTOR
                        </span>
                        <span className="text-xl font-black text-[var(--brutalist-yellow)]">
                          {(allOutputs['Sheet1!D32'] ?? 0).toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </CollapsibleSection>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Growth Grid Summary */}
                  <CollapsibleSection
                    title="GROWTH GRID SUMMARY"
                    isOpen={expandedSections.has('summary')}
                    onToggle={() => toggleSection('summary')}
                    accentColor="var(--brutalist-yellow)"
                  >
                    <div className="space-y-2">
                      {/* Grid Header */}
                      <div className="grid grid-cols-6 gap-2 text-center mb-2">
                        <div className="text-white/30 text-[10px] uppercase">GOAL</div>
                        <div className="text-white/30 text-[10px] uppercase">BONUS$</div>
                        <div className="text-white/30 text-[10px] uppercase">ITEMS</div>
                        <div className="text-white/30 text-[10px] uppercase">POINTS</div>
                        <div className="text-white/30 text-[10px] uppercase">%</div>
                        <div className="text-white/30 text-[10px] uppercase">$/DAY</div>
                      </div>

                      {/* Grid Rows */}
                      {[38, 39, 40, 41, 42, 43, 44].map((rowNum, idx) => {
                        const goalAddr = `Sheet1!C${rowNum}` as CellAddr;
                        const bonusDollarAddr = `Sheet1!D${rowNum}` as CellAddr;
                        const itemsAddr = `Sheet1!E${rowNum}` as CellAddr;
                        const pointsAddr = `Sheet1!F${rowNum}` as CellAddr;
                        const percentAddr = `Sheet1!H${rowNum}` as CellAddr;
                        const dailyAddr = `Sheet1!K${rowNum}` as CellAddr;

                        const isCurrentTier = idx === 0; // First row is current target

                        return (
                          <div
                            key={rowNum}
                            className={cn(
                              'grid grid-cols-6 gap-2 text-center py-2 border',
                              isCurrentTier
                                ? 'border-[var(--brutalist-yellow)] bg-[var(--brutalist-yellow)]/10'
                                : 'border-white/10'
                            )}
                          >
                            <div>
                              <input
                                type="number"
                                value={state[goalAddr] ?? ''}
                                onChange={e => setField(goalAddr, e.target.value)}
                                className={cn(
                                  'w-full bg-transparent border-0 text-center text-sm font-bold focus:outline-none',
                                  isCurrentTier ? 'text-[var(--brutalist-yellow)]' : 'text-white'
                                )}
                                placeholder="0"
                              />
                            </div>
                            <div className="text-[#4CAF50] font-bold text-sm">
                              ${(allOutputs[bonusDollarAddr] ?? 0).toLocaleString()}
                            </div>
                            <div className="text-white/60 text-sm">
                              {(allOutputs[itemsAddr] ?? 0).toFixed(0)}
                            </div>
                            <div className="text-white/60 text-sm">
                              {(allOutputs[pointsAddr] ?? 0).toFixed(0)}
                            </div>
                            <div
                              className={cn(
                                'font-bold text-sm',
                                isCurrentTier ? 'text-[var(--brutalist-yellow)]' : 'text-white'
                              )}
                            >
                              {((allOutputs[percentAddr] ?? 0) * 100).toFixed(1)}%
                            </div>
                            <div className="text-white/40 text-sm">
                              ${(allOutputs[dailyAddr] ?? 0).toFixed(0)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleSection>

                  {/* Quick Actions */}
                  <div className="border-2 border-white bg-[#1A1A2E] p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-6 bg-white" />
                      <span className="text-white font-bold uppercase tracking-wider">
                        QUICK ACTIONS
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => navigate('/snapshot-planner')}
                        className="border-2 border-[var(--brutalist-yellow)] text-[var(--brutalist-yellow)] p-4 font-bold uppercase text-sm tracking-wider hover:bg-[var(--brutalist-yellow)] hover:text-[#1A1A2E] transition-colors flex flex-col items-center gap-2"
                      >
                        <Target className="w-6 h-6" />
                        SNAPSHOT PLANNER
                      </button>
                      <button className="border-2 border-white/30 text-white/60 p-4 font-bold uppercase text-sm tracking-wider hover:border-white hover:text-white transition-colors flex flex-col items-center gap-2">
                        <Calculator className="w-6 h-6" />
                        CALCULATOR
                      </button>
                      <button className="border-2 border-white/30 text-white/60 p-4 font-bold uppercase text-sm tracking-wider hover:border-white hover:text-white transition-colors flex flex-col items-center gap-2">
                        <BarChart3 className="w-6 h-6" />
                        REPORTS
                      </button>
                      <button className="border-2 border-white/30 text-white/60 p-4 font-bold uppercase text-sm tracking-wider hover:border-white hover:text-white transition-colors flex flex-col items-center gap-2">
                        <HelpCircle className="w-6 h-6" />
                        HELP
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ===========================================================================
// KPI CARD COMPONENT
// ===========================================================================
function KPICard({
  value,
  label,
  icon,
  color,
  borderRight = false,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  borderRight?: boolean;
}) {
  return (
    <div
      className={cn('p-6 bg-[#1A1A2E]', borderRight && 'border-r-2 border-white')}
      style={{ borderTop: `4px solid ${color}` }}
    >
      <div className="flex items-center gap-3 mb-3" style={{ color }}>
        {icon}
      </div>
      <div className="text-3xl lg:text-4xl font-black text-white leading-none">{value}</div>
      <div className="text-white/50 text-xs font-bold uppercase tracking-widest mt-2">{label}</div>
    </div>
  );
}

// ===========================================================================
// BRUTALIST DROPZONE COMPONENT
// ===========================================================================
function BrutalistDropzone({
  dropzone,
  status,
  file,
  onRemove,
  icon,
  title,
  subtitle,
  acceptText,
  successText,
  accentColor,
}: {
  dropzone: ReturnType<typeof useDropzone>;
  status: 'empty' | 'selected' | 'processing' | 'success' | 'error';
  file: File | null;
  onRemove: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  acceptText: string;
  successText: string;
  accentColor: string;
}) {
  const { getRootProps, getInputProps, isDragActive } = dropzone;

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed p-6 transition-all cursor-pointer',
          'hover:border-solid group',
          isDragActive && 'border-solid bg-white/10',
          status === 'empty' && 'border-white/30 hover:border-white',
          status === 'selected' && 'border-white/50 bg-white/5',
          status === 'processing' && 'border-white/30 bg-white/5',
          status === 'success' && 'border-[#4CAF50] bg-[#4CAF50]/10',
          status === 'error' && 'border-[#FF5252] bg-[#FF5252]/10'
        )}
        style={isDragActive ? { borderColor: accentColor, backgroundColor: `${accentColor}20` } : undefined}
      >
        <input {...getInputProps()} />

        {/* Drag Active Overlay */}
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-[#1A1A2E]/90 z-10"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1 }}
              style={{ color: accentColor }}
            >
              <Upload className="w-12 h-12" />
            </motion.div>
            <span className="text-white font-bold uppercase tracking-wider mt-3">
              DROP IT!
            </span>
          </motion.div>
        )}

        {/* Empty State */}
        {status === 'empty' && !isDragActive && (
          <div className="flex flex-col items-center text-center">
            <div
              className="w-16 h-16 border-2 flex items-center justify-center mb-4 transition-colors group-hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.3)' }}
            >
              <div className="text-white/40 group-hover:text-white/60 transition-colors">
                {icon}
              </div>
            </div>
            <span className="text-white font-bold uppercase tracking-wider text-sm">
              {title}
            </span>
            <span className="text-white/40 text-xs uppercase tracking-wider mt-1">
              {subtitle}
            </span>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-px w-8 bg-white/20" />
              <span className="text-white/30 text-[10px] uppercase tracking-wider">
                {acceptText}
              </span>
              <div className="h-px w-8 bg-white/20" />
            </div>
          </div>
        )}

        {/* Selected State */}
        {status === 'selected' && file && !isDragActive && (
          <div className="flex flex-col items-center text-center">
            <div
              className="w-16 h-16 border-2 flex items-center justify-center mb-4"
              style={{ borderColor: accentColor }}
            >
              <File className="w-8 h-8" style={{ color: accentColor }} />
            </div>
            <span className="text-white font-bold uppercase tracking-wider text-sm truncate max-w-full px-2">
              {file.name}
            </span>
            <span className="text-white/40 text-xs uppercase tracking-wider mt-1">
              {(file.size / 1024).toFixed(1)} KB • READY TO EXTRACT
            </span>
          </div>
        )}

        {/* Processing State */}
        {status === 'processing' && (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 border-2 border-white/30 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <span className="text-white font-bold uppercase tracking-wider text-sm">
              EXTRACTING DATA...
            </span>
            <div className="mt-4 w-full max-w-[200px] h-1 bg-white/20 overflow-hidden">
              <motion.div
                className="h-full"
                style={{ backgroundColor: accentColor }}
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              />
            </div>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 border-2 border-[#4CAF50] bg-[#4CAF50] flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-[#0D0D0D]" />
            </div>
            <span className="text-[#4CAF50] font-bold uppercase tracking-wider text-sm">
              {successText}
            </span>
            <span className="text-white/40 text-xs uppercase tracking-wider mt-1">
              {file?.name}
            </span>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 border-2 border-[#FF5252] flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-[#FF5252]" />
            </div>
            <span className="text-[#FF5252] font-bold uppercase tracking-wider text-sm">
              EXTRACTION FAILED
            </span>
            <span className="text-white/40 text-xs uppercase tracking-wider mt-1">
              TRY AGAIN OR ENTER MANUALLY
            </span>
          </div>
        )}
      </div>

      {/* Remove Button */}
      {file && status !== 'processing' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="w-full border border-white/20 text-white/40 py-2 text-xs uppercase tracking-wider font-bold hover:border-[#FF5252] hover:text-[#FF5252] hover:bg-[#FF5252]/10 transition-colors flex items-center justify-center gap-2"
        >
          <X className="w-3 h-3" />
          REMOVE FILE
        </button>
      )}
    </div>
  );
}

// ===========================================================================
// COLLAPSIBLE SECTION COMPONENT
// ===========================================================================
function CollapsibleSection({
  title,
  subtitle,
  isOpen,
  onToggle,
  accentColor,
  children,
}: {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-2 border-white/20 bg-[#1A1A2E]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-1 h-6" style={{ backgroundColor: accentColor }} />
          <div className="text-left">
            <span className="text-white font-bold uppercase tracking-wider text-sm">{title}</span>
            {subtitle && (
              <p className="text-white/40 text-xs uppercase tracking-wider mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-white/50" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-white/10">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
