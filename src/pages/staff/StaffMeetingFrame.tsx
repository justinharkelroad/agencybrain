import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInDays } from 'date-fns';
import { CalendarIcon, Users, History, Image, FileText, Trash2, Save, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { getMetricValue } from '@/lib/kpiKeyMapping';
import { MonthlyCalendarHeatmap } from '@/components/agency/MonthlyCalendarHeatmap';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  kpi_totals: any;
  call_log_data: any;
  quoted_data: any;
  sold_data: any;
  call_scoring_data: any;
  meeting_notes: string | null;
  created_at: string;
  team_members?: {
    name: string;
    role: string;
  };
}

export default function StaffMeetingFrame() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [kpiTotals, setKpiTotals] = useState<KPITotal[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [viewMode, setViewMode] = useState<'new' | 'history'>('new');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [meetingFrameHistory, setMeetingFrameHistory] = useState<MeetingFrame[]>([]);
  const [viewingHistoricalFrame, setViewingHistoricalFrame] = useState<string | null>(null);
  const [metricsData, setMetricsData] = useState<any[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Helper to get staff token
  const getStaffToken = () => localStorage.getItem('staff_session_token');

  // Fetch initial data on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setInitialLoading(true);
    try {
      const staffToken = getStaffToken();
      if (!staffToken) {
        toast.error('No staff session found. Please log in again.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('scorecards_admin', {
        headers: { 'x-staff-session': staffToken },
        body: { action: 'meeting_frame_list' },
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error('Failed to load meeting frame data');
        return;
      }

      if (data?.error) {
        console.error('Data error:', data.error);
        toast.error(data.error);
        return;
      }

      setTeamMembers(data.teamMembers || []);
      setKpis(data.kpis || []);
      setMeetingFrameHistory(data.history || []);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      toast.error('Failed to load meeting frame data');
    } finally {
      setInitialLoading(false);
    }
  };

  const validateDateRange = () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return false;
    }
    if (endDate < startDate) {
      toast.error('End date must be after start date');
      return false;
    }
    const daysDiff = differenceInDays(endDate, startDate);
    if (daysDiff > 60) {
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
      const staffToken = getStaffToken();
      if (!staffToken) {
        toast.error('No staff session found');
        return;
      }

      const startStr = format(startDate!, 'yyyy-MM-dd');
      const endStr = format(endDate!, 'yyyy-MM-dd');

      const { data, error } = await supabase.functions.invoke('scorecards_admin', {
        headers: { 'x-staff-session': staffToken },
        body: { 
          action: 'meeting_frame_generate',
          team_member_id: selectedMember,
          start_date: startStr,
          end_date: endStr,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const metrics = data.metricsData || [];
      setMetricsData(metrics);

      // Aggregate KPI totals
      const totals: KPITotal[] = kpis.map((kpi) => {
        let total = 0;
        metrics.forEach((row: any) => {
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

      const nonZeroTotals = totals.filter(t => t.total > 0);
      setKpiTotals(nonZeroTotals.length > 0 ? nonZeroTotals : totals);
      setReportGenerated(true);
      setMeetingNotes('');
      toast.success('Report generated!');
    } catch (err: any) {
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
      const staffToken = getStaffToken();
      if (!staffToken) {
        toast.error('No staff session found');
        return;
      }

      const { data, error } = await supabase.functions.invoke('scorecards_admin', {
        headers: { 'x-staff-session': staffToken },
        body: {
          action: 'meeting_frame_create',
          team_member_id: selectedMember,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          kpi_totals: kpiTotals,
          call_log_data: {},
          quoted_data: {},
          sold_data: {},
          call_scoring_data: [],
          meeting_notes: meetingNotes || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Meeting frame saved successfully!');
      fetchInitialData(); // Refresh history
    } catch (err: any) {
      console.error('Error saving meeting frame:', err);
      toast.error('Failed to save meeting frame');
    } finally {
      setSaving(false);
    }
  };

  const handleViewHistoricalFrame = (frame: MeetingFrame) => {
    setViewMode('new');
    setSelectedMember(frame.team_member_id);
    setStartDate(new Date(frame.start_date + 'T00:00:00'));
    setEndDate(new Date(frame.end_date + 'T00:00:00'));
    setKpiTotals((frame.kpi_totals as KPITotal[]) || []);
    setMeetingNotes(frame.meeting_notes || '');
    setReportGenerated(true);
    setViewingHistoricalFrame(frame.id);
  };

  const handleDeleteFrame = async (frameId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this meeting frame?');
    if (!confirmed) return;

    try {
      const staffToken = getStaffToken();
      if (!staffToken) {
        toast.error('No staff session found');
        return;
      }

      const { data, error } = await supabase.functions.invoke('scorecards_admin', {
        headers: { 'x-staff-session': staffToken },
        body: { action: 'meeting_frame_delete', frame_id: frameId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Meeting frame deleted');
      fetchInitialData();
    } catch (err: any) {
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
    setMeetingNotes('');
    setReportGenerated(false);
    setViewingHistoricalFrame(null);
    setMetricsData([]);
  };

  const selectedMemberName = teamMembers.find(m => m.id === selectedMember)?.name || 'Team Member';

  if (initialLoading) {
    return (
      <div className="space-y-6">
        <Link to="/staff/metrics" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Metrics
        </Link>
        <Card className="p-8">
          <div className="flex items-center justify-center gap-3">
            <Users className="h-5 w-5 animate-pulse" />
            <span className="text-muted-foreground">Loading meeting frame data...</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/staff/metrics" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Metrics
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          1-on-1 Meeting Frame
        </h1>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'new' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('new')}
          >
            <Users className="h-4 w-4 mr-2" />
            New Report
          </Button>
          <Button
            variant={viewMode === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('history')}
          >
            <History className="h-4 w-4 mr-2" />
            History ({meetingFrameHistory.length})
          </Button>
        </div>
      </div>

      {viewMode === 'history' ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Meeting Frame History</h2>
          {meetingFrameHistory.length === 0 ? (
            <p className="text-muted-foreground">No meeting frames saved yet.</p>
          ) : (
            <div className="space-y-3">
              {meetingFrameHistory.map((frame) => (
                <div
                  key={frame.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 cursor-pointer" onClick={() => handleViewHistoricalFrame(frame)}>
                    <p className="font-medium">{frame.team_members?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(frame.start_date), 'MMM d')} - {format(new Date(frame.end_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFrame(frame.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* Selection Panel */}
          <Card className="p-6">
            <div className="grid gap-6 md:grid-cols-4">
              <div>
                <Label>Team Member</Label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full mt-2 justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full mt-2 justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-end gap-2">
                <Button onClick={generateReport} disabled={loading} className="flex-1">
                  {loading ? 'Generating...' : 'Generate Report'}
                </Button>
                {reportGenerated && (
                  <Button variant="outline" onClick={resetForm}>
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Report Display */}
          {reportGenerated && (
            <div ref={reportRef}>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold">{selectedMemberName}</h2>
                    <p className="text-muted-foreground">
                      {startDate && endDate && (
                        <>
                          {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
                          {' '}({differenceInDays(endDate, startDate) + 1} days)
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportPNG}>
                      <Image className="h-4 w-4 mr-2" />
                      PNG
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </div>

                {/* KPI Totals Grid */}
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 mb-6">
                  {kpiTotals.map((kpi) => (
                    <div key={kpi.kpi_id} className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">{kpi.label}</p>
                      <p className="text-2xl font-bold">
                        {kpi.type === 'currency' 
                          ? `$${kpi.total.toLocaleString()}`
                          : kpi.total.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>


                {/* Meeting Notes */}
                <div className="mt-6">
                  <Label>Meeting Notes</Label>
                  <Textarea
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                    placeholder="Add notes from your 1-on-1 meeting..."
                    className="mt-2 min-h-[100px]"
                  />
                </div>

                {/* Save Button */}
                {!viewingHistoricalFrame && (
                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleSaveMeetingFrame} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Meeting Frame'}
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
