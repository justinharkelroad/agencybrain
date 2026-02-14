import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, differenceInDays, eachMonthOfInterval } from 'date-fns';
import { CalendarIcon, Users, Plus, History, Image, FileText, Trash2, Save, Shield, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { getMetricValue } from '@/lib/kpiKeyMapping';
import { MonthlyCalendarHeatmap } from './MonthlyCalendarHeatmap';
import { CallLogUploadSection, CallLogData } from './CallLogUploadSection';
import { QuotedDetailsUploadSection, QuotedData } from './QuotedDetailsUploadSection';
import { SoldDetailsUploadSection, SoldData } from './SoldDetailsUploadSection';
import { CallScoringSubmissionsSection, CallScoringData } from './CallScoringSubmissionsSection';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Json } from '@/integrations/supabase/types';
import { fetchWithAuth } from '@/lib/staffRequest';
import { useAgencyKpisWithConfig } from '@/hooks/useAgencyKpisWithConfig';
import { useUniversalDataProtection } from '@/hooks/useUniversalDataProtection';
import { UniversalDataProtectionService } from '@/lib/universalDataProtection';
import { enableMeetingFrameModeAware } from '@/lib/featureFlags';
import { useFeatureAccess, FeatureKeys } from '@/hooks/useFeatureAccess';

interface MeetingFrameTabProps {
  agencyId: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

interface KPI {
  id: string;
  key: string;
  label: string;
  type: string;
}

interface KPITotal {
  kpi_id: string;
  key: string;
  label: string;
  total: number;
  type: string;
}

interface MeetingFrame {
  id: string;
  agency_id: string;
  team_member_id: string;
  created_by: string;
  start_date: string;
  end_date: string;
  kpi_totals: Json;
  call_log_data: Json;
  quoted_data: Json;
  sold_data: Json;
  call_scoring_data: Json;
  meeting_notes: string | null;
  created_at: string;
  team_members?: {
    name: string;
    role: string;
  };
}

// Combined form data for data protection
interface MeetingFrameFormData {
  selectedMember: string;
  startDate: string | null;
  endDate: string | null;
  kpiTotals: KPITotal[];
  callLogData: CallLogData | null;
  quotedData: QuotedData | null;
  soldData: SoldData | null;
  callScoringData: CallScoringData[];
  meetingNotes: string;
  reportGenerated: boolean;
}

const FORM_TYPE = 'meeting_frame' as const;

export function MeetingFrameTab({ agencyId }: MeetingFrameTabProps) {
  // Detect staff mode
  const staffToken = localStorage.getItem('staff_session_token');
  const isStaffMode = !!staffToken;

  // Helper function for staff edge function calls - uses fetchWithAuth to avoid JWT collision
  const invokeWithStaff = async (action: string, params: Record<string, unknown> = {}) => {
    const response = await fetchWithAuth('scorecards_admin', {
      method: 'POST',
      body: { action, ...params },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Request failed');
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const invokeAdminAction = async (action: string, params: Record<string, unknown> = {}) => {
    const response = await fetchWithAuth('scorecards_admin', {
      method: 'POST',
      prefer: isStaffMode ? 'staff' : 'supabase',
      body: { action, ...params },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Request failed');
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [kpiTotals, setKpiTotals] = useState<KPITotal[]>([]);

  // Derive selected member's role for role-aware KPI filtering
  const selectedMemberRole = useMemo(() => {
    const member = teamMembers.find(m => m.id === selectedMember);
    return member?.role || undefined;
  }, [teamMembers, selectedMember]);

  // Use the unified hook to get role-filtered KPIs with config
  const {
    data: kpiConfig,
    isLoading: kpiConfigLoading,
  } = useAgencyKpisWithConfig(agencyId, selectedMemberRole, {
    enabled: !!selectedMember && !!selectedMemberRole,
  });

  // Get the KPIs to display - use enabledKpis if configured, fallback to all role KPIs
  const displayKpis: KPI[] = useMemo(() => {
    if (!kpiConfig) return [];
    // If scorecard_rules configured with selected_metrics: use filtered KPIs
    // If NO scorecard_rules or empty selected_metrics: fall back to ALL role-appropriate KPIs
    return (kpiConfig.enabledKpis?.length > 0)
      ? kpiConfig.enabledKpis.map(k => ({
          id: k.id,
          key: k.key,
          label: k.label,
          type: k.type,
        }))
      : kpiConfig.kpis.map(k => ({
          id: k.id,
          key: k.key,
          label: k.label,
          type: k.type,
        }));
  }, [kpiConfig]);
  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [callLogData, setCallLogData] = useState<CallLogData | null>(null);
  const [quotedData, setQuotedData] = useState<QuotedData | null>(null);
  const [soldData, setSoldData] = useState<SoldData | null>(null);
  const [callScoringData, setCallScoringData] = useState<CallScoringData[]>([]);
  
  // Phase 6: New state
  const [viewMode, setViewMode] = useState<'new' | 'history'>('new');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [meetingFrameHistory, setMeetingFrameHistory] = useState<MeetingFrame[]>([]);
  const [viewingHistoricalFrame, setViewingHistoricalFrame] = useState<string | null>(null);
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const recoveryCheckedRef = useRef(false);
  const { data: callScoringQaFeature } = useFeatureAccess(FeatureKeys.CALL_SCORING_QA);

  // Combine all form data for data protection
  const formData: MeetingFrameFormData = useMemo(() => ({
    selectedMember,
    startDate: startDate ? startDate.toISOString() : null,
    endDate: endDate ? endDate.toISOString() : null,
    kpiTotals,
    callLogData,
    quotedData,
    soldData,
    callScoringData,
    meetingNotes,
    reportGenerated,
  }), [selectedMember, startDate, endDate, kpiTotals, callLogData, quotedData, soldData, callScoringData, meetingNotes, reportGenerated]);

  // Restore form data from backup
  const restoreFormData = useCallback((data: MeetingFrameFormData) => {
    setSelectedMember(data.selectedMember || '');
    setStartDate(data.startDate ? new Date(data.startDate) : undefined);
    setEndDate(data.endDate ? new Date(data.endDate) : undefined);
    setKpiTotals(data.kpiTotals || []);
    setCallLogData(data.callLogData || null);
    setQuotedData(data.quotedData || null);
    setSoldData(data.soldData || null);
    setCallScoringData(data.callScoringData || []);
    setMeetingNotes(data.meetingNotes || '');
    setReportGenerated(data.reportGenerated || false);
    setHasUnsavedChanges(true);
  }, []);

  // Initialize data protection
  const dataProtection = useUniversalDataProtection<MeetingFrameFormData>({
    formData,
    formType: FORM_TYPE,
    autoBackupEnabled: true,
    autoBackupInterval: 30,
    onDataRestored: restoreFormData,
  });

  // Check for existing backup on mount
  useEffect(() => {
    if (recoveryCheckedRef.current) return;
    recoveryCheckedRef.current = true;

    const backups = UniversalDataProtectionService.getBackupsFromStorage<MeetingFrameFormData>(FORM_TYPE);
    if (backups.length > 0) {
      const latestBackup = backups[0];
      // Only show recovery if there's meaningful data
      const hasData = latestBackup.formData.reportGenerated ||
                      latestBackup.formData.selectedMember ||
                      latestBackup.formData.meetingNotes;
      if (hasData) {
        setShowRecoveryBanner(true);
      }
    }
  }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && reportGenerated && !viewingHistoricalFrame) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, reportGenerated, viewingHistoricalFrame]);

  // Track changes
  useEffect(() => {
    if (reportGenerated && !viewingHistoricalFrame) {
      setHasUnsavedChanges(true);
    }
  }, [kpiTotals, callLogData, quotedData, soldData, callScoringData, meetingNotes, reportGenerated, viewingHistoricalFrame]);

  // Handle recovery
  const handleRecover = () => {
    const recovered = dataProtection.recoverFromLatestBackup();
    if (recovered) {
      setShowRecoveryBanner(false);
      toast.success('Your previous work has been recovered!');
    }
  };

  const handleDismissRecovery = () => {
    setShowRecoveryBanner(false);
  };

  // Fetch team members and meeting frame history on mount
  // KPIs are now fetched reactively via useAgencyKpisWithConfig when member is selected
  useEffect(() => {
    const fetchInitialData = async () => {
      if (isStaffMode) {
        // Staff mode: use edge function to get team members and history
        try {
          const result = await invokeWithStaff('meeting_frame_list');
          setTeamMembers(result.teamMembers || []);
          // KPIs will be fetched via useAgencyKpisWithConfig when member is selected
          setMeetingFrameHistory((result.history || []) as MeetingFrame[]);
        } catch (err) {
          console.error('Error fetching initial data via edge function:', err);
        }
      } else {
        // Owner mode: use direct Supabase queries
        const fetchTeamMembers = async () => {
          const { data, error } = await supabase
            .from('team_members')
            .select('id, name, role')
            .eq('agency_id', agencyId)
            .eq('status', 'active')
            .order('name');

          if (!error && data) {
            setTeamMembers(data);
          }
        };

        fetchTeamMembers();
        fetchMeetingFrameHistory();
      }
    };

    fetchInitialData();
  }, [agencyId, isStaffMode]);

  const fetchMeetingFrameHistory = async () => {
    if (isStaffMode) {
      // Staff mode: refetch via edge function
      try {
        const result = await invokeWithStaff('meeting_frame_list');
        setMeetingFrameHistory((result.history || []) as MeetingFrame[]);
      } catch (err) {
        console.error('Error fetching history via edge function:', err);
      }
      return;
    }
    
    // Owner mode: direct query
    const { data, error } = await supabase
      .from('meeting_frames')
      .select(`
        *,
        team_members (name, role)
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setMeetingFrameHistory(data as MeetingFrame[]);
    }
  };

  const validateDateRange = (): boolean => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return false;
    }
    
    const days = differenceInDays(endDate, startDate);
    if (days < 0) {
      toast.error('End date must be after start date');
      return false;
    }
    if (days > 60) {
      toast.error('Date range cannot exceed 60 days');
      return false;
    }
    
    return true;
  };

  const generateReport = async () => {
    if (!selectedMember) {
      toast.error('Please select a team member');
      return;
    }

    if (!validateDateRange()) return;

    setLoading(true);
    setViewingHistoricalFrame(null);
    try {
      const startStr = format(startDate!, 'yyyy-MM-dd');
      const endStr = format(endDate!, 'yyyy-MM-dd');

      let metricsData: Record<string, unknown>[];
      let submittedFormKpiKeys: Set<string> | null = null;

      if (isStaffMode) {
        // Staff mode: use edge function
        const result = await invokeWithStaff('meeting_frame_generate', {
          team_member_id: selectedMember,
          start_date: startStr,
          end_date: endStr,
        });
        metricsData = result.metricsData || [];
        // Edge function returns submittedKpiKeys for Hybrid users
        if (result.submittedKpiKeys) {
          submittedFormKpiKeys = new Set(result.submittedKpiKeys);
        }
      } else {
        // Owner mode: direct Supabase query
        const { data, error: metricsError } = await supabase
          .from('metrics_daily')
          .select('*')
          .eq('team_member_id', selectedMember)
          .gte('date', startStr)
          .lte('date', endStr);

        if (metricsError) {
          console.error('Error fetching metrics:', metricsError);
          throw metricsError;
        }
        metricsData = data || [];

        // For Hybrid users, get KPI keys from forms they actually submitted
        if (selectedMemberRole === 'Hybrid') {
          const { data: submissions } = await supabase
            .from('submissions')
            .select('form_template_id')
            .eq('team_member_id', selectedMember)
            .eq('final', true)
            .gte('work_date', startStr)
            .lte('work_date', endStr);

          if (submissions && submissions.length > 0) {
            const templateIds = [...new Set(submissions.map(s => s.form_template_id))];
            const { data: templates } = await supabase
              .from('form_templates')
              .select('schema_json')
              .in('id', templateIds);

            if (templates) {
              submittedFormKpiKeys = new Set<string>();
              templates.forEach(t => {
                const schema = t.schema_json as { kpis?: Array<{ key?: string; selectedKpiId?: string }> };
                if (schema?.kpis) {
                  schema.kpis.forEach(kpi => {
                    if (kpi.key) submittedFormKpiKeys!.add(kpi.key);
                  });
                }
              });
            }
          }
        }
      }

      // Filter displayKpis for Hybrid users to only show KPIs from submitted forms
      const kpisToShow = submittedFormKpiKeys && submittedFormKpiKeys.size > 0
        ? displayKpis.filter(kpi => submittedFormKpiKeys!.has(kpi.key))
        : displayKpis;

      // Aggregate KPI totals using getMetricValue for each KPI
      let totals: KPITotal[] = kpisToShow.map((kpi) => {
        let total = 0;
        metricsData.forEach((row) => {
          total += getMetricValue(row, kpi.key);
        });

        return {
          kpi_id: kpi.id,
          key: kpi.key,
          label: kpi.label,
          total,
          type: kpi.type,
        };
      });

      // Optional Phase 4 path: align Meeting Frame call fields to mode-aware logic.
      // Keep all other KPI/custom KPI totals sourced from metrics_daily to avoid regressions.
      if (enableMeetingFrameModeAware) {
        try {
          const modeAware = await invokeAdminAction('meeting_frame_mode_aware_call_totals', {
            team_member_id: selectedMember,
            start_date: startStr,
            end_date: endStr,
          });

          const modeAwareOutbound = Number(modeAware?.call_totals?.outbound_calls ?? 0);
          const modeAwareTalk = Number(modeAware?.call_totals?.talk_minutes ?? 0);

          totals = totals.map((kpi) => {
            if (kpi.key === 'outbound_calls') {
              return { ...kpi, total: modeAwareOutbound };
            }
            if (kpi.key === 'talk_minutes') {
              return { ...kpi, total: modeAwareTalk };
            }
            return kpi;
          });
        } catch (modeAwareError) {
          console.error('Meeting frame mode-aware call totals error:', modeAwareError);
        }
      }

      // Show KPIs from submitted forms (filtered for Hybrid, all for other roles)
      setKpiTotals(totals);
      setReportGenerated(true);
      // Reset upload data for new report
      setCallLogData(null);
      setQuotedData(null);
      setSoldData(null);
      setCallScoringData([]);
      setMeetingNotes('');
      toast.success('Report generated!');
    } catch (err) {
      console.error('Error generating report:', err);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMeetingFrame = async () => {
    if (!selectedMember || !startDate || !endDate) {
      toast.error('Please generate a report first');
      return;
    }

    setSaving(true);
    try {
      if (isStaffMode) {
        // Staff mode: use edge function
        await invokeWithStaff('meeting_frame_create', {
          team_member_id: selectedMember,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          kpi_totals: kpiTotals,
          call_log_data: callLogData || {},
          quoted_data: quotedData || {},
          sold_data: soldData || {},
          call_scoring_data: callScoringData || [],
          meeting_notes: meetingNotes || null,
        });
      } else {
        // Owner mode: direct Supabase insert
        const { data: userData } = await supabase.auth.getUser();

        const meetingFrameData = {
          agency_id: agencyId,
          team_member_id: selectedMember,
          created_by: userData.user?.id,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          kpi_totals: kpiTotals as unknown as Json,
          call_log_data: (callLogData || {}) as unknown as Json,
          quoted_data: (quotedData || {}) as unknown as Json,
          sold_data: (soldData || {}) as unknown as Json,
          call_scoring_data: (callScoringData || []) as unknown as Json,
          meeting_notes: meetingNotes || null,
        };

        const { error } = await supabase
          .from('meeting_frames')
          .insert(meetingFrameData);

        if (error) throw error;
      }

      toast.success('Meeting frame saved successfully!');
      setHasUnsavedChanges(false);
      fetchMeetingFrameHistory();
    } catch (err) {
      console.error('Error saving meeting frame:', err);
      toast.error('Failed to save meeting frame');
    } finally {
      setSaving(false);
    }
  };

  const handleViewHistoricalFrame = (frame: MeetingFrame) => {
    setViewMode('new');
    setSelectedMember(frame.team_member_id);
    // Parse dates with time component to ensure local timezone interpretation
    setStartDate(new Date(frame.start_date + 'T00:00:00'));
    setEndDate(new Date(frame.end_date + 'T00:00:00'));
    setKpiTotals((frame.kpi_totals as unknown as KPITotal[]) || []);
    setCallLogData((frame.call_log_data as unknown as CallLogData) || null);
    setQuotedData((frame.quoted_data as unknown as QuotedData) || null);
    setSoldData((frame.sold_data as unknown as SoldData) || null);
    setCallScoringData((frame.call_scoring_data as unknown as CallScoringData[]) || []);
    setMeetingNotes(frame.meeting_notes || '');
    setReportGenerated(true);
    setViewingHistoricalFrame(frame.id);
  };

  const handleDeleteFrame = async (frameId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this meeting frame?');
    if (!confirmed) return;

    try {
      if (isStaffMode) {
        // Staff mode: use edge function
        await invokeWithStaff('meeting_frame_delete', { frame_id: frameId });
      } else {
        // Owner mode: direct delete
        const { error } = await supabase
          .from('meeting_frames')
          .delete()
          .eq('id', frameId);

        if (error) throw error;
      }
      
      toast.success('Meeting frame deleted');
      fetchMeetingFrameHistory();
    } catch (err) {
      console.error('Error deleting frame:', err);
      toast.error('Failed to delete meeting frame');
    }
  };

  const handleExportPNG = async () => {
    if (!reportRef.current) return;

    try {
      toast.info('Generating PNG...');

      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#020817',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `meeting-frame-${selectedMemberName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success('PNG exported!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export PNG');
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;

    try {
      toast.info('Generating PDF...');

      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#020817',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`meeting-frame-${selectedMemberName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);

      toast.success('PDF exported!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export PDF');
    }
  };

  const resetForm = () => {
    setSelectedMember('');
    setStartDate(undefined);
    setEndDate(undefined);
    setKpiTotals([]);
    setCallLogData(null);
    setQuotedData(null);
    setSoldData(null);
    setCallScoringData([]);
    setMeetingNotes('');
    setReportGenerated(false);
    setViewingHistoricalFrame(null);
    setHasUnsavedChanges(false);
  };

  const selectedMemberName = teamMembers.find(m => m.id === selectedMember)?.name || '';

  const formatValue = (value: number, type: string) => {
    if (type === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
      }).format(value / 100);
    }
    if (type === 'percentage') {
      return `${value}%`;
    }
    return value.toLocaleString();
  };

  const getProgressColor = (index: number) => {
    const colors = ['hsl(var(--primary))', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)', 'hsl(187, 85%, 43%)'];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6">
      {/* Recovery Banner */}
      {showRecoveryBanner && (
        <Alert className="border-amber-500 bg-amber-500/10">
          <Shield className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-500">Unsaved Work Detected</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>We found unsaved data from a previous session. Would you like to recover it?</span>
            <div className="flex gap-2 ml-4">
              <Button size="sm" variant="outline" onClick={handleRecover}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Recover
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismissRecovery}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Header with toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Meeting Frame</h2>
          <p className="text-muted-foreground">
            Generate a comprehensive performance snapshot for 1:1 meetings
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Data source: Meeting Frame uses scorecard metrics storage. Call metrics can be aligned to mode-aware logic via feature flag rollout.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={viewMode === 'new' ? 'default' : 'outline'}
            onClick={() => { setViewMode('new'); resetForm(); }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Report
          </Button>
          <Button
            variant={viewMode === 'history' ? 'default' : 'outline'}
            onClick={() => setViewMode('history')}
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
        </div>
      </div>

      {/* History View */}
      {viewMode === 'history' && (
        <div className="space-y-4">
          {meetingFrameHistory.length === 0 ? (
            <Card className="p-12 text-center">
              <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2 text-foreground">No Meeting Frames Yet</h3>
              <p className="text-muted-foreground">
                Generate and save a meeting frame to see it here
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {meetingFrameHistory.map((frame) => (
                <Card
                  key={frame.id}
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleViewHistoricalFrame(frame)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-lg font-bold text-foreground">
                          {frame.team_members?.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{frame.team_members?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(frame.start_date + 'T00:00:00'), 'MMM d')} - {format(new Date(frame.end_date + 'T00:00:00'), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm hidden sm:block">
                        <p className="text-muted-foreground">Created</p>
                        <p className="text-foreground">{format(new Date(frame.created_at), 'MMM d, yyyy')}</p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewHistoricalFrame(frame);
                          }}
                        >
                          <Image className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFrame(frame.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Preview of key stats */}
                  {frame.kpi_totals && Array.isArray(frame.kpi_totals) && (frame.kpi_totals as unknown as KPITotal[]).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-4 text-sm">
                      {(frame.kpi_totals as unknown as KPITotal[]).slice(0, 4).map((kpi) => (
                        <div key={kpi.kpi_id} className="text-muted-foreground">
                          <span className="font-medium text-foreground">{formatValue(kpi.total, kpi.type)}</span>
                          {' '}{kpi.label}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Report View */}
      {viewMode === 'new' && (
        <>
          {/* Controls */}
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              {/* Team Member Select */}
              <div className="space-y-2">
                <Label>Team Member</Label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'MM/dd/yyyy') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'MM/dd/yyyy') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Generate Button */}
              <div className="space-y-2 md:col-span-2">
                <Label className="invisible">Action</Label>
                <Button
                  onClick={generateReport}
                  disabled={loading || (!!selectedMember && kpiConfigLoading)}
                  className="w-full"
                >
                  {loading ? 'Generating...' : kpiConfigLoading ? 'Loading KPIs...' : 'Generate Report'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Report Content */}
          {reportGenerated && (
            <div className="space-y-6">
              {/* Viewing historical frame banner */}
              {viewingHistoricalFrame && (
                <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-3 flex items-center justify-between">
                  <p className="text-amber-400 text-sm">
                    Viewing saved meeting frame from {format(startDate!, 'MMM d, yyyy')}
                  </p>
                  <Button variant="outline" size="sm" onClick={resetForm}>
                    Create New
                  </Button>
                </div>
              )}

              {/* Exportable Report Area */}
              <div ref={reportRef} id="meeting-frame-report" className="space-y-6">
                {/* Header with name and date range */}
                <div className="flex justify-between items-center bg-muted/50 p-4 rounded-lg">
                  <div className="text-xl font-bold text-foreground">
                    SALESPERSON: {selectedMemberName.toUpperCase()}
                  </div>
                  <div className="text-lg text-muted-foreground">
                    {format(startDate!, 'M/d/yy')} - {format(endDate!, 'M/d/yy')}
                  </div>
                </div>

                {/* KPI Rings */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {kpiTotals.map((kpi, index) => (
                    <Card key={kpi.kpi_id} className="p-4 text-center">
                      <div className="relative w-20 h-20 mx-auto mb-2">
                        <svg className="w-20 h-20 transform -rotate-90">
                          <circle
                            cx="40"
                            cy="40"
                            r="36"
                            fill="none"
                            stroke="hsl(var(--muted))"
                            strokeWidth="6"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="36"
                            fill="none"
                            stroke={getProgressColor(index)}
                            strokeWidth="6"
                            strokeDasharray={`${226} ${226}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-foreground">
                            {formatValue(kpi.total, kpi.type)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {kpi.label}
                      </p>
                    </Card>
                  ))}
                </div>

                {/* Monthly Calendar Heatmaps */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">📅 Daily Performance Calendar</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {eachMonthOfInterval({ start: startDate!, end: endDate! }).map((monthDate) => (
                      <MonthlyCalendarHeatmap
                        key={monthDate.toISOString()}
                        memberId={selectedMember}
                        month={monthDate}
                        showHeader={true}
                        showLegend={eachMonthOfInterval({ start: startDate!, end: endDate! }).indexOf(monthDate) === 0}
                      />
                    ))}
                  </div>
                </div>

                {/* Call Log Upload Section */}
                {!viewingHistoricalFrame ? (
                  <CallLogUploadSection
                    teamMemberName={selectedMemberName}
                    startDate={startDate!}
                    endDate={endDate!}
                    onDataChange={setCallLogData}
                  />
                ) : callLogData && Object.keys(callLogData).length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-bold uppercase tracking-wide text-foreground mb-4">Call Log (Saved)</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-foreground">{callLogData.total_calls}</div>
                        <div className="text-xs text-muted-foreground">Total Calls</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-foreground">{callLogData.calls_over_threshold}</div>
                        <div className="text-xs text-muted-foreground">Calls ≥{callLogData.threshold_minutes}min</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-foreground">
                          {Math.floor(callLogData.total_talk_time_seconds / 3600)}h {Math.floor((callLogData.total_talk_time_seconds % 3600) / 60)}m
                        </div>
                        <div className="text-xs text-muted-foreground">Talk Time</div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Quoted Details Upload Section */}
                {!viewingHistoricalFrame ? (
                  <QuotedDetailsUploadSection
                    teamMemberName={selectedMemberName}
                    startDate={startDate!}
                    endDate={endDate!}
                    onDataChange={setQuotedData}
                  />
                ) : quotedData && Object.keys(quotedData).length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-bold uppercase tracking-wide text-foreground mb-4">Quoted Details (Saved)</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-foreground">{quotedData.policies_quoted}</div>
                        <div className="text-xs text-muted-foreground">#POL</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-foreground">{quotedData.items_quoted}</div>
                        <div className="text-xs text-muted-foreground">#ITEM</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-foreground">
                          ${(quotedData.premium_quoted_cents / 100).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">$PREM</div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Sold Details Upload Section */}
                {!viewingHistoricalFrame ? (
                  <SoldDetailsUploadSection
                    teamMemberName={selectedMemberName}
                    onDataChange={setSoldData}
                  />
                ) : soldData && Object.keys(soldData).length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-bold uppercase tracking-wide text-foreground mb-4">Sold Details (Saved)</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-foreground">{soldData.policies_sold}</div>
                        <div className="text-xs text-muted-foreground">#POL</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-foreground">{soldData.items_sold}</div>
                        <div className="text-xs text-muted-foreground">#ITEM</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-foreground">
                          ${(soldData.premium_sold_cents / 100).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">$PREM</div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Call Scoring Submissions Section */}
                {!viewingHistoricalFrame && (
                  <CallScoringSubmissionsSection
                    agencyId={agencyId}
                    teamMemberId={selectedMember}
                    teamMemberName={selectedMemberName}
                    startDate={startDate!}
                    endDate={endDate!}
                    onDataChange={setCallScoringData}
                    qaEnabled={Boolean(callScoringQaFeature?.canAccess)}
                  />
                )}

                {/* Meeting Notes Display (for export) */}
                {meetingNotes && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-bold mb-2 text-foreground">Meeting Notes</h4>
                    <p className="whitespace-pre-wrap text-muted-foreground">{meetingNotes}</p>
                  </div>
                )}
              </div>

              {/* Meeting Takeaway Section (not in export ref for live editing) */}
              {!viewingHistoricalFrame && (
                <Card className="p-6">
                  <h3 className="font-bold uppercase tracking-wide text-center mb-4 text-foreground">
                    Meeting Takeaway Submission
                  </h3>

                  <Textarea
                    placeholder="Enter notes, action items, and takeaways from this meeting..."
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                    className="min-h-[150px] mb-4"
                  />

                  <div className="flex flex-wrap justify-end gap-3">
                    <Button variant="outline" onClick={handleExportPNG}>
                      <Image className="h-4 w-4 mr-2" />
                      Export PNG
                    </Button>
                    <Button variant="outline" onClick={handleExportPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                    <Button onClick={handleSaveMeetingFrame} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Meeting Frame'}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Historical frame export buttons */}
              {viewingHistoricalFrame && (
                <Card className="p-6">
                  <div className="flex flex-wrap justify-end gap-3">
                    <Button variant="outline" onClick={handleExportPNG}>
                      <Image className="h-4 w-4 mr-2" />
                      Export PNG
                    </Button>
                    <Button variant="outline" onClick={handleExportPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* No report yet */}
          {!reportGenerated && (
            <Card className="p-12 text-center">
              <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground">Select a Team Member</h3>
              <p className="text-muted-foreground mt-2">
                Choose a team member and date range to generate their meeting frame report
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default MeetingFrameTab;
