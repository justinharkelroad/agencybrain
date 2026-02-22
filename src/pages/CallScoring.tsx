import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, Upload, Clock, FileAudio, AlertCircle, Sparkles, Loader2, BarChart3, CheckCircle, Lock, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { toast } from 'sonner';
import { CallScorecard } from '@/components/CallScorecard';
import { ServiceCallReportCard } from '@/components/call-scoring/ServiceCallReportCard';
import { CallScoringAnalytics } from '@/components/CallScoringAnalytics';
import { CallCoachingTab } from '@/components/call-scoring/CallCoachingTab';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';
import type { Database, Json } from '@/integrations/supabase/types';

interface UsageInfo {
  calls_used: number;
  calls_limit: number;
  period_end?: string | null;
  bonus_remaining?: number;
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
  call_type?: 'sales' | 'service' | null;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  staff_feedback_positive?: string | null;
  staff_feedback_improvement?: string | null;
}

interface AnalyticsCall {
  id: string;
  team_member_id: string;
  team_member_name: string;
  template_id: string;
  template_name: string;
  potential_rank: string | null;
  overall_score: number | null;
  skill_scores: Json | null;
  discovery_wins: Json | null;
  analyzed_at: string | null;
}

type TeamMemberOption = Pick<Database['public']['Tables']['team_members']['Row'], 'id' | 'name'>;
type TemplateOption = Pick<Database['public']['Tables']['call_scoring_templates']['Row'], 'id' | 'name'>;
type ScorecardCall = Database['public']['Tables']['agency_calls']['Row'] & {
  team_member_name?: string | null;
  call_scoring_templates?: {
    name?: string | null;
    skill_categories?: Json | null;
  } | null;
};
type AnalyticsRow = Pick<
  Database['public']['Tables']['agency_calls']['Row'],
  'id' | 'team_member_id' | 'template_id' | 'potential_rank' | 'overall_score' | 'skill_scores' | 'discovery_wins' | 'analyzed_at'
> & {
  call_scoring_templates: { name: string | null } | null;
};
type CallScoringError = { message?: string } | null;

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'];
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/ogg', 'audio/mp4'];
const MAX_SIZE_MB = 75; // Allow up to 75MB (will be converted if > 25MB)
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const WHISPER_MAX_SIZE_MB = 25; // Files over this will be converted
const WHISPER_MAX_SIZE_BYTES = WHISPER_MAX_SIZE_MB * 1024 * 1024;
const MAX_DURATION_MINUTES = 75; // Maximum call duration

// Session storage keys for caching state to survive tab switches
const CALL_SCORING_AGENCY_ID_KEY = 'call_scoring_agency_id';
const CALL_SCORING_TAB_KEY = 'call_scoring_active_tab';

export default function CallScoring() {
  const { user, isAdmin } = useAuth();
  const { canUploadCallRecordings: ownerCanUpload, loading: permissionsLoading } = useUserPermissions();
  const { canUploadCallRecordings: staffCanUpload, isManager: isStaffManager, loading: staffPermissionsLoading } = useStaffPermissions();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<UsageInfo>({ calls_used: 0, calls_limit: 20 });
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [analyticsCalls, setAnalyticsCalls] = useState<AnalyticsCall[]>([]);
  const [loading, setLoading] = useState(true);
  // Initialize from sessionStorage to survive remounts caused by auth state changes
  const [agencyId, setAgencyIdState] = useState<string | null>(() => {
    return sessionStorage.getItem(CALL_SCORING_AGENCY_ID_KEY);
  });
  const [activeTab, setActiveTabState] = useState(() => {
    return sessionStorage.getItem(CALL_SCORING_TAB_KEY) || 'upload';
  });
  const [userRole, setUserRole] = useState<string>('staff');
  const [userTeamMemberId, setUserTeamMemberId] = useState<string | null>(null);

  // Wrapper to persist agencyId to sessionStorage
  const setAgencyId = (id: string | null) => {
    if (id) {
      sessionStorage.setItem(CALL_SCORING_AGENCY_ID_KEY, id);
    } else {
      sessionStorage.removeItem(CALL_SCORING_AGENCY_ID_KEY);
    }
    setAgencyIdState(id);
  };

  // Wrapper to persist activeTab to sessionStorage
  const setActiveTab = (tab: string) => {
    sessionStorage.setItem(CALL_SCORING_TAB_KEY, tab);
    setActiveTabState(tab);
  };
  
  // Staff user detection - check localStorage for staff session token
  const [isStaffUser, setIsStaffUser] = useState(false);
  const [staffAgencyId, setStaffAgencyId] = useState<string | null>(null);
  const [staffTeamMemberId, setStaffTeamMemberId] = useState<string | null>(null);
  const [staffDataLoaded, setStaffDataLoaded] = useState(false);
  
  // Access control state
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [callScoringQaEnabled, setCallScoringQaEnabled] = useState(false);
  
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
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Split call state
  const [isSplitCall, setIsSplitCall] = useState(false);
  const [secondaryFile, setSecondaryFile] = useState<File | null>(null);
  const [secondaryFileError, setSecondaryFileError] = useState<string | null>(null);
  
  // Scorecard modal state
  const [selectedCall, setSelectedCall] = useState<ScorecardCall | null>(null);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [loadingCallDetails, setLoadingCallDetails] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCalls, setTotalCalls] = useState(0);
  const CALLS_PER_PAGE = 10;

  // SECURITY: Track polling timeouts for cleanup on logout/unmount
  const pollingTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const currentAgencyIdRef = useRef<string | null>(null);

  // Update agency ref when agencyId changes
  useEffect(() => {
    currentAgencyIdRef.current = agencyId;
  }, [agencyId]);

  // Clean up all polling timeouts on unmount
  useEffect(() => {
    const timeouts = pollingTimeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  // SECURITY: Clear polling on auth state change (logout)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        console.log('User signed out - clearing all polling timeouts');
        pollingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        pollingTimeoutsRef.current.clear();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Detect staff user by verifying session token (same as useStaffAuth hook)
  useEffect(() => {
    const detectStaffUser = async () => {
      console.log('=== CallScoring Staff Detection ===');
      const authMode = localStorage.getItem('auth_mode');
      if (authMode !== 'staff') {
        console.log('Auth mode is not staff, using owner/admin mode');
        setStaffDataLoaded(true);
        return;
      }

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
        // Set role based on team member role from session
        const normalizedStaffRole = (data.user.role || '').toLowerCase();
        const staffRole = normalizedStaffRole === 'manager' || normalizedStaffRole === 'owner'
          ? 'manager'
          : 'staff';
        setUserRole(staffRole);
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
      // Skip if already checked to prevent infinite loops
      if (accessChecked) return;

      // Wait for staff detection to complete
      if (!staffDataLoaded) return;

      // If not a staff user, skip
      if (!isStaffUser || !staffAgencyId) return;

      console.log('Checking staff access for agency:', staffAgencyId);
      const sessionToken = localStorage.getItem('staff_session_token');

      const { data: isEnabled, error } = await supabase
        .rpc('is_call_scoring_enabled', {
          p_agency_id: staffAgencyId,
          p_staff_session_token: sessionToken,
        });

      console.log('Staff call scoring access:', isEnabled, error);

      if (isEnabled) {
        setHasAccess(true);
        setAccessChecked(true);
      } else {
        setCallScoringQaEnabled(false);
        // Set checked BEFORE navigating to prevent re-checking
        setAccessChecked(true);
        toast.error('Call Scoring is not enabled for your agency');
        navigate('/staff/dashboard');
      }
    };

    if (staffDataLoaded && isStaffUser) {
      checkStaffAccess();
    }
  }, [staffDataLoaded, isStaffUser, staffAgencyId, navigate, accessChecked]);

  // Staff data fetching function - extracted for reuse in polling
  // Uses edge function with server-side session validation and role-based access control
  const fetchStaffData = useCallback(async () => {
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

    // Get session token for authenticated edge function call
    const sessionToken = localStorage.getItem('staff_session_token');
    if (!sessionToken) {
      console.log('No session token, aborting fetch');
      toast.error('Missing staff session. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Call edge function with server-side session validation
      // The edge function enforces role-based access: staff sees own calls, managers see all
      const { data, error } = await supabase.functions.invoke('get-staff-call-scoring-data', {
        body: { page: currentPage, pageSize: CALLS_PER_PAGE },
        headers: { 'x-staff-session': sessionToken }
      });

      console.log('Edge function response data:', data);
      console.log('Edge function error:', error);
      console.log('Recent calls returned:', data?.recent_calls);
      console.log('Team members returned:', data?.team_members);
      console.log('Templates returned:', data?.templates);
      console.log('Usage returned:', data?.usage);
      console.log('Total calls returned:', data?.total_calls);
      console.log('Is manager (server-determined):', data?.is_manager);

      if (error) {
        console.error('Failed to fetch call scoring data:', error);
        toast.error('Failed to load call scoring data');
        return;
      }

      // Check for error in response body (edge function returns errors in body)
      if (data?.error) {
        console.error('Call scoring data error:', data.error);
        if (data.error === 'User account is not active') {
          toast.error('Your account is not active. Please contact your administrator.');
        } else if (data.error === 'Invalid or expired session') {
          toast.error('Your session has expired. Please log in again.');
        } else {
          toast.error(data.error);
        }
        return;
      }

      if (data) {
        setTemplates((data.templates as TemplateOption[]) || []);
        setTeamMembers((data.team_members as TeamMemberOption[]) || []);
        setRecentCalls(data.recent_calls || []);
        setUsage(data.usage || { calls_used: 0, calls_limit: 20 });
        setTotalCalls(data.total_calls || 0);
        setCallScoringQaEnabled(Boolean(data.has_call_scoring_qa));

        // Set analytics calls for managers (server determines manager status)
        if (data.is_manager) {
          setAnalyticsCalls(data.analytics_calls || []);
        }

        // Auto-select team member for staff
        if (data.team_members?.length === 1) {
          setSelectedTeamMember(data.team_members[0].id);
        }
      }
    } catch (err) {
      console.error('Unexpected error while fetching staff call scoring data:', err);
      toast.error('Failed to load call scoring data');
    } finally {
      setLoading(false);
    }
  }, [hasAccess, staffAgencyId, staffTeamMemberId, currentPage]);

  // Fetch data for staff users via RPC
  useEffect(() => {
    if (isStaffUser && hasAccess) {
      fetchStaffData();
    }
  }, [isStaffUser, hasAccess, fetchStaffData]);

  // Check access for regular users on mount
  useEffect(() => {
    const checkAccess = async () => {
      // Skip if already checked to prevent infinite loops
      if (accessChecked) return;

      // Skip if staff user (handled separately)
      if (isStaffUser) return;
      if (!user) return;

      // Admins always have access to the page
      if (isAdmin) {
        setHasAccess(true);
        setAccessChecked(true);

        // Still check if the admin's agency actually has QA enabled
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .single();

        if (adminProfile?.agency_id) {
          const { data: callScoringQaFeature } = await supabase
            .from('agency_feature_access')
            .select('id')
            .eq('agency_id', adminProfile.agency_id)
            .eq('feature_key', 'call_scoring_qa')
            .maybeSingle();
          setCallScoringQaEnabled(Boolean(callScoringQaFeature?.id));
        }
        return;
      }

      // For non-admins, check if their agency has it enabled
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (profile?.agency_id) {
        const [{ data: settings }, { data: callScoringQaFeature }] = await Promise.all([
          supabase
            .from('agency_call_scoring_settings')
            .select('enabled')
            .eq('agency_id', profile.agency_id)
            .maybeSingle(),
          supabase
            .from('agency_feature_access')
            .select('id')
            .eq('agency_id', profile.agency_id)
            .eq('feature_key', 'call_scoring_qa')
            .maybeSingle(),
        ]);

        setCallScoringQaEnabled(Boolean(callScoringQaFeature?.id));

        if (settings?.enabled) {
          setHasAccess(true);
          setAccessChecked(true);
        } else {
          setCallScoringQaEnabled(false);
          // Set checked BEFORE navigating to prevent re-checking
          setAccessChecked(true);
          toast.error('Call Scoring is not enabled for your agency');
          navigate('/');
        }
      } else {
        setCallScoringQaEnabled(false);
        setAccessChecked(true);
        toast.error('No agency found');
        navigate('/');
      }
    };

    checkAccess();
  }, [user, isAdmin, navigate, isStaffUser, accessChecked]);

  const fetchUsageAndCalls = useCallback(async (agency: string, role: string, teamMemberId?: string | null) => {
    setLoading(true);
    
    try {
      // Fetch usage using the new RPC function
      const { data: usageData } = await supabase
        .rpc('check_and_reset_call_usage', { p_agency_id: agency });
      
      // Also fetch bonus balance
      const { data: balanceData } = await supabase
        .from('agency_call_balance')
        .select('bonus_calls_remaining, bonus_calls_expires_at')
        .eq('agency_id', agency)
        .single();

      const bonusRemaining = (balanceData?.bonus_calls_expires_at && new Date(balanceData.bonus_calls_expires_at) > new Date())
        ? (balanceData?.bonus_calls_remaining || 0)
        : 0;

      if (usageData && usageData[0]) {
        setUsage({
          calls_used: usageData[0].calls_used || 0,
          calls_limit: usageData[0].calls_limit || 20,
          period_end: usageData[0].period_end,
          bonus_remaining: bonusRemaining,
        });
      } else {
        setUsage({ calls_used: 0, calls_limit: 20, bonus_remaining: bonusRemaining });
      }

      // Calculate pagination offset
      const offset = (currentPage - 1) * CALLS_PER_PAGE;

      // First get total count for pagination
      let countQuery = supabase
        .from('agency_calls')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agency);
      
      // Apply role-based filtering for count
      // Staff see only their own calls; Managers see all agency calls (like owners)
      if (role === 'staff' && teamMemberId) {
        countQuery = countQuery.eq('team_member_id', teamMemberId);
      }
      
      const { count } = await countQuery;
      setTotalCalls(count || 0);

      // Build base query for recent calls - include acknowledgment fields and call_type
      let callsQuery = supabase
        .from('agency_calls')
        .select('id, original_filename, call_duration_seconds, status, overall_score, potential_rank, created_at, team_member_id, call_type, acknowledged_at, acknowledged_by, staff_feedback_positive, staff_feedback_improvement')
        .eq('agency_id', agency)
        .order('created_at', { ascending: false })
        .range(offset, offset + CALLS_PER_PAGE - 1);

      // Build base query for analytics - include template_id and template name
      let analyticsQuery = supabase
        .from('agency_calls')
        .select('id, team_member_id, template_id, potential_rank, overall_score, skill_scores, discovery_wins, analyzed_at, call_scoring_templates(name)')
        .eq('agency_id', agency)
        .not('analyzed_at', 'is', null)
        .order('analyzed_at', { ascending: false });

      // Apply role-based filtering
      // Staff see only their own calls; Managers see all agency calls (like owners)
      // Agency owners (role=user or null) and admins see all agency calls
      if (role === 'staff' && teamMemberId) {
        callsQuery = callsQuery.eq('team_member_id', teamMemberId);
        analyticsQuery = analyticsQuery.eq('team_member_id', teamMemberId);
      }
      // Managers, agency owners (role='user' or null) and admins see all calls for the agency

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
          call_type: call.call_type as 'sales' | 'service' | null,
          acknowledged_at: call.acknowledged_at,
          acknowledged_by: call.acknowledged_by,
          staff_feedback_positive: call.staff_feedback_positive,
          staff_feedback_improvement: call.staff_feedback_improvement
        }));
        setRecentCalls(enrichedCalls);
      } else {
        setRecentCalls([]);
      }

      // Enrich analytics calls with team member names and template info
      if (analyticsData && analyticsData.length > 0) {
        const enrichedAnalytics: AnalyticsCall[] = (analyticsData as AnalyticsRow[]).map((call: AnalyticsRow) => ({
          id: call.id,
          team_member_id: call.team_member_id,
          team_member_name: memberMap.get(call.team_member_id) || 'Unknown',
          template_id: call.template_id,
          template_name: call.call_scoring_templates?.name || 'Unknown Template',
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
  }, [currentPage]);

  const fetchFormData = useCallback(async (agency: string, role: string, teamMemberId?: string | null) => {
    // Staff see only their own record; Managers see all team members (like owners)
    // Agency owners (role=user or null) and admins see all active team members
    let members: TeamMemberOption[] = [];
    
    if (role === 'staff' && teamMemberId) {
      // Staff can only select themselves
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('id', teamMemberId)
        .single();
      
      console.log('Staff team member fetch:', { data, error, teamMemberId });
      if (data) members = [data as TeamMemberOption];
    } else {
      // Managers, agency owners (role='user', 'admin', or null) see all active team members
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('agency_id', agency)
        .eq('status', 'active')
        .order('name');
      
      console.log('All team members fetch:', { data, error, agency });
      members = (data as TeamMemberOption[]) || [];
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
      ...((globalTemplates as TemplateOption[]) || []),
      ...((agencyTemplates as TemplateOption[]) || [])
    ];
    
    setTemplates(allTemplates);
  }, []);

  const fetchAgencyAndData = useCallback(async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id, role')
        .eq('id', user.id)
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
            .eq('email', user.email)
            .maybeSingle();

          console.log('Staff user lookup:', { staffUser, staffError, userId: user.id, email: user.email });
          
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
  }, [user, fetchUsageAndCalls, fetchFormData]);

  // Fetch data once access is confirmed (regular users only)
  useEffect(() => {
    if (hasAccess && user && !isStaffUser) {
      fetchAgencyAndData();
    }
  }, [hasAccess, user, isStaffUser, fetchAgencyAndData]);

  // Refetch when page changes (regular users)
  useEffect(() => {
    if (hasAccess && user && !isStaffUser && agencyId) {
      fetchUsageAndCalls(agencyId, userRole, userTeamMemberId);
    }
  }, [currentPage, hasAccess, user, isStaffUser, agencyId, userRole, userTeamMemberId, fetchUsageAndCalls]);

  const handleFileSelect = async (file: File | null) => {
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

    // For large files (> 25MB), check duration before accepting
    if (file.size > WHISPER_MAX_SIZE_BYTES) {
      try {
        const audioContext = new AudioContext();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const durationMinutes = audioBuffer.duration / 60;
        
        audioContext.close();
        
        if (durationMinutes > MAX_DURATION_MINUTES) {
          setFileError(`Call recordings over ${MAX_DURATION_MINUTES} minutes cannot be processed.`);
          setSelectedFile(null);
          return;
        }
        
        // Show info message for large files
        toast.info("This file is larger and may take a couple extra minutes to process.", {
          duration: 5000,
        });
      } catch (err) {
        console.error('Error checking audio duration:', err);
        // Allow file if we can't check duration - server will validate
      }
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

  // Secondary file handlers for split calls
  const handleSecondaryFileSelect = async (file: File | null) => {
    setSecondaryFileError(null);

    if (!file) {
      setSecondaryFile(null);
      return;
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension) && !ALLOWED_TYPES.includes(file.type)) {
      setSecondaryFileError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      setSecondaryFile(null);
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setSecondaryFileError(`File too large. Maximum size: ${MAX_SIZE_MB}MB`);
      setSecondaryFile(null);
      return;
    }

    // For large files (> 25MB), check duration before accepting
    if (file.size > WHISPER_MAX_SIZE_BYTES) {
      try {
        const audioContext = new AudioContext();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const durationMinutes = audioBuffer.duration / 60;

        audioContext.close();

        if (durationMinutes > MAX_DURATION_MINUTES) {
          setSecondaryFileError(`Call recordings over ${MAX_DURATION_MINUTES} minutes cannot be processed.`);
          setSecondaryFile(null);
          return;
        }

        toast.info("This file is larger and may take a couple extra minutes to process.", {
          duration: 5000,
        });
      } catch (err) {
        console.error('Error checking audio duration:', err);
      }
    }

    setSecondaryFile(file);
  };

  const handleSecondaryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleSecondaryFileSelect(file);
  };

  const handleSecondaryFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleSecondaryFileSelect(file);
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

  const effectiveLimit = usage.calls_limit + (usage.bonus_remaining || 0);
  const canUpload = selectedFile && selectedTeamMember && selectedTemplate &&
    usage.calls_used < effectiveLimit &&
    (!isSplitCall || secondaryFile);

  const handleUpload = async () => {
    if (!canUpload || !selectedFile || !agencyId) return;

    // Get team member name for display
    const selectedMember = teamMembers.find(m => m.id === selectedTeamMember);
    const teamMemberName = selectedMember?.name || 'Unknown';

    // Generate temp ID for tracking
    const tempId = crypto.randomUUID();

    // Capture current values before resetting
    const fileToUpload = selectedFile;
    const secondaryFileToUpload = isSplitCall ? secondaryFile : null;
    const teamMemberId = selectedTeamMember;
    const templateId = selectedTemplate;
    const currentAgencyId = agencyId;
    const fileName = isSplitCall && secondaryFile
      ? `${selectedFile.name} + ${secondaryFile.name}`
      : selectedFile.name;
    const currentIsSplitCall = isSplitCall;

    // Add to processing queue IMMEDIATELY
    setProcessingCalls(prev => [...prev, {
      id: tempId,
      fileName: fileName,
      teamMemberName: teamMemberName,
      startedAt: new Date(),
    }]);

    // Reset form
    setSelectedFile(null);
    setSecondaryFile(null);
    setIsSplitCall(false);
    setSelectedTeamMember('');
    setSelectedTemplate('');

    // Process in background (don't await)
    if (currentIsSplitCall && secondaryFileToUpload) {
      processSplitCallInBackground(fileToUpload, secondaryFileToUpload, teamMemberId, templateId, currentAgencyId, tempId, fileName);
    } else {
      processCallInBackground(fileToUpload, teamMemberId, templateId, currentAgencyId, tempId, fileToUpload.name);
    }
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
      // STEP 1: Generate unique call ID and storage path
      let callId = crypto.randomUUID();
      let storagePath = `${agencyIdParam}/${callId}/${file.name}`;

      // Check if this is a staff user upload (staff users don't have Supabase Auth sessions)
      const staffToken = localStorage.getItem('staff_session_token');

      if (staffToken) {
        // STAFF USER: Get signed upload URL from edge function (bypasses RLS)
        console.log('Staff mode detected - using signed upload URL');
        
        const response = await fetch(
          `https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/get_staff_upload_url`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-staff-session': staffToken,
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcXljY2J5dGN0cXdjZXVoemhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjQwODEsImV4cCI6MjA2OTg0MDA4MX0.GN9SjnDf3jwFTzsO_83ZYe4iqbkRQJutGZJtapq6-Tw',
            },
            body: JSON.stringify({
              fileName: file.name,
              contentType: file.type || 'audio/wav',
              agencyId: agencyIdParam,
            }),
          }
        );

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(`Failed to get upload URL: ${errData.error}`);
        }

        const signedUrlData = await response.json();
        callId = signedUrlData.callId;
        storagePath = signedUrlData.storagePath;

        // Upload using signed URL
        const uploadResponse = await fetch(signedUrlData.signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'audio/wav',
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Storage upload failed: ${uploadResponse.statusText}`);
        }
        
        console.log('Staff upload successful via signed URL:', storagePath);
      } else {
        // AUTHENTICATED USER: Direct upload to Supabase Storage
        const { error: storageError } = await supabase.storage
          .from('call-recordings')
          .upload(storagePath, file, {
            contentType: file.type || 'audio/wav',
          });

        if (storageError) {
          throw new Error(`Storage upload failed: ${storageError.message}`);
        }
      }

      // STEP 3: Call edge function with JSON (NOT FormData) - only the path
      const { data, error } = await supabase.functions.invoke('transcribe-call', {
        body: {
          storagePath,
          originalFilename: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type || 'audio/wav',
          callId,
          agencyId: agencyIdParam,
          teamMemberId,
          templateId,
        }
      });

      // Remove from processing queue
      setProcessingCalls(prev => prev.filter(c => c.id !== tempId));

      if (error) {
        console.error('Transcription error:', error);
        toast.error(`Failed to process "${fileName}"`);
        return;
      }

      console.log('Transcription complete:', data);
      
      // Refresh the calls list to show new entry (reset to page 1 to see it)
      setCurrentPage(1);
      
      if (isStaffUser && hasAccess) {
        // Staff users: use RPC-based data fetch
        await fetchStaffData();
      } else if (agencyId) {
        // Authenticated users: use direct query
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

  // Background function for split calls (two audio files merged into one)
  const processSplitCallInBackground = async (
    file1: File,
    file2: File,
    teamMemberId: string,
    templateId: string,
    agencyIdParam: string,
    tempId: string,
    displayFileName: string
  ) => {
    try {
      // Generate unique call ID and storage paths for both files
      const callId = crypto.randomUUID();
      let storagePath1 = `${agencyIdParam}/${callId}/part1_${file1.name}`;
      let storagePath2 = `${agencyIdParam}/${callId}/part2_${file2.name}`;

      const staffToken = localStorage.getItem('staff_session_token');

      if (staffToken) {
        // STAFF USER: Get signed upload URLs for both files
        console.log('Staff mode detected - using signed upload URLs for split call');

        // Get signed URL for file 1
        const response1 = await fetch(
          `https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/get_staff_upload_url`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-staff-session': staffToken,
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcXljY2J5dGN0cXdjZXVoemhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjQwODEsImV4cCI6MjA2OTg0MDA4MX0.GN9SjnDf3jwFTzsO_83ZYe4iqbkRQJutGZJtapq6-Tw',
            },
            body: JSON.stringify({
              fileName: `part1_${file1.name}`,
              contentType: file1.type || 'audio/wav',
              agencyId: agencyIdParam,
            }),
          }
        );

        if (!response1.ok) {
          const errData = await response1.json();
          throw new Error(`Failed to get upload URL for Part 1: ${errData.error}`);
        }

        const signedUrlData1 = await response1.json();
        storagePath1 = signedUrlData1.storagePath;

        // Get signed URL for file 2
        const response2 = await fetch(
          `https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/get_staff_upload_url`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-staff-session': staffToken,
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcXljY2J5dGN0cXdjZXVoemhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjQwODEsImV4cCI6MjA2OTg0MDA4MX0.GN9SjnDf3jwFTzsO_83ZYe4iqbkRQJutGZJtapq6-Tw',
            },
            body: JSON.stringify({
              fileName: `part2_${file2.name}`,
              contentType: file2.type || 'audio/wav',
              agencyId: agencyIdParam,
            }),
          }
        );

        if (!response2.ok) {
          const errData = await response2.json();
          throw new Error(`Failed to get upload URL for Part 2: ${errData.error}`);
        }

        const signedUrlData2 = await response2.json();
        storagePath2 = signedUrlData2.storagePath;

        // Upload both files in parallel
        const [uploadResponse1, uploadResponse2] = await Promise.all([
          fetch(signedUrlData1.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file1.type || 'audio/wav' },
            body: file1,
          }),
          fetch(signedUrlData2.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file2.type || 'audio/wav' },
            body: file2,
          }),
        ]);

        if (!uploadResponse1.ok) {
          throw new Error(`Storage upload failed for Part 1: ${uploadResponse1.statusText}`);
        }
        if (!uploadResponse2.ok) {
          throw new Error(`Storage upload failed for Part 2: ${uploadResponse2.statusText}`);
        }

        console.log('Staff split call upload successful via signed URLs');
      } else {
        // AUTHENTICATED USER: Direct upload to Supabase Storage
        const [result1, result2] = await Promise.all([
          supabase.storage.from('call-recordings').upload(storagePath1, file1, {
            contentType: file1.type || 'audio/wav',
          }),
          supabase.storage.from('call-recordings').upload(storagePath2, file2, {
            contentType: file2.type || 'audio/wav',
          }),
        ]);

        if (result1.error) {
          throw new Error(`Storage upload failed for Part 1: ${result1.error.message}`);
        }
        if (result2.error) {
          throw new Error(`Storage upload failed for Part 2: ${result2.error.message}`);
        }
      }

      // Call transcribe-split-call edge function
      const { data, error } = await supabase.functions.invoke('transcribe-split-call', {
        body: {
          storagePath1,
          storagePath2,
          originalFilename1: file1.name,
          originalFilename2: file2.name,
          fileSizeBytes1: file1.size,
          fileSizeBytes2: file2.size,
          mimeType1: file1.type || 'audio/wav',
          mimeType2: file2.type || 'audio/wav',
          callId,
          agencyId: agencyIdParam,
          teamMemberId,
          templateId,
        }
      });

      // Remove from processing queue
      setProcessingCalls(prev => prev.filter(c => c.id !== tempId));

      if (error) {
        console.error('Split call transcription error:', error);
        toast.error(`Failed to process split call`);
        return;
      }

      console.log('Split call transcription complete:', data);

      // Refresh the calls list
      setCurrentPage(1);

      if (isStaffUser && hasAccess) {
        await fetchStaffData();
      } else if (agencyId) {
        fetchUsageAndCalls(agencyId, userRole, userTeamMemberId);
      }

      toast.success(`Split call uploaded! Analysis in progress...`);

      // Poll for analysis completion
      if (data.call_id) {
        pollForAnalysis(data.call_id, displayFileName);
      }

    } catch (err) {
      console.error('Split call background processing error:', err);
      setProcessingCalls(prev => prev.filter(c => c.id !== tempId));
      toast.error(`Failed to process split call`);
    }
  };

  // Poll to notify when analysis is done
  // SECURITY: Track timeouts and validate agency before showing toast
  const pollForAnalysis = (callId: string, fileName: string, callAgencyId?: string) => {
    // Capture the agency at time of upload for validation
    const originalAgencyId = callAgencyId || agencyId;
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 3 seconds = 90 seconds max
    
    const checkStatus = async () => {
      // SECURITY: Verify user is still in same agency before showing toast
      if (currentAgencyIdRef.current !== originalAgencyId) {
        console.log('Agency changed during polling - skipping toast notification');
        return;
      }
      
      attempts++;
      
      let data: { status?: string; overall_score?: number | null; agency_id?: string } | null = null;
      
      if (isStaffUser) {
        // Staff users: use RPC to bypass RLS
        const sessionToken = localStorage.getItem('staff_session_token');
        const { data: rpcData, error } = await supabase.rpc('get_staff_call_status', {
          p_call_id: callId,
          p_agency_id: originalAgencyId,
          p_staff_session_token: sessionToken,
        });
        
        if (!error && rpcData) {
          data = rpcData;
        }
      } else {
        // Authenticated users: direct query
        const { data: directData } = await supabase
          .from('agency_calls')
          .select('status, overall_score, agency_id')
          .eq('id', callId)
          .single();
        
        data = directData;
      }

      // SECURITY: Double-check agency_id matches before showing toast
      if (data?.status === 'analyzed' && data?.overall_score !== null) {
        if (currentAgencyIdRef.current === originalAgencyId && data.agency_id === originalAgencyId) {
          toast.success(`"${fileName}" analysis complete: ${data.overall_score}`, {
            duration: 5000,
          });
          
          // Refresh calls list based on user type
          if (isStaffUser && hasAccess) {
            // Staff users: use RPC-based data fetch
            await fetchStaffData();
          } else if (agencyId) {
            // Authenticated users: use direct query
            fetchUsageAndCalls(agencyId, userRole, userTeamMemberId);
          }
        }
        return;
      }

      if (attempts < maxAttempts) {
        const timeout = setTimeout(checkStatus, 3000);
        pollingTimeoutsRef.current.add(timeout);
      }
    };

    // Start polling after a short delay - TRACK this timeout too
    const initialTimeout = setTimeout(checkStatus, 5000);
    pollingTimeoutsRef.current.add(initialTimeout);
  };

  const handleCallClick = async (call: RecentCall) => {
    console.log('=== Call clicked ===');
    console.log('Call ID:', call.id);
    
    // Open modal immediately with loading state
    setScorecardOpen(true);
    setLoadingCallDetails(true);
    
    try {
      if (isStaffUser) {
        // Staff users use RPC to bypass RLS
        console.log('Staff user - fetching full call via RPC...', { isStaffManager, staffTeamMemberId, staffAgencyId });

        // For staff viewing their own calls, use their team_member_id
        // For managers viewing other calls, try with agency_id first, fallback to team_member_id for their own
        let fullCall: ScorecardCall | null = null;
        let error: CallScoringError = null;

        if (isStaffManager) {
          const sessionToken = localStorage.getItem('staff_session_token');
          // Managers: try to view any agency call first (requires updated RPC)
          const result = await supabase.rpc('get_staff_call_details', {
            p_call_id: call.id,
            p_team_member_id: null,
            p_agency_id: staffAgencyId,
            p_staff_session_token: sessionToken,
          });
          fullCall = result.data;
          error = result.error;

          // If that didn't work (old RPC version or no match), try with their own team_member_id
          if (!fullCall) {
            console.log('Manager agency-wide call failed, trying with own team_member_id...');
            const fallbackResult = await supabase.rpc('get_staff_call_details', {
              p_call_id: call.id,
              p_team_member_id: staffTeamMemberId,
              p_staff_session_token: sessionToken,
            });
            fullCall = fallbackResult.data;
            error = fallbackResult.error;
          }
        } else {
          const sessionToken = localStorage.getItem('staff_session_token');
          // Regular staff: only view their own calls
          const result = await supabase.rpc('get_staff_call_details', {
            p_call_id: call.id,
            p_team_member_id: staffTeamMemberId,
            p_staff_session_token: sessionToken,
          });
          fullCall = result.data;
          error = result.error;
        }

        if (!fullCall) {
          const detailError = error ? new Error(`Could not load call details: ${error.message}`) : new Error('Call details were not returned by the server.');
          console.error(detailError);
          toast.error('Failed to load call details');
          setScorecardOpen(false);
          return;
        }

        if (error) {
          console.error('Error fetching call details:', error);
          toast.error('Failed to load call details');
          setScorecardOpen(false);
          return;
        }

        console.log('Staff RPC full call:', fullCall);
        // Preserve team_member_name from the original call if RPC didn't return it
        setSelectedCall({
          ...fullCall,
          team_member_name: fullCall?.team_member_name || call.team_member_name
        } as ScorecardCall);
      } else {
        // Regular users fetch directly from database
        console.log('Regular user - fetching full call from database...');
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
            transcript_segments,
            created_at,
            analyzed_at,
            acknowledged_at,
            acknowledged_by,
            staff_feedback_positive,
            staff_feedback_improvement,
            agent_talk_seconds,
            customer_talk_seconds,
            dead_air_seconds,
            agent_talk_percent,
            customer_talk_percent,
            dead_air_percent,
            team_member_id,
            template_id,
            call_type,
            team_members(id, name),
            call_scoring_templates(name, skill_categories)
          `)
          .eq('id', call.id)
          .single();
        
        console.log('Fetched full call:', fullCall);
        
        if (error) {
          console.error('Error fetching call details:', error);
          toast.error('Failed to load call details');
          setScorecardOpen(false);
          return;
        }

        if (!fullCall) {
          console.error('Fetched full call is null with no error');
          toast.error('Call details were not found');
          setScorecardOpen(false);
          return;
        }
        
        // Merge with team member name
        const mergedCall = {
          ...fullCall,
          team_member_name: fullCall?.team_members?.name || call.team_member_name
        };
        console.log('Merged call for scorecard:', mergedCall);
        
        setSelectedCall(mergedCall as ScorecardCall);
      }
    } finally {
      setLoadingCallDetails(false);
    }
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
      const sessionToken = localStorage.getItem('staff_session_token');
      const { data: refreshData } = await supabase.rpc('get_staff_call_scoring_data', {
        p_agency_id: staffAgencyId,
        p_team_member_id: staffTeamMemberId,
        p_page: currentPage,
        p_page_size: CALLS_PER_PAGE,
        p_staff_session_token: sessionToken,
      });
      if (refreshData) {
        setRecentCalls(refreshData.recent_calls || []);
        setTotalCalls(refreshData.total_calls || 0);
      }
    } else if (agencyId) {
      fetchUsageAndCalls(agencyId, userRole, userTeamMemberId);
    }
  };

  // Tab access guard: analytics and compare-coach require manager/owner/admin
  const canSeeAdvancedTabs = userRole !== 'staff' || isStaffManager;
  useEffect(() => {
    if ((activeTab === 'analytics' || activeTab === 'compare-coach') && !canSeeAdvancedTabs) {
      setActiveTab('upload');
    }
  }, [activeTab, canSeeAdvancedTabs]);

  // Show loading while checking access
  if (!accessChecked) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-xl w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <h2 className="text-lg font-semibold">Call Scoring unavailable</h2>
            <p className="text-sm text-muted-foreground">
              You currently do not have access to Call Scoring. Ask your agency admin to enable it in
              the One-on-One client access settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header with Usage Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            Call Scoring
            <HelpButton videoKey="call_scoring" />
          </h1>
          <p className="text-muted-foreground">
            Upload sales calls for AI-powered coaching analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(usage.bonus_remaining || 0) > 0 && (
            <Badge variant="outline" className="text-sm px-3 py-1 border-emerald-500/30 text-emerald-500">
              +{usage.bonus_remaining} bonus
            </Badge>
          )}
          <Badge variant="outline" className="text-sm px-3 py-1">
            {usage.calls_used} / {usage.calls_limit + (usage.bonus_remaining || 0)} calls
            {usage.period_end && (
              <span className="ml-2 text-muted-foreground">• Resets {new Date(usage.period_end).toLocaleDateString()}</span>
            )}
          </Badge>
        </div>
      </div>

      {/* Tabs - hide Analytics for staff users (except managers) */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${canSeeAdvancedTabs ? 'max-w-xl grid-cols-3' : 'max-w-lg grid-cols-1'}`}>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {userRole === 'staff' ? 'My Calls' : 'Upload & Calls'}
          </TabsTrigger>
          {canSeeAdvancedTabs && (
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          )}
          {canSeeAdvancedTabs && (
            <TabsTrigger value="compare-coach" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Coaching
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
              Upload an audio file to analyze (MP3, WAV, M4A, OGG - up to 75MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Check upload permission - staff users use staffCanUpload, owners use ownerCanUpload */}
            {((isStaffUser && !staffCanUpload) || (!isStaffUser && !ownerCanUpload && !isAdmin)) ? (
              <div className="text-center p-8 text-muted-foreground">
                <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Call recording uploads are disabled for your account.</p>
                <p className="text-sm mt-2">Contact your agency owner to request access.</p>
              </div>
            ) : (
            <>
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
                    MP3, WAV, M4A, OGG up to 75MB
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

            {/* Split Call Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="split-call"
                checked={isSplitCall}
                onCheckedChange={(checked) => {
                  setIsSplitCall(checked === true);
                  if (!checked) {
                    setSecondaryFile(null);
                    setSecondaryFileError(null);
                  }
                }}
              />
              <label
                htmlFor="split-call"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                This call is split across two recordings
              </label>
            </div>

            {/* Secondary File Dropzone (for split calls) */}
            {isSplitCall && (
              <>
                <div className="text-sm text-muted-foreground mb-2">
                  Part 2 Recording
                </div>
                <div
                  onDrop={handleSecondaryDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                    ${secondaryFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}
                    ${secondaryFileError ? 'border-destructive bg-destructive/5' : ''}`}
                  onClick={() => document.getElementById('secondary-file-input')?.click()}
                >
                  <input
                    id="secondary-file-input"
                    type="file"
                    accept=".mp3,.wav,.m4a,.ogg,audio/*"
                    onChange={handleSecondaryFileInputChange}
                    className="hidden"
                  />

                  {secondaryFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <FileAudio className="h-8 w-8" />
                      </div>
                      <p className="font-medium">{secondaryFile.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(secondaryFile.size)}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSecondaryFile(null);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground/50" />
                      <p className="text-muted-foreground">
                        Drag & drop Part 2, or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        MP3, WAV, M4A, OGG up to 75MB
                      </p>
                    </div>
                  )}
                </div>

                {secondaryFileError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {secondaryFileError}
                  </p>
                )}
              </>
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
            {usage.calls_used >= effectiveLimit && (
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
            </>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Calls
            </CardTitle>
            <CardDescription>
              {totalCalls > 0 
                ? `Showing ${recentCalls.length} of ${totalCalls} calls`
                : 'Your analyzed calls'
              }
            </CardDescription>
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
                      {/* Status Badge - prioritize score over rank */}
                      {call.status === 'analyzed' && call.overall_score !== null && call.overall_score > 0 ? (
                        <div className={`px-2 py-1 rounded text-sm font-medium ${
                          call.call_type === 'service'
                            ? (call.overall_score >= 8 ? 'bg-green-500/20 text-green-400' :
                               call.overall_score >= 6 ? 'bg-yellow-500/20 text-yellow-400' :
                               call.overall_score >= 4 ? 'bg-orange-500/20 text-orange-400' :
                               'bg-red-500/20 text-red-400')
                            : (call.overall_score >= 80 ? 'bg-green-500/20 text-green-400' :
                               call.overall_score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                               call.overall_score >= 40 ? 'bg-orange-500/20 text-orange-400' :
                               'bg-red-500/20 text-red-400')
                        }`}>
                          {call.call_type === 'service' 
                            ? `${call.overall_score}/10`
                            : `${call.overall_score}%`
                          }
                        </div>
                      ) : call.status === 'analyzed' && call.potential_rank ? (
                        <Badge className={`text-xs ${
                          call.potential_rank === 'VERY HIGH' || call.potential_rank === 'HIGH' 
                            ? 'bg-green-500/20 text-green-400' 
                            : call.potential_rank === 'MEDIUM' 
                              ? 'bg-yellow-500/20 text-yellow-400' 
                              : 'bg-red-500/20 text-red-400'
                        }`}>
                          {call.potential_rank}
                        </Badge>
                      ) : call.status === 'analyzed' ? (
                        <div className="px-2 py-1 rounded text-sm bg-muted text-muted-foreground">
                          Analyzed
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
                
                {/* Pagination Controls */}
                {totalCalls > CALLS_PER_PAGE && (
                  <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1 || loading}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {Math.ceil(totalCalls / CALLS_PER_PAGE)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= Math.ceil(totalCalls / CALLS_PER_PAGE) || loading}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        {canSeeAdvancedTabs && (
          <TabsContent value="analytics" className="mt-6">
            <CallScoringAnalytics
              calls={analyticsCalls}
              teamMembers={teamMembers}
            />
          </TabsContent>
        )}

        {canSeeAdvancedTabs && agencyId && (
          <TabsContent value="compare-coach" className="mt-6">
            <CallCoachingTab
              analyticsCalls={analyticsCalls}
              teamMembers={teamMembers}
              agencyId={agencyId}
              isStaffUser={isStaffUser}
            />
          </TabsContent>
        )}

      </Tabs>
      
      {selectedCall?.call_type === 'service' ? (
        <ServiceCallReportCard
          call={selectedCall}
          open={scorecardOpen}
          onClose={() => setScorecardOpen(false)}
          isReadOnly={false}
          qaEnabled={callScoringQaEnabled && !(isStaffUser && !isStaffManager)}
          isStaffUser={isStaffUser}
          staffTeamMemberId={staffTeamMemberId || undefined}
          acknowledgedAt={selectedCall?.acknowledged_at}
          staffFeedbackPositive={selectedCall?.staff_feedback_positive}
          staffFeedbackImprovement={selectedCall?.staff_feedback_improvement}
          onAcknowledge={handleStaffAcknowledge}
        />
      ) : (
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
          loading={loadingCallDetails}
          qaEnabled={callScoringQaEnabled && !(isStaffUser && !isStaffManager)}
        />
      )}
    </div>
  );
}
