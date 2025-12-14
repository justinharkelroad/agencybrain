import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, Upload, Clock, FileAudio, AlertCircle, Sparkles, Loader2, BarChart3, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { CallScorecard } from '@/components/CallScorecard';
import { CallScoringAnalytics } from '@/components/CallScoringAnalytics';

interface UsageInfo {
  calls_used: number;
  calls_limit: number;
  period_end?: string | null;
}

interface RecentCall {
  id: string;
  original_filename: string;
  call_duration_seconds: number;
  status: string;
  overall_score: number | null;
  potential_rank: string | null;
  created_at: string;
  team_member_name: string;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  staff_feedback_positive?: string | null;
  staff_feedback_improvement?: string | null;
}

interface AnalyticsCall {
  id: string;
  team_member_id: string;
  team_member_name: string;
  potential_rank: string | null;
  overall_score: number | null;
  skill_scores: any;
  discovery_wins: any;
  analyzed_at: string | null;
}

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'];
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/ogg', 'audio/mp4'];
const MAX_SIZE_MB = 25;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function CallScoring() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<UsageInfo>({ calls_used: 0, calls_limit: 20 });
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [analyticsCalls, setAnalyticsCalls] = useState<AnalyticsCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [userRole, setUserRole] = useState<string>('staff');
  const [userTeamMemberId, setUserTeamMemberId] = useState<string | null>(null);
  
  // Staff user detection - check localStorage for staff session token
  const [isStaffUser, setIsStaffUser] = useState(false);
  const [staffAgencyId, setStaffAgencyId] = useState<string | null>(null);
  const [staffTeamMemberId, setStaffTeamMemberId] = useState<string | null>(null);
  const [staffDataLoaded, setStaffDataLoaded] = useState(false);
  
  // Access control state
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  
  // Processing queue for showing uploads in progress
  const [processingCalls, setProcessingCalls] = useState<Array<{
    id: string;
    fileName: string;
    teamMemberName: string;
    startedAt: Date;
  }>>([]);
  
  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  // Scorecard modal state
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [scorecardOpen, setScorecardOpen] = useState(false);

  // Detect staff user by verifying session token (same as useStaffAuth hook)
  useEffect(() => {
    const detectStaffUser = async () => {
      console.log('=== CallScoring Staff Detection ===');
      const token = localStorage.getItem('staff_session_token');
      console.log('staff_session_token exists:', !!token);
      
      if (!token) {
        console.log('No staff session token, not a staff user');
        setStaffDataLoaded(true);
        return;
      }
      
      try {
        // Verify token and get user data
        const { data, error } = await supabase.functions.invoke('staff_verify_session', {
          body: { session_token: token }
        });
        
        console.log('Staff session verification:', { data, error });
        
        if (error || !data?.valid) {
          console.log('Invalid staff session');
          setStaffDataLoaded(true);
          return;
        }
        
        console.log('Staff user detected:', data.user);
        setIsStaffUser(true);
        setStaffAgencyId(data.user.agency_id);
        setStaffTeamMemberId(data.user.team_member_id);
        setAgencyId(data.user.agency_id);
        setUserTeamMemberId(data.user.team_member_id);
        setUserRole('staff');
        setStaffDataLoaded(true);
      } catch (err) {
        console.error('Error detecting staff user:', err);
        setStaffDataLoaded(true);
      }
    };
    
    detectStaffUser();
  }, []);

  // Check access for staff users via RPC (wait for staff detection to complete)
  useEffect(() => {
    const checkStaffAccess = async () => {
      // Wait for staff detection to complete
      if (!staffDataLoaded) return;
      
      // If not a staff user, skip
      if (!isStaffUser || !staffAgencyId) return;
      
      console.log('Checking staff access for agency:', staffAgencyId);
      
      const { data: isEnabled, error } = await supabase
        .rpc('is_call_scoring_enabled', { p_agency_id: staffAgencyId });
      
      console.log('Staff call scoring access:', isEnabled, error);
      
      if (isEnabled) {
        setHasAccess(true);
        setAccessChecked(true);
      } else {
        navigate('/staff/dashboard');
        toast.error('Call Scoring is not enabled for your agency');
      }
    };
    
    if (staffDataLoaded && isStaffUser) {
      checkStaffAccess();
    }
  }, [staffDataLoaded, isStaffUser, staffAgencyId, navigate]);

  // Fetch data for staff users via RPC
  useEffect(() => {
    const fetchStaffData = async () => {
      console.log('=== fetchStaffData ===');
      console.log('hasAccess:', hasAccess);
      console.log('staffAgencyId:', staffAgencyId);
      console.log('staffTeamMemberId:', staffTeamMemberId);
      
      if (!hasAccess) {
        console.log('No access yet, aborting fetch');
        return;
      }
      
      if (!staffAgencyId) {
        console.log('No agency ID, aborting fetch');
        return;
      }
      
      if (!staffTeamMemberId) {
        console.log('No team member ID, aborting fetch');
        return;
      }
      
      setLoading(true);
      
      const { data, error } = await supabase.rpc('get_staff_call_scoring_data', {
        p_agency_id: staffAgencyId,
        p_team_member_id: staffTeamMemberId
      });

      console.log('RPC response data:', data);
      console.log('RPC error:', error);
      console.log('Recent calls returned:', data?.recent_calls);
      console.log('Team members returned:', data?.team_members);
      console.log('Templates returned:', data?.templates);
      console.log('Usage returned:', data?.usage);

      if (data) {
        setTemplates(data.templates || []);
        setTeamMembers(data.team_members || []);
        setRecentCalls(data.recent_calls || []);
        setUsage(data.usage || { calls_used: 0, calls_limit: 20 });
        
        // Auto-select team member for staff
        if (data.team_members?.length === 1) {
          setSelectedTeamMember(data.team_members[0].id);
        }
      }
      
      setLoading(false);
    };
    
    if (isStaffUser && hasAccess) {
      fetchStaffData();
    }
  }, [isStaffUser, hasAccess, staffAgencyId, staffTeamMemberId]);

  // Check access for regular users on mount
  useEffect(() => {
    const checkAccess = async () => {
      // Skip if staff user (handled separately)
      if (isStaffUser) return;
      if (!user) return;
      
      // Admins always have access
      if (isAdmin) {
        setHasAccess(true);
        setAccessChecked(true);
        return;
      }
      
      // For non-admins, check if their agency has it enabled
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();
      
      if (profile?.agency_id) {
        const { data: settings } = await supabase
          .from('agency_call_scoring_settings')
          .select('enabled')
          .eq('agency_id', profile.agency_id)
          .single();
        
        if (settings?.enabled) {
          setHasAccess(true);
        } else {
          navigate('/');
          toast.error('Call Scoring is not enabled for your agency');
        }
      } else {
        navigate('/');
        toast.error('No agency found');
      }
      setAccessChecked(true);
    };
    
    checkAccess();
  }, [user, isAdmin, navigate, isStaffUser]);

  // Fetch data once access is confirmed (regular users only)
  useEffect(() => {
    if (hasAccess && user && !isStaffUser) {
      fetchAgencyAndData();
    }
  }, [hasAccess, user, isStaffUser]);

  const fetchAgencyAndData = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id, role')
        .eq('id', user!.id)
        .single();

      if (profile?.agency_id) {
        setAgencyId(profile.agency_id);
        const role = profile.role || 'user';
        setUserRole(role);
        
        // Find user's team member ID via staff_users link (for staff/manager roles)
        let teamMemberId: string | null = null;
        
        if (role !== 'admin') {
          const { data: staffUser, error: staffError } = await supabase
            .from('staff_users')
            .select('team_member_id')
            .eq('agency_id', profile.agency_id)
            .maybeSingle();
          
          console.log('Staff user lookup:', { staffUser, staffError, userId: user!.id });
          
          if (staffUser?.team_member_id) {
            teamMemberId = staffUser.team_member_id;
            setUserTeamMemberId(teamMemberId);
          }
        }
        
        await Promise.all([
          fetchUsageAndCalls(profile.agency_id, role, teamMemberId),
          fetchFormData(profile.agency_id, role, teamMemberId)
        ]);
      }
    } catch (err) {
      console.error('Error fetching agency data:', err);
    }
  };

  const fetchUsageAndCalls = async (agency: string, role: string, teamMemberId?: string | null) => {
    setLoading(true);
    
    try {
      // Fetch usage using the new RPC function
      const { data: usageData } = await supabase
        .rpc('check_and_reset_call_usage', { p_agency_id: agency });
      
      if (usageData && usageData[0]) {
        setUsage({
          calls_used: usageData[0].calls_used || 0,
          calls_limit: usageData[0].calls_limit || 20,
          period_end: usageData[0].period_end
        });
      } else {
        setUsage({ calls_used: 0, calls_limit: 20 });
      }

      // Build base query for recent calls - include acknowledgment fields
      let callsQuery = supabase
        .from('agency_calls')
        .select('id, original_filename, call_duration_seconds, status, overall_score, potential_rank, created_at, team_member_id, acknowledged_at, acknowledged_by, staff_feedback_positive, staff_feedback_improvement')
        .eq('agency_id', agency)
        .order('created_at', { ascending: false })
        .limit(10);

      // Build base query for analytics
      let analyticsQuery = supabase
        .from('agency_calls')
        .select('id, team_member_id, potential_rank, overall_score, skill_scores, discovery_wins, analyzed_at')
        .eq('agency_id', agency)
        .not('analyzed_at', 'is', null)
        .order('analyzed_at', { ascending: false });

      // Apply role-based filtering
      // Staff/managers with linked team_member only see their own calls
      // Agency owners (role=user or null) and admins see all agency calls
      if ((role === 'staff' || role === 'manager') && teamMemberId) {
        callsQuery = callsQuery.eq('team_member_id', teamMemberId);
        analyticsQuery = analyticsQuery.eq('team_member_id', teamMemberId);
      }
      // Agency owners (role='user' or null) and admins see all calls for the agency

      const { data: callsData } = await callsQuery;
      const { data: analyticsData } = await analyticsQuery;

      // Get all unique team member IDs from both datasets
      const allTeamMemberIds = [
        ...new Set([
          ...(callsData?.map(c => c.team_member_id) || []),
          ...(analyticsData?.map(c => c.team_member_id) || [])
        ])
      ];
      
      const { data: membersData } = await supabase
        .from('team_members')
        .select('id, name')
        .in('id', allTeamMemberIds.length > 0 ? allTeamMemberIds : ['00000000-0000-0000-0000-000000000000']);

      const memberMap = new Map(membersData?.map(m => [m.id, m.name]) || []);

      if (callsData && callsData.length > 0) {
        const enrichedCalls: RecentCall[] = callsData.map(call => ({
          id: call.id,
          original_filename: call.original_filename || 'Unknown file',
          call_duration_seconds: call.call_duration_seconds || 0,
          status: call.status || 'unknown',
          overall_score: call.overall_score,
          potential_rank: call.potential_rank,
          created_at: call.created_at,
          team_member_name: memberMap.get(call.team_member_id) || 'Unknown',
          acknowledged_at: call.acknowledged_at,
          acknowledged_by: call.acknowledged_by,
          staff_feedback_positive: call.staff_feedback_positive,
          staff_feedback_improvement: call.staff_feedback_improvement
        }));
        setRecentCalls(enrichedCalls);
      } else {
        setRecentCalls([]);
      }

      // Enrich analytics calls with team member names
      if (analyticsData && analyticsData.length > 0) {
        const enrichedAnalytics: AnalyticsCall[] = analyticsData.map(call => ({
          id: call.id,
          team_member_id: call.team_member_id,
          team_member_name: memberMap.get(call.team_member_id) || 'Unknown',
          potential_rank: call.potential_rank,
          overall_score: call.overall_score,
          skill_scores: call.skill_scores,
          discovery_wins: call.discovery_wins,
          analyzed_at: call.analyzed_at
        }));
        setAnalyticsCalls(enrichedAnalytics);
      } else {
        setAnalyticsCalls([]);
      }
    } catch (err) {
      console.error('Error fetching calls:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFormData = async (agency: string, role: string, teamMemberId?: string | null) => {
    // For staff/managers with linked team_member, only show their own record
    // For agency owners (role=user or null) and admins, show all active team members
    let members: { id: string; name: string }[] = [];
    
    if ((role === 'staff' || role === 'manager') && teamMemberId) {
      // Staff/managers can only select themselves
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('id', teamMemberId)
        .single();
      
      console.log('Staff team member fetch:', { data, error, teamMemberId });
      if (data) members = [data];
    } else {
      // Agency owners (role='user', 'admin', or null) see all active team members
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('agency_id', agency)
        .eq('status', 'active')
        .order('name');
      
      console.log('All team members fetch:', { data, error, agency });
      members = data || [];
    }
    
    setTeamMembers(members);
    
    // Auto-select if only one option (for staff)
    if (members.length === 1) {
      setSelectedTeamMember(members[0].id);
    }

    // Fetch global templates
    const { data: globalTemplates } = await supabase
      .from('call_scoring_templates')
      .select('id, name, is_global')
      .eq('is_global', true)
      .eq('is_active', true);

    // Fetch agency-specific templates
    const { data: agencyTemplates } = await supabase
      .from('call_scoring_templates')
      .select('id, name, is_global')
      .eq('agency_id', agency)
      .eq('is_active', true);

    // Combine both
    const allTemplates = [
      ...(globalTemplates || []),
      ...(agencyTemplates || [])
    ];
    
    setTemplates(allTemplates);
  };

  const handleFileSelect = (file: File | null) => {
    setFileError(null);
    
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension) && !ALLOWED_TYPES.includes(file.type)) {
      setFileError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setFileError(`File too large. Maximum size: ${MAX_SIZE_MB}MB`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFileSelect(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds && seconds !== 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const canUpload = selectedFile && selectedTeamMember && selectedTemplate && 
    usage.calls_used < usage.calls_limit;

  const handleUpload = async () => {
    if (!canUpload || !selectedFile || !agencyId) return;
    
    // Get team member name for display
    const selectedMember = teamMembers.find(m => m.id === selectedTeamMember);
    const teamMemberName = selectedMember?.name || 'Unknown';

    // Generate temp ID for tracking
    const tempId = crypto.randomUUID();

    // Capture current values before resetting
    const fileToUpload = selectedFile;
    const teamMemberId = selectedTeamMember;
    const templateId = selectedTemplate;
    const currentAgencyId = agencyId;
    const fileName = selectedFile.name;

    // Add to processing queue IMMEDIATELY
    setProcessingCalls(prev => [...prev, {
      id: tempId,
      fileName: fileName,
      teamMemberName: teamMemberName,
      startedAt: new Date(),
    }]);

    // Reset form
    setSelectedFile(null);
    setSelectedTeamMember('');
    setSelectedTemplate('');

    // Process in background (don't await)
    processCallInBackground(fileToUpload, teamMemberId, templateId, currentAgencyId, tempId, fileName);
  };

  // Separate background function
  const processCallInBackground = async (
    file: File,
    teamMemberId: string,
    templateId: string,
    agencyIdParam: string,
    tempId: string,
    fileName: string
  ) => {
    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('team_member_id', teamMemberId);
      formData.append('template_id', templateId);
      formData.append('agency_id', agencyIdParam);
      formData.append('file_name', file.name);

      const { data, error } = await supabase.functions.invoke('transcribe-call', {
        body: formData,
      });

      // Remove from processing queue
      setProcessingCalls(prev => prev.filter(c => c.id !== tempId));

      if (error) {
        console.error('Transcription error:', error);
        toast.error(`Failed to process "${fileName}"`);
        return;
      }

      console.log('Transcription complete:', data);
      
      // Refresh the calls list to show new entry
      if (agencyId) {
        fetchUsageAndCalls(agencyId, userRole, userTeamMemberId);
      }
      
      toast.success(`"${fileName}" uploaded! Analysis in progress...`);

      // Poll for analysis completion
      if (data.call_id) {
        pollForAnalysis(data.call_id, fileName);
      }

    } catch (err) {
      console.error('Background processing error:', err);
      setProcessingCalls(prev => prev.filter(c => c.id !== tempId));
      toast.error(`Failed to process "${fileName}"`);
    }
  };

  // Poll to notify when analysis is done
  const pollForAnalysis = async (callId: string, fileName: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 3 seconds = 90 seconds max
    
    const checkStatus = async () => {
      attempts++;
      
      const { data } = await supabase
        .from('agency_calls')
        .select('status, overall_score')
        .eq('id', callId)
        .single();

      if (data?.status === 'analyzed' && data?.overall_score !== null) {
        toast.success(`"${fileName}" analysis complete: ${data.overall_score}%`, {
          duration: 5000,
        });
        if (agencyId) {
          fetchUsageAndCalls(agencyId, userRole, userTeamMemberId); // Refresh to show score
        }
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(checkStatus, 3000); // Check every 3 seconds
      }
    };

    // Start polling after a short delay
    setTimeout(checkStatus, 5000);
  };

  const handleCallClick = async (call: RecentCall | any) => {
    console.log('=== Call clicked ===');
    console.log('Full call object:', call);
    console.log('skill_scores:', call.skill_scores);
    console.log('overall_score:', call.overall_score);
    console.log('section_scores:', call.section_scores);
    console.log('discovery_wins:', call.discovery_wins);
    console.log('critical_gaps:', call.critical_gaps);
    console.log('client_profile:', call.client_profile);
    console.log('coaching_recommendations:', call.coaching_recommendations);
    console.log('potential_rank:', call.potential_rank);
    
    // For staff users, the call already has full data from RPC - use it directly
    if (isStaffUser) {
      console.log('Staff user - using call data directly from RPC');
      setSelectedCall({
        ...call,
        team_member_name: call.team_member_name
      });
      setScorecardOpen(true);
      return;
    }
    
    // For regular users, fetch full call data from database
    console.log('Regular user - fetching full call data from database...');
    const { data: fullCall, error } = await supabase
      .from('agency_calls')
      .select(`
        id,
        original_filename,
        call_duration_seconds,
        status,
        overall_score,
        potential_rank,
        skill_scores,
        section_scores,
        discovery_wins,
        critical_gaps,
        closing_attempts,
        missed_signals,
        client_profile,
        premium_analysis,
        coaching_recommendations,
        notable_quotes,
        summary,
        transcript,
        created_at,
        analyzed_at,
        acknowledged_at,
        staff_feedback_positive,
        staff_feedback_improvement,
        agent_talk_seconds,
        customer_talk_seconds,
        dead_air_seconds,
        agent_talk_percent,
        customer_talk_percent,
        dead_air_percent,
        team_member_id
      `)
      .eq('id', call.id)
      .single();
    
    console.log('Fetched full call:', fullCall);
    console.log('Fetch error:', error);
    
    if (error) {
      console.error('Error fetching call details:', error);
      toast.error('Failed to load call details');
      return;
    }
    
    // Merge with the team member name from the list
    const mergedCall = {
      ...fullCall,
      team_member_name: call.team_member_name
    };
    console.log('Merged call for scorecard:', mergedCall);
    
    setSelectedCall(mergedCall);
    setScorecardOpen(true);
  };

  const handleStaffAcknowledge = async (positive: string, improvement: string) => {
    if (!selectedCall?.id || !staffTeamMemberId) {
      throw new Error('Missing call or team member ID');
    }

    const { data, error } = await supabase.rpc('acknowledge_call_review', {
      p_call_id: selectedCall.id,
      p_team_member_id: staffTeamMemberId,
      p_feedback_positive: positive,
      p_feedback_improvement: improvement
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error);

    // Update local state to show the acknowledgment immediately
    setSelectedCall({
      ...selectedCall,
      acknowledged_at: new Date().toISOString(),
      staff_feedback_positive: positive,
      staff_feedback_improvement: improvement
    });

    // Refresh calls list
    if (isStaffUser && staffAgencyId) {
      const { data: refreshData } = await supabase.rpc('get_staff_call_scoring_data', {
        p_agency_id: staffAgencyId,
        p_team_member_id: staffTeamMemberId
      });
      if (refreshData) {
        setRecentCalls(refreshData.recent_calls || []);
      }
    } else if (agencyId) {
      fetchUsageAndCalls(agencyId, userRole, userTeamMemberId);
    }
  };

  // Show loading while checking access
  if (!accessChecked) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header with Usage Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            Call Scoring
          </h1>
          <p className="text-muted-foreground">
            Upload sales calls for AI-powered coaching analysis
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {usage.calls_used} / {usage.calls_limit} calls
          {usage.period_end && (
            <span className="ml-2 text-muted-foreground">• Resets {new Date(usage.period_end).toLocaleDateString()}</span>
          )}
        </Badge>
      </div>

      {/* Tabs - hide Analytics for staff users */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full max-w-md ${userRole === 'staff' ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {userRole === 'staff' ? 'My Calls' : 'Upload & Calls'}
          </TabsTrigger>
          {userRole !== 'staff' && (
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Call Recording
            </CardTitle>
            <CardDescription>
              Upload an audio file to analyze (MP3, WAV, M4A, OGG - max 25MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${selectedFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}
                ${fileError ? 'border-destructive bg-destructive/5' : ''}`}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,audio/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
              
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <FileAudio className="h-8 w-8" />
                  </div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    Drag & drop an audio file, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    MP3, WAV, M4A, OGG up to 25MB
                  </p>
                </div>
              )}
            </div>

            {fileError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {fileError}
              </p>
            )}

            {/* Team Member Dropdown */}
            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select value={selectedTeamMember} onValueChange={setSelectedTeamMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member..." />
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

            {/* Template Dropdown */}
            <div className="space-y-2">
              <Label>Scoring Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Usage Warning */}
            {usage.calls_used >= usage.calls_limit && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Monthly limit reached. Upgrade to analyze more calls.
              </p>
            )}

            {/* Upload Button */}
            <Button 
              className="w-full" 
              disabled={!canUpload}
              onClick={handleUpload}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Analyze Call
            </Button>
          </CardContent>
        </Card>

        {/* Right Column - Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Calls
            </CardTitle>
            <CardDescription>Your last 10 analyzed calls</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && processingCalls.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : processingCalls.length === 0 && recentCalls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No calls analyzed yet</p>
                <p className="text-sm">Upload your first call to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Processing calls first */}
                {processingCalls.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-blue-500/30 bg-blue-500/5 animate-pulse"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-blue-500/20">
                        <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{call.teamMemberName}</p>
                        <p className="text-xs text-muted-foreground">{call.fileName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="px-2 py-1 rounded text-sm bg-blue-500/20 text-blue-400 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Completed calls */}
                {recentCalls.map((call) => (
                  <div
                    key={call.id}
                    onClick={() => call.status === 'analyzed' && handleCallClick(call)}
                    className={`flex items-center justify-between p-3 rounded-lg border bg-card transition-colors ${
                      call.status === 'analyzed' ? 'hover:bg-accent/50 cursor-pointer' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <FileAudio className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {call.team_member_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {call.original_filename}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Acknowledgment Status Badge */}
                      {call.status === 'analyzed' && (
                        call.acknowledged_at ? (
                          <Badge variant="outline" className="text-green-500 border-green-500/50 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Reviewed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )
                      )}
                      <div className="text-right">
                        <p className="text-sm">
                          {formatDuration(call.call_duration_seconds)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(call.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {/* Status Badge - show potential rank for analyzed calls */}
                      {call.status === 'analyzed' && call.potential_rank ? (
                        <Badge className={`text-xs ${
                          call.potential_rank === 'VERY HIGH' || call.potential_rank === 'HIGH' 
                            ? 'bg-green-500/20 text-green-400' 
                            : call.potential_rank === 'MEDIUM' 
                              ? 'bg-yellow-500/20 text-yellow-400' 
                              : 'bg-red-500/20 text-red-400'
                        }`}>
                          {call.potential_rank}
                        </Badge>
                      ) : call.status === 'analyzed' && call.overall_score !== null ? (
                        <div className={`px-2 py-1 rounded text-sm font-medium ${
                          call.overall_score >= 80 ? 'bg-green-500/20 text-green-400' :
                          call.overall_score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {call.overall_score}%
                        </div>
                      ) : call.status === 'analyzing' ? (
                        <div className="px-2 py-1 rounded text-sm bg-blue-500/20 text-blue-400 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Analyzing
                        </div>
                      ) : (
                        <div className="px-2 py-1 rounded text-sm bg-muted text-muted-foreground">
                          Pending
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        {userRole !== 'staff' && (
          <TabsContent value="analytics" className="mt-6">
            <CallScoringAnalytics calls={analyticsCalls} teamMembers={teamMembers} />
          </TabsContent>
        )}
      </Tabs>
      
      <CallScorecard 
        call={selectedCall}
        open={scorecardOpen}
        onClose={() => setScorecardOpen(false)}
        isStaffUser={isStaffUser}
        staffTeamMemberId={staffTeamMemberId || undefined}
        acknowledgedAt={selectedCall?.acknowledged_at}
        staffFeedbackPositive={selectedCall?.staff_feedback_positive}
        staffFeedbackImprovement={selectedCall?.staff_feedback_improvement}
        onAcknowledge={handleStaffAcknowledge}
      />
    </div>
  );
}
