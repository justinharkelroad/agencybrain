import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, Upload, Clock, FileAudio, AlertCircle, Sparkles, Loader2, BarChart3, CheckCircle, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { HelpVideoButton } from '@/components/HelpVideoButton';
import { toast } from 'sonner';
import { CallScorecard } from '@/components/CallScorecard';
import { ServiceCallReportCard } from '@/components/call-scoring/ServiceCallReportCard';
import { CallScoringAnalytics } from '@/components/CallScoringAnalytics';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';

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
  skill_scores: any;
  discovery_wins: any;
  analyzed_at: string | null;
}

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'];
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/ogg', 'audio/mp4'];
const MAX_SIZE_MB = 100; // Allow up to 100MB (will be converted if > 25MB)
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const WHISPER_MAX_SIZE_MB = 25; // Files over this will be converted
const WHISPER_MAX_SIZE_BYTES = WHISPER_MAX_SIZE_MB * 1024 * 1024;
const MAX_DURATION_MINUTES = 75; // Maximum call duration

export default function CallScoring() {
  const { user, isAdmin } = useAuth();
  const { canUploadCallRecordings: ownerCanUpload, loading: permissionsLoading } = useUserPermissions();
  const { canUploadCallRecordings: staffCanUpload, isManager: isStaffManager, loading: staffPermissionsLoading } = useStaffPermissions();
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
    return () => {
      pollingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      pollingTimeoutsRef.current.clear();
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
        const staffRole = data.user.role === 'Manager' ? 'manager' : 'staff';
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

  // Staff data fetching function - extracted for reuse in polling
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
    
    // Staff need their team member ID; managers can see all calls (pass null)
    const isManager = userRole === 'manager';
    if (!isManager && !staffTeamMemberId) {
      console.log('No team member ID for staff, aborting fetch');
      return;
    }
    
    setLoading(true);
    
    // Managers pass null to see all agency calls; staff pass their team_member_id
    const { data, error } = await supabase.rpc('get_staff_call_scoring_data', {
      p_agency_id: staffAgencyId,
      p_team_member_id: isManager ? null : staffTeamMemberId,
      p_page: currentPage,
      p_page_size: CALLS_PER_PAGE
    });

    console.log('RPC response data:', data);
    console.log('RPC error:', error);
    console.log('Recent calls returned:', data?.recent_calls);
    console.log('Team members returned:', data?.team_members);
    console.log('Templates returned:', data?.templates);
    console.log('Usage returned:', data?.usage);
    console.log('Total calls returned:', data?.total_calls);

    if (data) {
      setTemplates(data.templates || []);
      setTeamMembers(data.team_members || []);
      setRecentCalls(data.recent_calls || []);
      setUsage(data.usage || { calls_used: 0, calls_limit: 20 });
      setTotalCalls(data.total_calls || 0);
      
      // Set analytics calls for managers
      if (isManager) {
        setAnalyticsCalls(data.analytics_calls || []);
      }
      
      // Auto-select team member for staff
      if (data.team_members?.length === 1) {
        setSelectedTeamMember(data.team_members[0].id);
      }
    }
    
    setLoading(false);
  }, [hasAccess, staffAgencyId, staffTeamMemberId, currentPage, userRole]);

  // Fetch data for staff users via RPC
  useEffect(() => {
    if (isStaffUser && hasAccess) {
      fetchStaffData();
    }
  }, [isStaffUser, hasAccess, fetchStaffData]);

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

  // Refetch when page changes (regular users)
  useEffect(() => {
    if (hasAccess && user && !isStaffUser && agencyId) {
      fetchUsageAndCalls(agencyId, userRole, userTeamMemberId);
    }
  }, [currentPage]);

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
            .eq('email', user!.email)
            .maybeSingle();

          console.log('Staff user lookup:', { staffUser, staffError, userId: user!.id, email: user!.email });
          
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
        const enrichedAnalytics: AnalyticsCall[] = analyticsData.map((call: any) => ({
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
  };

  const fetchFormData = async (agency: string, role: string, teamMemberId?: string | null) => {
    // Staff see only their own record; Managers see all team members (like owners)
    // Agency owners (role=user or null) and admins see all active team members
    let members: { id: string; name: string }[] = [];
    
    if (role === 'staff' && teamMemberId) {
      // Staff can only select themselves
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('id', teamMemberId)
        .single();
      
      console.log('Staff team member fetch:', { data, error, teamMemberId });
      if (data) members = [data];
    } else {
      // Managers, agency owners (role='user', 'admin', or null) see all active team members
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
        const { data: rpcData, error } = await supabase.rpc('get_staff_call_status', {
          p_call_id: callId,
          p_agency_id: originalAgencyId
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

  const handleCallClick = async (call: RecentCall | any) => {
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
        let fullCall = null;
        let error = null;

        if (isStaffManager) {
          // Managers: try to view any agency call first (requires updated RPC)
          const result = await supabase.rpc('get_staff_call_details', {
            p_call_id: call.id,
            p_team_member_id: null,
            p_agency_id: staffAgencyId
          });
          fullCall = result.data;
          error = result.error;

          // If that didn't work (old RPC version), try with their own team_member_id
          if (!fullCall && !error) {
            console.log('Manager agency-wide call failed, trying with own team_member_id...');
            const fallbackResult = await supabase.rpc('get_staff_call_details', {
              p_call_id: call.id,
              p_team_member_id: staffTeamMemberId
            });
            fullCall = fallbackResult.data;
            error = fallbackResult.error;
          }
        } else {
          // Regular staff: only view their own calls
          const result = await supabase.rpc('get_staff_call_details', {
            p_call_id: call.id,
            p_team_member_id: staffTeamMemberId
          });
          fullCall = result.data;
          error = result.error;
        }

        if (error) {
          console.error('Error fetching call details:', error);
          toast.error('Failed to load call details');
          setScorecardOpen(false);
          return;
        }

        console.log('Staff RPC full call:', fullCall);
        setSelectedCall(fullCall);
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
            call_type,
            team_members(id, name)
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
        
        // Merge with team member name
        const mergedCall = {
          ...fullCall,
          team_member_name: fullCall?.team_members?.name || call.team_member_name
        };
        console.log('Merged call for scorecard:', mergedCall);
        
        setSelectedCall(mergedCall);
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
      const { data: refreshData } = await supabase.rpc('get_staff_call_scoring_data', {
        p_agency_id: staffAgencyId,
        p_team_member_id: staffTeamMemberId,
        p_page: currentPage,
        p_page_size: CALLS_PER_PAGE
      });
      if (refreshData) {
        setRecentCalls(refreshData.recent_calls || []);
        setTotalCalls(refreshData.total_calls || 0);
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
            <HelpVideoButton videoKey="call_scoring" />
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

      {/* Tabs - hide Analytics for staff users (except managers) */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full max-w-md ${userRole === 'staff' && !isStaffManager ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {userRole === 'staff' ? 'My Calls' : 'Upload & Calls'}
          </TabsTrigger>
          {(userRole !== 'staff' || isStaffManager) && (
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
              Upload an audio file to analyze (MP3, WAV, M4A, OGG - up to 100MB)
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
                    MP3, WAV, M4A, OGG up to 100MB
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

        {(userRole !== 'staff' || isStaffManager) && (
          <TabsContent value="analytics" className="mt-6">
            <CallScoringAnalytics 
              calls={analyticsCalls} 
              teamMembers={teamMembers} 
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
        />
      )}
    </div>
  );
}
