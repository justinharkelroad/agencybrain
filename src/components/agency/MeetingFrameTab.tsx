import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInDays } from 'date-fns';
import { CalendarIcon, Users, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getMetricValue } from '@/lib/kpiKeyMapping';

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

export function MeetingFrameTab({ agencyId }: MeetingFrameTabProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [kpiTotals, setKpiTotals] = useState<KPITotal[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);

  // Fetch team members and KPIs on mount
  useEffect(() => {
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

    const fetchKPIs = async () => {
      const { data, error } = await supabase
        .from('kpis')
        .select('id, key, label, type')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('label');

      if (!error && data) {
        setKpis(data);
      }
    };

    fetchTeamMembers();
    fetchKPIs();
  }, [agencyId]);

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
    try {
      const startStr = format(startDate!, 'yyyy-MM-dd');
      const endStr = format(endDate!, 'yyyy-MM-dd');

      // Fetch all metrics_daily rows for the team member in the date range
      const { data: metricsData, error: metricsError } = await supabase
        .from('metrics_daily')
        .select('*')
        .eq('team_member_id', selectedMember)
        .gte('date', startStr)
        .lte('date', endStr);

      if (metricsError) {
        console.error('Error fetching metrics:', metricsError);
        throw metricsError;
      }

      // Aggregate KPI totals using getMetricValue for each KPI
      const totals: KPITotal[] = kpis.map((kpi) => {
        let total = 0;
        (metricsData || []).forEach((row) => {
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

      // Filter out KPIs with zero totals for cleaner display
      const nonZeroTotals = totals.filter(t => t.total > 0);
      
      setKpiTotals(nonZeroTotals.length > 0 ? nonZeroTotals : totals);
      setReportGenerated(true);
      toast.success('Report generated!');
    } catch (err) {
      console.error('Error generating report:', err);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const selectedMemberName = teamMembers.find(m => m.id === selectedMember)?.name || '';

  const formatValue = (value: number, type: string) => {
    if (type === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
      }).format(value / 100); // Convert cents to dollars
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
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-foreground">Meeting Frame</h2>
        <p className="text-muted-foreground">
          Generate a comprehensive performance snapshot for 1:1 meetings
        </p>
      </div>

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
            <Button onClick={generateReport} disabled={loading} className="w-full">
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Report Content */}
      {reportGenerated && (
        <div className="space-y-6">
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

          {/* Placeholder sections for Phase 2+ */}
          <Card className="p-6 bg-muted/30 border-dashed">
            <p className="text-muted-foreground text-center">
              📅 Monthly Calendar Heatmap (Phase 2)
            </p>
          </Card>

          <Card className="p-6 bg-muted/30 border-dashed">
            <p className="text-muted-foreground text-center">
              📞 Call Log Upload Section (Phase 3)
            </p>
          </Card>

          <Card className="p-6 bg-muted/30 border-dashed">
            <p className="text-muted-foreground text-center">
              📋 Quoted/Sold Details Upload (Phase 4)
            </p>
          </Card>

          <Card className="p-6 bg-muted/30 border-dashed">
            <p className="text-muted-foreground text-center">
              🎯 Call Scoring Submissions (Phase 5)
            </p>
          </Card>

          <Card className="p-6 bg-muted/30 border-dashed">
            <p className="text-muted-foreground text-center">
              📝 Meeting Takeaway Notes (Phase 6)
            </p>
          </Card>
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
    </div>
  );
}

export default MeetingFrameTab;
