import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { supa } from '@/lib/supa';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, CalendarIcon, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { computeEstimatedCommissionPerRow, computeTotals } from '@/utils/leadSourceCommission';
import { useUniversalDataProtection } from '@/hooks/useUniversalDataProtection';
import { UniversalDataProtectionPanel } from '@/components/UniversalDataProtectionPanel';
import type { UniversalValidationResult } from '@/lib/universalDataProtection';
import { PercentInput } from '@/components/ui/percent-input';
import { usePeriodConflictDetection } from '@/hooks/usePeriodConflictDetection';
import { usePeriodEditSession } from '@/hooks/usePeriodEditSession';
import { usePeriodBackup } from '@/hooks/usePeriodBackup';
import { ConflictWarningAlert } from '@/components/client/ConflictWarningAlert';
import { SaveStatusIndicator } from '@/components/client/SaveStatusIndicator';
import { generateDeviceFingerprint } from '@/lib/deviceFingerprint';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface FormData {
  sales: {
    premium: number;
    items: number;
    policies: number;
    achievedVC: boolean;
  };
  marketing: {
    totalSpend: number;
    policiesQuoted: number;
    leadSources: { name: string; spend: number; soldPremium?: number; commissionRate?: number }[];
  };
  operations: {
    currentAlrTotal: number;
    currentAapProjection: string;
    currentBonusTrend: number;
    teamRoster: { name: string; role: string }[];
  };
  retention: {
    numberTerminated: number;
    currentRetentionPercent: number;
  };
  cashFlow: {
    compensation: number;
    expenses: number;
    netProfit: number;
  };
  qualitative: {
    biggestStress: string;
    gutAction: string;
    biggestPersonalWin: string;
    biggestBusinessWin: string;
    attackItems: { item1: string; item2: string; item3: string };
  };
}

const initialFormData: FormData = {
  sales: { premium: 0, items: 0, policies: 0, achievedVC: false },
  marketing: { totalSpend: 0, policiesQuoted: 0, leadSources: [] },
  operations: { currentAlrTotal: 0, currentAapProjection: 'Emerging', currentBonusTrend: 0, teamRoster: [] },
  retention: { numberTerminated: 0, currentRetentionPercent: 0 },
  cashFlow: { compensation: 0, expenses: 0, netProfit: 0 },
  qualitative: { biggestStress: '', gutAction: '', biggestPersonalWin: '', biggestBusinessWin: '', attackItems: { item1: '', item2: '', item3: '' } },
};

// Form validation rules for Submit form
const validateSubmitForm = (data: FormData): UniversalValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!data.sales.premium && !data.sales.policies) {
    errors.push('At least premium or policies must be filled in the Sales section');
  }

  if (!data.marketing.totalSpend && data.marketing.leadSources.length === 0) {
    warnings.push('Marketing spend information is incomplete');
  }

  if (!data.cashFlow.compensation && !data.cashFlow.expenses) {
    warnings.push('Cash flow information is incomplete');
  }

  // Calculate completeness
  const totalSections = 6;
  let completeSections = 0;
  
  if (data.sales.premium || data.sales.policies) completeSections++;
  if (data.marketing.totalSpend || data.marketing.leadSources.length > 0) completeSections++;
  if (data.operations.currentAlrTotal || data.operations.teamRoster.length > 0) completeSections++;
  if (data.retention.numberTerminated || data.retention.currentRetentionPercent) completeSections++;
  if (data.cashFlow.compensation || data.cashFlow.expenses) completeSections++;
  if (data.qualitative.biggestStress || data.qualitative.gutAction) completeSections++;

  const completeness = completeSections / totalSections;

  return {
    isValid: errors.length === 0,
    warnings,
    completeness,
    criticalIssues: errors
  };
};

// Helper function to get previous full month dates
const getPreviousMonthDates = () => {
  const today = new Date();
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastDayOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  return {
    startDate: previousMonth,
    endDate: lastDayOfPreviousMonth
  };
};

export default function Submit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get URL parameters with stable references to prevent infinite useEffect loops
  const mode = useMemo(() => searchParams.get('mode'), [searchParams]); // 'update' or 'new'
  const periodIdParam = useMemo(() => searchParams.get('periodId'), [searchParams]);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<any>(null);
  
  // Initialize dates with previous month
  const previousMonthDates = useMemo(() => getPreviousMonthDates(), []);
  const [startDate, setStartDate] = useState<Date>(previousMonthDates.startDate);
  const [endDate, setEndDate] = useState<Date>(previousMonthDates.endDate);
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [showDataProtection, setShowDataProtection] = useState(false);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  const [incompleteSections, setIncompleteSections] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<Date | null>(null);
  const { toast } = useToast();
  
  const enableSoldAndCommission = true;

  // Device fingerprint for session tracking
  const [deviceFingerprint] = useState(() => generateDeviceFingerprint());
  
  // Conflict detection and edit session tracking
  const conflictInfo = usePeriodConflictDetection(currentPeriod?.id, deviceFingerprint);
  usePeriodEditSession(currentPeriod?.id, deviceFingerprint);
  
  // Backup functionality
  const { createBackup } = usePeriodBackup();

  // Initialize Universal Data Protection
  const dataProtection = useUniversalDataProtection({
    formData,
    formType: 'submit',
    tableName: 'periods',
    autoBackupEnabled: true,
    autoBackupInterval: 30,
    validationRules: validateSubmitForm,
    onDataRestored: (restoredData) => {
      setFormData(restoredData);
      setHasUnsavedChanges(true);
    }
  });

  // Apply selective data persistence from previous period
  const applySelectiveDataPersistence = useCallback(async () => {
    try {
      console.log('Applying selective data persistence...');
      
      // Fetch periods with actual form_data, excluding the current period if it exists
      const query = supa
        .from('periods')
        .select('form_data, id, created_at')
        .eq('user_id', user?.id)
        .not('form_data', 'is', null)
        .order('created_at', { ascending: false });
      
      // If we have a current period, exclude it from the query
      if (currentPeriod?.id) {
        query.neq('id', currentPeriod.id);
      }
      
      const { data: periods } = await query.limit(1).maybeSingle();

      if (periods?.form_data) {
        console.log('Found previous period with data, applying persistence...');
        const prevData = periods.form_data;
        
        const formDataFromPeriod = prevData && typeof prevData === 'object' && prevData ? prevData as any : {};
        
        const persistedData = {
          ...initialFormData,
          // Preserve team roster names and roles
          operations: {
            ...initialFormData.operations,
            teamRoster: (formDataFromPeriod.operations as any)?.teamRoster || []
          },
          // Preserve lead source names but reset spend to 0
          marketing: {
            ...initialFormData.marketing,
            leadSources: ((formDataFromPeriod.marketing as any)?.leadSources || []).map((source: any) => ({
              name: source.name,
              spend: 0
            }))
          }
        };
        
        console.log('Team roster persisted:', persistedData.operations.teamRoster);
        console.log('Lead sources persisted:', persistedData.marketing.leadSources);
        
        return persistedData;
      }
      
      console.log('No previous period with data found');
    } catch (error) {
      console.error('Error fetching previous period data:', error);
    }
    
    return initialFormData;
  }, [user?.id, currentPeriod?.id]);

  const fetchCurrentPeriod = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching current period for user:', user?.id, 'mode:', mode, 'periodId:', periodIdParam);
      
      // If mode is 'update' and we have a specific period ID, load that period
      if (mode === 'update' && periodIdParam) {
        const { data: specificPeriod, error: specificError } = await supa
          .from('periods')
          .select('*')
          .eq('user_id', user?.id)
          .eq('id', periodIdParam)
          .single();

        if (specificError) {
          console.error('Error fetching specific period:', specificError);
          toast({
            title: "Error",
            description: "Could not find the specified period to update.",
            variant: "destructive",
          });
          return;
        }

        if (specificPeriod) {
          console.log('Loading specific period for update:', specificPeriod.id);
          setCurrentPeriod(specificPeriod);
          setStartDate(new Date(specificPeriod.start_date));
          setEndDate(new Date(specificPeriod.end_date));
          
          if (specificPeriod.form_data && Object.keys(specificPeriod.form_data).length > 0) {
            // Load full existing data for update mode
            const safeFormData = {
              ...initialFormData,
              ...(typeof specificPeriod.form_data === 'object' ? specificPeriod.form_data as any : {}),
              qualitative: {
                ...initialFormData.qualitative,
                ...(typeof (specificPeriod.form_data as any)?.qualitative === 'object' ? (specificPeriod.form_data as any).qualitative : {}),
                attackItems: {
                  ...initialFormData.qualitative.attackItems,
                  ...((specificPeriod.form_data as any)?.qualitative?.attackItems || {}),
                },
              },
            };
            console.log('🟡 MODE=UPDATE: Setting form data to existing period data:', JSON.stringify(safeFormData, null, 2));
            setFormData(safeFormData);
          } else {
            // Apply selective persistence for new period
            console.log('🔵 MODE=UPDATE (no existing data): Applying selective persistence');
            const persistedData = await applySelectiveDataPersistence();
            setFormData(persistedData);
          }
          setLoading(false);
          return;
        }
      }

      // If mode is 'new', create fresh form with selective persistence
      if (mode === 'new') {
        console.log('New form mode - applying selective persistence');
        
        // If we have a specific period ID for new mode, use it
        if (periodIdParam) {
          const { data: newPeriod, error: newPeriodError } = await supa
            .from('periods')
            .select('*')
            .eq('user_id', user?.id)
            .eq('id', periodIdParam)
            .single();

          if (!newPeriodError && newPeriod) {
            setCurrentPeriod(newPeriod);
            setStartDate(new Date(newPeriod.start_date));
            setEndDate(new Date(newPeriod.end_date));
          }
        }
        
        const persistedData = await applySelectiveDataPersistence();
        console.log('🟢 MODE=NEW: Setting form data to selective persistence:', JSON.stringify(persistedData, null, 2));
        setFormData(persistedData);
        setLoading(false);
        return;
      }

      // Default behavior - look for existing active or draft periods only
      const { data: activePeriods, error: activeError } = await supa
        .from('periods')
        .select('*')
        .eq('user_id', user?.id)
        .in('status', ['active', 'draft'])
        .order('updated_at', { ascending: false })
        .limit(1);

      if (activeError) {
        console.error('Periods error:', activeError);
        toast({
          title: "Error",
          description: "Could not fetch period. Please try refreshing the page.",
          variant: "destructive",
        });
        return;
      }

      console.log('Found active/draft periods:', activePeriods);

      // If we have an active/draft period, use it
      if (activePeriods && activePeriods.length > 0) {
        const period = activePeriods[0];
        console.log('Loading existing active period:', period.id);
        setCurrentPeriod(period);
        setStartDate(new Date(period.start_date));
        setEndDate(new Date(period.end_date));
        
        if (period.form_data && Object.keys(period.form_data).length > 0) {
          // Ensure all required nested fields exist
          const safeFormData = {
            ...initialFormData,
            ...(typeof period.form_data === 'object' ? period.form_data as any : {}),
            qualitative: {
              ...initialFormData.qualitative,
              ...(typeof (period.form_data as any)?.qualitative === 'object' ? (period.form_data as any).qualitative : {}),
              attackItems: {
                ...initialFormData.qualitative.attackItems,
                ...((period.form_data as any)?.qualitative?.attackItems || {})
              }
            }
          };
          console.log('🟠 DEFAULT: Setting form data to existing period data');
          setFormData(safeFormData);
        } else {
          // Period exists but no form data - use fresh form data
          console.log('🔴 DEFAULT: Period exists but no form data - using initial form data');
          setFormData(initialFormData);
        }
        setLoading(false);
        return;
      }

      // No active periods found - load fresh form data
      console.log('🟣 DEFAULT: No active periods found - applying selective persistence');
      const persistedFormData = await applySelectiveDataPersistence();
      setFormData(persistedFormData);
      setLoading(false);

    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error", 
        description: "An unexpected error occurred. Please try refreshing the page.",
        variant: "destructive",
      });
      setLoading(false);
    }
  }, [user?.id, mode, periodIdParam, applySelectiveDataPersistence]);

  useEffect(() => {
    if (user) {
      console.log('useEffect triggered - user:', user?.id, 'mode:', mode, 'periodId:', periodIdParam);
      fetchCurrentPeriod();
    }
  }, [user, fetchCurrentPeriod]);

  // Automatic backup system - every 3 minutes if there are unsaved changes
  useEffect(() => {
    if (!currentPeriod?.id) return;

    const autoBackupInterval = setInterval(async () => {
      if (hasUnsavedChanges && formData) {
        console.log('🔄 Creating automatic backup...');
        await createBackup(currentPeriod.id, formData, 'auto');
        setLastBackupTime(new Date());
        console.log('✅ Automatic backup created');
      }
    }, 3 * 60 * 1000); // 3 minutes

    return () => clearInterval(autoBackupInterval);
  }, [currentPeriod?.id, hasUnsavedChanges, formData, createBackup]);

  // Handle browser navigation warning
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Block navigation if there are unsaved changes
  useEffect(() => {
    const handleNavigation = (e: PopStateEvent) => {
      if (hasUnsavedChanges) {
        const confirmLeave = window.confirm(
          "You have unsaved changes. Are you sure you want to leave this page?"
        );
        if (!confirmLeave) {
          e.preventDefault();
          window.history.pushState(null, "", window.location.href);
        }
      }
    };

    if (hasUnsavedChanges) {
      window.history.pushState(null, "", window.location.href);
      window.addEventListener('popstate', handleNavigation);
    }

    return () => {
      window.removeEventListener('popstate', handleNavigation);
    };
  }, [hasUnsavedChanges]);

  // Calculate total lead source spend
  const totalLeadSourceSpend = formData.marketing.leadSources.reduce((total, source) => total + (source.spend || 0), 0);
  // Compute new revenue/commission totals (computed only, not stored)
  const { totalRevenueFromLeadSources, totalEstimatedCommission } = computeTotals(formData.marketing.leadSources as any);



  const updateFormData = (section: keyof FormData, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
    setHasUnsavedChanges(true);
  };


  const addLeadSource = () => {
    setFormData(prev => ({
      ...prev,
      marketing: {
        ...prev.marketing,
        leadSources: [...prev.marketing.leadSources, { name: '', spend: 0 }]
      }
    }));
    setHasUnsavedChanges(true);
  };

  const removeLeadSource = (index: number) => {
    setFormData(prev => ({
      ...prev,
      marketing: {
        ...prev.marketing,
        leadSources: prev.marketing.leadSources.filter((_, i) => i !== index)
      }
    }));
    setHasUnsavedChanges(true);
  };

  const addTeamMember = () => {
    setFormData(prev => ({
      ...prev,
      operations: {
        ...prev.operations,
        teamRoster: [...prev.operations.teamRoster, { name: '', role: 'Sales' }]
      }
    }));
    setHasUnsavedChanges(true);
  };

  const removeTeamMember = (index: number) => {
    setFormData(prev => ({
      ...prev,
      operations: {
        ...prev.operations,
        teamRoster: prev.operations.teamRoster.filter((_, i) => i !== index)
      }
    }));
    setHasUnsavedChanges(true);
  };

  const calculateNetProfit = () => {
    const netProfit = formData.cashFlow.compensation - formData.cashFlow.expenses;
    updateFormData('cashFlow', 'netProfit', Math.round(netProfit * 100) / 100);
  };

  useEffect(() => {
    calculateNetProfit();
  }, [formData.cashFlow.compensation, formData.cashFlow.expenses]);

  // Check which sections are incomplete
  const checkIncompleteSections = () => {
    const incomplete: string[] = [];
    
    if (!formData.sales.premium && !formData.sales.policies) {
      incomplete.push('Sales');
    }
    if (!formData.marketing.totalSpend && formData.marketing.leadSources.length === 0) {
      incomplete.push('Marketing');
    }
    if (!formData.operations.currentAlrTotal && formData.operations.teamRoster.length === 0) {
      incomplete.push('Bonus/Ops');
    }
    if (!formData.retention.numberTerminated && !formData.retention.currentRetentionPercent) {
      incomplete.push('Retention');
    }
    if (!formData.cashFlow.compensation && !formData.cashFlow.expenses) {
      incomplete.push('Cash Flow');
    }
    if (!formData.qualitative.biggestStress && !formData.qualitative.gutAction) {
      incomplete.push('Current Reality');
    }
    
    return incomplete;
  };

  // Save progress without validation - just saves and stays on form
  const saveProgress = async () => {
    setSaving(true);
    setSaveStatus('saving');

    // Create pre-save backup
    if (currentPeriod?.id) {
      await createBackup(currentPeriod.id, formData, 'pre_save');
    }

    // Create period if it doesn't exist
    let periodToUse = currentPeriod;
    if (!periodToUse) {
      try {
        const startDateForPeriod = startDate || new Date();
        const endDateForPeriod = endDate || new Date();

        const { data: newPeriod, error: createError } = await supa
          .from('periods')
          .insert({
            user_id: user?.id,
            title: `Period ${endDateForPeriod.toLocaleDateString()}`,
            start_date: startDateForPeriod.toISOString().split('T')[0],
            end_date: endDateForPeriod.toISOString().split('T')[0],
            status: 'draft',
            form_data: null
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating period:', createError);
          toast({
            title: "Error",
            description: "Failed to create period. Please try again.",
            variant: "destructive",
          });
          setSaving(false);
          setSaveStatus('error');
          return;
        }

        periodToUse = newPeriod;
        setCurrentPeriod(newPeriod);
      } catch (error) {
        console.error('Error creating period:', error);
        toast({
          title: "Error",
          description: "Failed to create period. Please try again.",
          variant: "destructive",
        });
        setSaving(false);
        setSaveStatus('error');
        return;
      }
    }

    // Use universal data protection for saving
    const additionalFields = {
      id: periodToUse.id,
      title: periodToUse.title || `Period ${new Date().toLocaleDateString()}`,
      start_date: startDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      end_date: endDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      status: 'draft'
    };

    const success = await dataProtection.saveWithProtection(additionalFields);
    
    if (success) {
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      setLastSaved(new Date());
      setLastBackupTime(new Date());
      toast({
        title: "Progress Saved",
        description: "Your form progress has been saved successfully.",
      });
    } else {
      setSaveStatus('error');
    }

    setSaving(false);
  };

  // Submit completed form with validation
  const submitCompletedForm = async () => {
    const incomplete = checkIncompleteSections();
    
    if (incomplete.length > 0) {
      setIncompleteSections(incomplete);
      setShowIncompleteWarning(true);
      return;
    }
    
    // If complete, proceed with save and navigation
    await saveForm();
  };

  const saveForm = async () => {
    setSaving(true);
    setSaveStatus('saving');

    // Create pre-save backup
    if (currentPeriod?.id) {
      await createBackup(currentPeriod.id, formData, 'pre_save');
    }

    // Create period if it doesn't exist
    let periodToUse = currentPeriod;
    if (!periodToUse) {
      try {
        const startDateForPeriod = startDate || new Date();
        const endDateForPeriod = endDate || new Date();

        const { data: newPeriod, error: createError } = await supa
          .from('periods')
          .insert({
            user_id: user?.id,
            title: `Period ${endDateForPeriod.toLocaleDateString()}`,
            start_date: startDateForPeriod.toISOString().split('T')[0],
            end_date: endDateForPeriod.toISOString().split('T')[0],
            status: 'draft',
            form_data: null
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating period:', createError);
          toast({
            title: "Error",
            description: "Failed to create period. Please try again.",
            variant: "destructive",
          });
          setSaving(false);
          setSaveStatus('error');
          return;
        }

        periodToUse = newPeriod;
        setCurrentPeriod(newPeriod);
      } catch (error) {
        console.error('Error creating period:', error);
        toast({
          title: "Error",
          description: "Failed to create period. Please try again.",
          variant: "destructive",
        });
        setSaving(false);
        setSaveStatus('error');
        return;
      }
    }

    // Use universal data protection for saving
    const additionalFields = {
      id: periodToUse.id,
      title: periodToUse.title || `Period ${new Date().toLocaleDateString()}`,
      start_date: startDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      end_date: endDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      status: 'active'
    };

    const success = await dataProtection.saveWithProtection(additionalFields);
    
    if (success) {
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      setLastSaved(new Date());
      setLastBackupTime(new Date());
      // Redirect to upload selection page
      navigate('/uploads/select');
    } else {
      setSaveStatus('error');
    }

    setSaving(false);
  };

  // Shared section components for Tabs (desktop) and Accordion (mobile)
  const SalesSection = () => (
    <Card className="glass-surface elevate rounded-2xl">
      <CardHeader>
        <CardTitle>Sales Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="premium">Premium ($)</Label>
            <Input
              id="premium"
              type="number"
              step="0.01"
              value={formData.sales.premium || ''}
              onChange={(e) => updateFormData('sales', 'premium', parseFloat(e.target.value) || 0)}
              placeholder=""
            />
          </div>
          <div>
            <Label htmlFor="items">Items</Label>
            <Input
              id="items"
              type="number"
              value={formData.sales.items || ''}
              onChange={(e) => updateFormData('sales', 'items', parseInt(e.target.value) || 0)}
              placeholder=""
            />
          </div>
          <div>
            <Label htmlFor="policies">Policies</Label>
            <Input
              id="policies"
              type="number"
              value={formData.sales.policies || ''}
              onChange={(e) => updateFormData('sales', 'policies', parseInt(e.target.value) || 0)}
              placeholder=""
            />
          </div>
        </div>
        <div className="mt-6">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="achievedVC"
              checked={formData.sales.achievedVC || false}
              onChange={(e) => updateFormData('sales', 'achievedVC', e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="achievedVC">Did you achieve VC this past month?</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const MarketingSection = () => (
    <Card className="glass-surface elevate rounded-2xl">
      <CardHeader>
        <CardTitle>Marketing Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="policiesQuoted"># of Policies Quoted</Label>
          <Input
            id="policiesQuoted"
            type="number"
            value={formData.marketing.policiesQuoted || ''}
            onChange={(e) => updateFormData('marketing', 'policiesQuoted', parseInt(e.target.value) || 0)}
            placeholder=""
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Lead Sources</Label>
            <Button type="button" variant="glass" size="sm" onClick={addLeadSource} className="rounded-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </Button>
          </div>
          {formData.marketing.leadSources.map((source, index) => (
            <div key={index} className="mb-3 rounded-xl border p-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    placeholder="Source name"
                    value={source.name}
                    onChange={(e) => {
                      const newSources = [...formData.marketing.leadSources];
                      newSources[index].name = e.target.value;
                      updateFormData('marketing', 'leadSources', newSources);
                      const totalSpend = newSources.reduce((sum, source) => sum + (source.spend || 0), 0);
                      updateFormData('marketing', 'totalSpend', totalSpend);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Spend ($)"
                    value={source.spend || ''}
                    onChange={(e) => {
                      const newSources = [...formData.marketing.leadSources];
                      newSources[index].spend = parseFloat(e.target.value) || 0;
                      updateFormData('marketing', 'leadSources', newSources);
                      const totalSpend = newSources.reduce((sum, source) => sum + (source.spend || 0), 0);
                      updateFormData('marketing', 'totalSpend', totalSpend);
                    }}
                  />
                </div>
                <Button type="button" variant="destructive" size="sm" onClick={() => removeLeadSource(index)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {enableSoldAndCommission && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Sold from {source.name || 'source'} ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={typeof source.soldPremium === 'number' ? source.soldPremium : ''}
                      onChange={(e) => {
                        const newSources = [...formData.marketing.leadSources];
                        newSources[index].soldPremium = parseFloat(e.target.value) || 0;
                        updateFormData('marketing', 'leadSources', newSources);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Commission Avg (%)</Label>
                    <PercentInput
                      value={source.commissionRate}
                      onChange={(normalized) => {
                        const newSources = [...formData.marketing.leadSources];
                        newSources[index].commissionRate = normalized;
                        updateFormData('marketing', 'leadSources', newSources);
                      }}
                      placeholder="e.g., 12"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Enter as percent (12 = 12%)</p>
                  </div>
                  <div className="flex flex-col justify-end">
                    <Label className="text-xs">Est. Commission ($)</Label>
                    <Input readOnly className="bg-muted font-semibold" value={computeEstimatedCommissionPerRow(source as any).toFixed(2)} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div>
            <Label htmlFor="leadSourceTotal">Lead Sources Total ($)</Label>
            <Input id="leadSourceTotal" type="number" step="0.01" value={totalLeadSourceSpend.toFixed(2)} className="bg-muted font-semibold" readOnly placeholder="0.00" />
          </div>
          <div>
            <Label htmlFor="totalSpend">Total Spend ($)</Label>
            <Input id="totalSpend" type="number" step="0.01" value={formData.marketing.totalSpend || ''} className="bg-muted" readOnly placeholder="" />
          </div>
          {enableSoldAndCommission && (
            <>
              <div>
                <Label htmlFor="totalRevenueFromLeadSources">Total Written Premium From Lead Sources ($)</Label>
                <Input id="totalRevenueFromLeadSources" type="number" step="0.01" value={(totalRevenueFromLeadSources || 0).toFixed(2)} className="bg-muted font-semibold" readOnly placeholder="0.00" />
              </div>
              <div>
                <Label htmlFor="totalEstimatedCommission">Total Estimated Commission ($)</Label>
                <Input id="totalEstimatedCommission" type="number" step="0.01" value={(totalEstimatedCommission || 0).toFixed(2)} className="bg-muted font-semibold" readOnly placeholder="0.00" />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const OperationsSection = () => (
    <Card className="glass-surface elevate rounded-2xl">
      <CardHeader>
        <CardTitle>Bonus/Ops Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="currentAlrTotal">Current ALR Total YTD ($)</Label>
          <Input
            id="currentAlrTotal"
            type="number"
            step="0.01"
            value={formData.operations.currentAlrTotal || ''}
            onChange={(e) => updateFormData('operations', 'currentAlrTotal', parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="currentAapProjection">Current AAP Projection</Label>
          <Select value={formData.operations.currentAapProjection} onValueChange={(value) => updateFormData('operations', 'currentAapProjection', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select AAP level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Emerging">Emerging</SelectItem>
              <SelectItem value="Pro">Pro</SelectItem>
              <SelectItem value="Elite">Elite</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="currentBonusTrend">Current Bonus Trend #</Label>
          <Input
            id="currentBonusTrend"
            type="number"
            value={formData.operations.currentBonusTrend || ''}
            onChange={(e) => updateFormData('operations', 'currentBonusTrend', parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Team Roster</Label>
            <Button type="button" variant="glass" size="sm" onClick={addTeamMember} className="rounded-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </div>
          {formData.operations.teamRoster.map((member, index) => (
            <div key={index} className="flex gap-2 items-end mb-2">
              <div className="flex-1">
                <Input
                  placeholder="Name"
                  value={member.name}
                  onChange={(e) => {
                    const newRoster = [...formData.operations.teamRoster];
                    newRoster[index].name = e.target.value;
                    updateFormData('operations', 'teamRoster', newRoster);
                  }}
                />
              </div>
              <div className="flex-1">
                <Select
                  value={member.role}
                  onValueChange={(value) => {
                    const newRoster = [...formData.operations.teamRoster];
                    newRoster[index].role = value;
                    updateFormData('operations', 'teamRoster', newRoster);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Service">Service</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="destructive" size="sm" onClick={() => removeTeamMember(index)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const RetentionSection = () => (
    <Card>
      <CardHeader>
        <CardTitle>Retention Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="numberTerminated">Number of Policies Terminated</Label>
          <Input
            id="numberTerminated"
            type="number"
            value={formData.retention.numberTerminated || ''}
            onChange={(e) => updateFormData('retention', 'numberTerminated', parseInt(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="currentRetentionPercent">Current Retention %</Label>
          <Input
            id="currentRetentionPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.retention.currentRetentionPercent || ''}
            onChange={(e) => updateFormData('retention', 'currentRetentionPercent', parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
      </CardContent>
    </Card>
  );

  const CashFlowSection = () => (
    <Card className="glass-surface elevate rounded-2xl">
      <CardHeader>
        <CardTitle>Cash Flow Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="compensation">Compensation ($)</Label>
            <Input
              id="compensation"
              type="number"
              step="0.01"
              value={formData.cashFlow.compensation || ''}
              onChange={(e) => updateFormData('cashFlow', 'compensation', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="expenses">Expenses ($)</Label>
            <Input
              id="expenses"
              type="number"
              step="0.01"
              value={formData.cashFlow.expenses || ''}
              onChange={(e) => updateFormData('cashFlow', 'expenses', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="netProfit">Net Profit ($)</Label>
            <Input
              id="netProfit"
              type="number"
              step="0.01"
              value={formData.cashFlow.netProfit || ''}
              onChange={(e) => updateFormData('cashFlow', 'netProfit', parseFloat(e.target.value) || 0)}
              className="bg-muted"
              placeholder="0"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const QualitativeSection = () => (
    <Card className="glass-surface elevate rounded-2xl">
      <CardHeader>
        <CardTitle>Current Reality</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="biggestStress">Biggest Stress</Label>
          <Textarea
            id="biggestStress"
            value={formData.qualitative.biggestStress}
            onChange={(e) => updateFormData('qualitative', 'biggestStress', e.target.value)}
            rows={3}
            placeholder="Describe your biggest stress..."
          />
        </div>
        <div>
          <Label htmlFor="gutAction">Gut Action You Feel You Should Take On That Stress</Label>
          <Textarea
            id="gutAction"
            value={formData.qualitative.gutAction}
            onChange={(e) => updateFormData('qualitative', 'gutAction', e.target.value)}
            rows={3}
            placeholder="What action do you feel you should take..."
          />
        </div>
        <div>
          <Label htmlFor="biggestPersonalWin">Biggest Personal Win</Label>
          <Textarea
            id="biggestPersonalWin"
            value={formData.qualitative.biggestPersonalWin}
            onChange={(e) => updateFormData('qualitative', 'biggestPersonalWin', e.target.value)}
            rows={3}
            placeholder="Describe your biggest personal win..."
          />
        </div>
        <div>
          <Label htmlFor="biggestBusinessWin">Biggest Business Win</Label>
          <Textarea
            id="biggestBusinessWin"
            value={formData.qualitative.biggestBusinessWin}
            onChange={(e) => updateFormData('qualitative', 'biggestBusinessWin', e.target.value)}
            rows={3}
            placeholder="Describe your biggest business win..."
          />
        </div>
        <div className="mt-6">
          <Label className="text-lg font-semibold">Here are 3 things I want to attack on this months call:</Label>
          <div className="space-y-3 mt-3">
            <div>
              <Label htmlFor="attackItem1">1.</Label>
              <Textarea
                id="attackItem1"
                value={formData.qualitative.attackItems.item1}
                onChange={(e) => {
                  const newAttackItems = { ...formData.qualitative.attackItems, item1: e.target.value };
                  updateFormData('qualitative', 'attackItems', newAttackItems);
                }}
                rows={2}
                placeholder="First thing to attack..."
              />
            </div>
            <div>
              <Label htmlFor="attackItem2">2.</Label>
              <Textarea
                id="attackItem2"
                value={formData.qualitative.attackItems.item2}
                onChange={(e) => {
                  const newAttackItems = { ...formData.qualitative.attackItems, item2: e.target.value };
                  updateFormData('qualitative', 'attackItems', newAttackItems);
                }}
                rows={2}
                placeholder="Second thing to attack..."
              />
            </div>
            <div>
              <Label htmlFor="attackItem3">3.</Label>
              <Textarea
                id="attackItem3"
                value={formData.qualitative.attackItems.item3}
                onChange={(e) => {
                  const newAttackItems = { ...formData.qualitative.attackItems, item3: e.target.value };
                  updateFormData('qualitative', 'attackItems', newAttackItems);
                }}
                rows={2}
                placeholder="Third thing to attack..."
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ✅ CHECKPOINT: WORKING STATE - Forms & Dashboard Perfect - Data persistence fixed
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only show "No Active Period" error if we're NOT in new mode
  if (!currentPeriod && mode !== 'new') {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="glass-surface elevate rounded-2xl">
            <CardHeader>
              <CardTitle>No Active Period</CardTitle>
              <CardDescription>
                You need to create a reporting period before you can submit data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Link to="/dashboard">
                  <Button variant="glass" className="rounded-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </Button>
                </Link>
                <Link to="/submit?mode=new">
                  <Button variant="glass" className="rounded-full">
                    Start New Period
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 font-inter">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link to="/dashboard">
              <Button variant="glass" size="sm" className="rounded-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl font-bold mt-4">Meeting Form</h1>
            <p className="text-muted-foreground mb-4">Submit to update Dashboard</p>
            
            {/* Editable Period Dates */}
            <div className="flex flex-col md:flex-row gap-4 md:items-center">
              <div className="flex flex-col">
                <Label className="mb-2">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="glass"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex flex-col">
                <Label className="mb-2">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="glass"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <SaveStatusIndicator 
              status={saveStatus} 
              lastSaved={lastSaved} 
              hasUnsavedChanges={hasUnsavedChanges} 
            />
          </div>
          <div className="flex gap-2">
            <Button 
              variant="glass" 
              size="sm" 
              onClick={() => setShowDataProtection(!showDataProtection)}
              className="rounded-full"
            >
              <Shield className="w-4 h-4 mr-2" />
              Data Protection
            </Button>
            <Button variant="outline" className="rounded-full" onClick={saveProgress} disabled={saving}>
              {saving ? 'Saving...' : 'Save Progress'}
            </Button>
            <Button variant="gradient-glow" className="rounded-full" onClick={submitCompletedForm} disabled={saving}>
              {saving ? 'Saving...' : 'Submit Completed Form'}
            </Button>
          </div>
        </div>

        {/* Conflict Warning */}
        <ConflictWarningAlert otherDevices={conflictInfo.otherDevices} />

        {/* Data Protection Panel */}
        {showDataProtection && (
          <div className="mb-6">
            <UniversalDataProtectionPanel
              status={dataProtection.status}
              backups={dataProtection.getBackups()}
              onCreateBackup={() => dataProtection.createBackup()}
              onExportData={() => dataProtection.exportData()}
              onImportData={() => dataProtection.importData()}
              onRestoreBackup={(timestamp) => dataProtection.restoreBackup(timestamp)}
              onToggleAutoBackup={() => dataProtection.toggleAutoBackup()}
              onValidateData={() => dataProtection.validateData()}
              validationResult={dataProtection.validateData()}
            />
          </div>
        )}

        {/* Mobile Accordion */}
        <div className="md:hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="sales">
              <AccordionTrigger>Sales</AccordionTrigger>
              <AccordionContent>
                {SalesSection()}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="marketing">
              <AccordionTrigger>Marketing</AccordionTrigger>
              <AccordionContent>
                {MarketingSection()}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="operations">
              <AccordionTrigger>Bonus/Ops</AccordionTrigger>
              <AccordionContent>
                {OperationsSection()}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="retention">
              <AccordionTrigger>Retention</AccordionTrigger>
              <AccordionContent>
                {RetentionSection()}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="cashflow">
              <AccordionTrigger>Cash Flow</AccordionTrigger>
              <AccordionContent>
                {CashFlowSection()}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="qualitative">
              <AccordionTrigger>Current Reality</AccordionTrigger>
              <AccordionContent>
                {QualitativeSection()}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="hidden md:block">
          <Tabs defaultValue="sales" className="space-y-6">
          <TabsList className="w-full glass-surface rounded-full p-1 overflow-x-auto whitespace-nowrap flex md:grid md:grid-cols-6 gap-1">
            <TabsTrigger className="text-sm md:text-base shrink-0" value="sales">Sales</TabsTrigger>
            <TabsTrigger className="text-sm md:text-base shrink-0" value="marketing">Marketing</TabsTrigger>
            <TabsTrigger className="text-sm md:text-base shrink-0" value="operations">Bonus/Ops</TabsTrigger>
            <TabsTrigger className="text-sm md:text-base shrink-0" value="retention">Retention</TabsTrigger>
            <TabsTrigger className="text-sm md:text-base shrink-0" value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger className="text-sm md:text-base shrink-0" value="qualitative">Current Reality</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            {SalesSection()}
          </TabsContent>

          <TabsContent value="marketing">
            {MarketingSection()}
          </TabsContent>

          <TabsContent value="operations">
            {OperationsSection()}
          </TabsContent>

          <TabsContent value="retention">
            {RetentionSection()}
          </TabsContent>

          <TabsContent value="cashflow">
            {CashFlowSection()}
          </TabsContent>

          <TabsContent value="qualitative">
            {QualitativeSection()}
          </TabsContent>
        </Tabs>
        </div>
      </div>

      {/* Sticky Save Bar (mobile) */}
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
        <div className="container mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <SaveStatusIndicator 
              status={saveStatus} 
              lastSaved={lastSaved} 
              hasUnsavedChanges={hasUnsavedChanges} 
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveProgress} disabled={saving} className="rounded-full flex-1" size="sm">
              {saving ? "Saving..." : "Save Progress"}
            </Button>
            <Button variant="gradient-glow" onClick={submitCompletedForm} disabled={saving} className="rounded-full flex-1" size="sm">
              {saving ? "Saving..." : "Submit"}
            </Button>
          </div>
        </div>
      </div>

      {/* Exit Warning Dialog */}
      <AlertDialog open={showExitWarning} onOpenChange={setShowExitWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost if you leave. Remember to save your progress to keep your data!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowExitWarning(false)}>
              Stay and Save
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setHasUnsavedChanges(false);
                setShowExitWarning(false);
                navigate('/dashboard');
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Leave Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Incomplete Form Warning Dialog */}
      <AlertDialog open={showIncompleteWarning} onOpenChange={setShowIncompleteWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Incomplete Form</AlertDialogTitle>
            <AlertDialogDescription>
              The following sections are missing data:
              <ul className="mt-3 space-y-1">
                {incompleteSections.map((section) => (
                  <li key={section} className="text-destructive font-semibold">
                    • {section}
                  </li>
                ))}
              </ul>
              <p className="mt-3">Would you like to go back and complete these sections, or submit anyway?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowIncompleteWarning(false)}>
              Go Back & Complete
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                setShowIncompleteWarning(false);
                await saveForm();
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Submit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}