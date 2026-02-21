
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Edit, Plus, Trash2, ArrowRight, Building2, Users, FileText, ShieldCheck, Eye, EyeOff, Key, UserX, UserCheck, Mail, Send, RefreshCw, Clock, Loader2, Settings, Target, AlertTriangle, CircleHelp, Upload, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LeadSourceManager } from "@/components/FormBuilder/LeadSourceManager";
import { PolicyTypeManager } from "@/components/PolicyTypeManager";
import { BrokeredCarriersManager } from "@/components/settings/BrokeredCarriersManager";
import { PriorInsuranceCompaniesManager } from "@/components/settings/PriorInsuranceCompaniesManager";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AgencyTemplatesManager } from "@/components/checklists/AgencyTemplatesManager";
import { UploadsContent } from "@/components/UploadsContent";
import { HelpButton } from '@/components/HelpButton';
import { ProcessVaultContent } from "@/components/ProcessVaultContent";
import { SavedReportsHistory } from "@/components/reports/SavedReportsHistory";
import { MeetingFrameTab } from "@/components/agency/MeetingFrameTab";
import { RingCentralReportUpload } from "@/components/RingCentralReportUpload";
import { Core4Tab } from "@/components/agency/Core4Tab";
import { EmailDeliveryNoticeButton, EmailDeliveryNoticeModal } from "@/components/EmailDeliveryNoticeModal";
import { SalesEmailSettings } from "@/components/settings/SalesEmailSettings";
import { BreakupLetterSettings } from "@/components/settings/BreakupLetterSettings";
import { hasSalesAccess } from "@/lib/salesBetaAccess";
import Papa from "papaparse";
// Reuse enums consistent with AdminTeam
const MEMBER_ROLES = ["Sales", "Service", "Hybrid", "Manager"] as const;
const EMPLOYMENT_TYPES = ["Full-time", "Part-time"] as const;
const MEMBER_STATUS = ["active", "inactive"] as const;

type Role = (typeof MEMBER_ROLES)[number];
type Employment = (typeof EMPLOYMENT_TYPES)[number];
type MemberStatus = (typeof MEMBER_STATUS)[number];

function DashboardCallMetricsToggle({ agencyId }: { agencyId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<'off' | 'shadow' | 'on'>('off');
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);

  useEffect(() => {
    supabase
      .from('agencies')
      .select('dashboard_call_metrics_enabled, call_metrics_mode')
      .eq('id', agencyId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          toast.error('Failed to load call metrics settings');
          setLoading(false);
          return;
        }

        const nextEnabled = (data as any)?.dashboard_call_metrics_enabled ?? false;
        const nextMode = ((data as any)?.call_metrics_mode as 'off' | 'shadow' | 'on' | null) || (nextEnabled ? 'shadow' : 'off');
        setEnabled(nextEnabled);
        setMode(nextMode);
        setLoading(false);
      });
  }, [agencyId]);

  const updateMode = async (nextMode: 'off' | 'shadow' | 'on') => {
    setSavingMode(true);
    const prevMode = mode;
    const prevEnabled = enabled;
    setMode(nextMode);
    setEnabled(nextMode !== 'off');

    const { error } = await supabase
      .from('agencies')
      .update({ call_metrics_mode: nextMode } as any)
      .eq('id', agencyId);

    setSavingMode(false);
    if (error) {
      setMode(prevMode);
      setEnabled(prevEnabled);
      toast.error('Failed to update call metrics mode');
      return;
    }

    if (nextMode === 'off') {
      toast.success('Call metrics mode set to Off (manual only)');
    } else if (nextMode === 'shadow') {
      toast.success('Call metrics mode set to Shadow (manual scoring + auto visibility)');
    } else {
      toast.success('Call metrics mode set to On (auto call metrics enabled)');
    }
  };

  const handleToggle = async (value: boolean) => {
    const targetMode: 'off' | 'shadow' | 'on' = value ? (mode === 'on' ? 'on' : 'shadow') : 'off';
    await updateMode(targetMode);
  };

  if (loading) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-lg border p-4 mb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="dashboard-call-metrics" className="text-sm font-medium">Show Call Metrics on Dashboard</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Show Call Metrics help">
                    <CircleHelp className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  Controls whether call-metric rings are visible on dashboard pages. This is display-only and separate from call data mode.
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs text-muted-foreground">Display call metric rings and accordion layout on the main dashboard</p>
          </div>
          <Switch
            id="dashboard-call-metrics"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={savingMode}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="call-metrics-mode" className="text-sm font-medium">Call Metrics Data Mode</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Call Metrics Data Mode help">
                  <CircleHelp className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                Choose how call data is used for daily metrics and pass/fail scoring.
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={mode}
            onValueChange={(value) => updateMode(value as 'off' | 'shadow' | 'on')}
            disabled={savingMode}
          >
            <SelectTrigger id="call-metrics-mode" className="w-full md:w-[360px]">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off (Manual Scorecard Only)</SelectItem>
              <SelectItem value="shadow">Shadow (Manual Scoring + Auto Visibility)</SelectItem>
              <SelectItem value="on">On (Use Auto Call Metrics)</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-help">Off</Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                Stable/manual mode. Uses scorecard-submitted calls and talk time for dashboard scoring.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-help">Shadow</Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                Safe rollout mode. Keep manual scoring, while validating imported phone data before full automation.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-help">On</Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                Automation mode. RingCentral/Ricochet call data drives outbound calls and talk time metrics.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground">
            Off keeps calls/talk from scorecard submissions only. Shadow keeps scoring manual while still surfacing auto call data for comparison.
            On lets RingCentral/Ricochet call metrics drive outbound calls and talk time.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}

interface StaffUser {
  id: string;
  username: string;
  is_active: boolean;
  last_login_at: string | null;
  email: string | null;
  team_member_id: string | null;
}

interface KeyEmployee {
  id: string;
  user_id: string;
  agency_id: string;
  created_at: string;
  email?: string;
  full_name?: string;
}

interface BulkImportCsvRow {
  name: string;
  email: string;
  role: Role;
}

interface BulkImportValidationIssue {
  rowNumber: number;
  message: string;
}

interface BulkImportCredentialRow {
  rowNumber: number;
  name: string;
  email: string;
  role: Role;
  employment: Employment;
  status: MemberStatus;
  username: string | null;
  temporaryPassword: string | null;
  result: "created" | "updated" | "skipped" | "error";
  detail: string;
}

const BULK_REQUIRED_COLUMNS = ["name", "email", "role"] as const;

const normalizeCsvHeader = (value: string) => value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, "_");

const toRole = (value: string): Role | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "sales") return "Sales";
  if (normalized === "service") return "Service";
  if (normalized === "hybrid") return "Hybrid";
  if (normalized === "manager") return "Manager";
  return null;
};

const escapeCsvCell = (value: string | null | undefined) => {
  const safe = value ?? "";
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
};

const downloadCsv = (filename: string, rows: Array<Record<string, string>>) => {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const parseBulkTeamCsv = async (file: File): Promise<{
  rows: BulkImportCsvRow[];
  issues: BulkImportValidationIssue[];
}> => {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        const headers = (results.meta.fields || []).map(normalizeCsvHeader);
        const missingColumns = BULK_REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
        const issues: BulkImportValidationIssue[] = [];

        if (missingColumns.length > 0) {
          resolve({
            rows: [],
            issues: missingColumns.map((column) => ({
              rowNumber: 1,
              message: `Missing required column: ${column}`,
            })),
          });
          return;
        }

        const seenEmails = new Set<string>();
        const parsedRows: BulkImportCsvRow[] = [];

        results.data.forEach((rawRow, index) => {
          const rowNumber = index + 2;
          const mapped: Record<string, string> = {};
          Object.entries(rawRow).forEach(([key, value]) => {
            mapped[normalizeCsvHeader(key)] = (value || "").trim();
          });

          const name = mapped.name || "";
          const email = (mapped.email || "").toLowerCase();
          const role = toRole(mapped.role || "");
          if (!name) issues.push({ rowNumber, message: "Name is required" });
          if (!email) {
            issues.push({ rowNumber, message: "Email is required" });
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            issues.push({ rowNumber, message: `Invalid email format: ${email}` });
          }
          if (!role) issues.push({ rowNumber, message: "Role must be Sales, Service, Hybrid, or Manager" });

          if (email) {
            if (seenEmails.has(email)) {
              issues.push({ rowNumber, message: `Duplicate email in file: ${email}` });
            } else {
              seenEmails.add(email);
            }
          }

          if (name && email && role) {
            parsedRows.push({ name, email, role });
          }
        });

        resolve({ rows: parsedRows, issues });
      },
      error: (error) => reject(error),
    });
  });
};

const isUsernameConflictMessage = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes("username") && (
    normalized.includes("conflict") ||
    normalized.includes("exists") ||
    normalized.includes("taken") ||
    normalized.includes("reserved")
  );
};

const generateRandomPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Password copied to clipboard");
  } catch (err) {
    toast.error("Failed to copy to clipboard");
  }
};

export default function Agency() {
  const { user, membershipTier, isAdmin } = useAuth();
  const { toast: toastHook } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeTab = searchParams.get('tab') || 'info';
  const isCallScoringTier = membershipTier?.startsWith('Call Scoring');

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Agency form state
  const [agencyName, setAgencyName] = useState("");
  const [agencyEmail, setAgencyEmail] = useState("");
  const [agencyPhone, setAgencyPhone] = useState("");
  const [agencyLogo, setAgencyLogo] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [staffCanUploadCalls, setStaffCanUploadCalls] = useState(true);

  // Team state
  const [members, setMembers] = useState<any[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [keyEmployees, setKeyEmployees] = useState<KeyEmployee[]>([]);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    role: MEMBER_ROLES[0] as Role,
    employment: EMPLOYMENT_TYPES[0] as Employment,
    status: MEMBER_STATUS[0] as MemberStatus,
    notes: "",
    hybridTeamAssignments: [] as string[],
    subProducerCode: "",
    includeInMetrics: true,
  });
  const [editingMemberOriginalRole, setEditingMemberOriginalRole] = useState<Role | null>(null);
  const [editingMemberHasStaffUser, setEditingMemberHasStaffUser] = useState(false);
  const [memberLoginUsername, setMemberLoginUsername] = useState("");
  const [memberLoginUsernameOriginal, setMemberLoginUsernameOriginal] = useState("");

  // Staff Invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [manageLoginDialogOpen, setManageLoginDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedStaffUser, setSelectedStaffUser] = useState<StaffUser | null>(null);
  const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);
  const [usernameDialogStaffUser, setUsernameDialogStaffUser] = useState<StaffUser | null>(null);
  const [usernameDialogValue, setUsernameDialogValue] = useState("");
  const [usernameDialogSaving, setUsernameDialogSaving] = useState(false);
  const [editableUsername, setEditableUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  // Manual password creation state
  const [inviteMode, setInviteMode] = useState<'email' | 'manual'>('manual');
  const [manualUsername, setManualUsername] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [showManualPassword, setShowManualPassword] = useState(false);
  
  // Email delivery notice modal state for Send Invite
  const [emailNoticeModalOpen, setEmailNoticeModalOpen] = useState(false);

  // Reset password state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Deactivate confirmation dialog
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [memberToDeactivate, setMemberToDeactivate] = useState<any>(null);

  // Key Employee dialog state
  const [keyEmployeeDialogOpen, setKeyEmployeeDialogOpen] = useState(false);
  const [keyEmployeeForm, setKeyEmployeeForm] = useState({ name: '', email: '', password: '' });
  const [keyEmployeeLoading, setKeyEmployeeLoading] = useState(false);
  const [showKeyEmployeePassword, setShowKeyEmployeePassword] = useState(false);
  const [removeKeyEmployeeDialogOpen, setRemoveKeyEmployeeDialogOpen] = useState(false);
  const [keyEmployeeToRemove, setKeyEmployeeToRemove] = useState<KeyEmployee | null>(null);

  // Bulk CSV import state
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [bulkImportFileName, setBulkImportFileName] = useState("");
  const [bulkImportRows, setBulkImportRows] = useState<BulkImportCsvRow[]>([]);
  const [bulkImportIssues, setBulkImportIssues] = useState<BulkImportValidationIssue[]>([]);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkImportRunning, setBulkImportRunning] = useState(false);
  const [bulkTemporaryPassword, setBulkTemporaryPassword] = useState("");
  const [showBulkTemporaryPassword, setShowBulkTemporaryPassword] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);

  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [bulkCredentialRows, setBulkCredentialRows] = useState<BulkImportCredentialRow[]>([]);
  const [showAllCredentials, setShowAllCredentials] = useState(false);
  const [revealedCredentialRows, setRevealedCredentialRows] = useState<Set<number>>(new Set());
  const [lastBulkTemporaryPassword, setLastBulkTemporaryPassword] = useState("");
  const [showResultBatchPassword, setShowResultBatchPassword] = useState(false);

  // Build staff user lookup map
  const staffByTeamMemberId = useMemo(() => {
    return new Map(staffUsers.filter(s => s.team_member_id).map(s => [s.team_member_id, s]));
  }, [staffUsers]);

  useEffect(() => {
    document.title = "My Agency | AgencyBrain";
    const meta = document.querySelector('meta[name="description"]');
    const content = "Manage your agency info and team from one workspace.";
    if (meta) meta.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  // Redirect Call Scoring tier users from restricted tabs
  useEffect(() => {
    if (isCallScoringTier) {
      const restrictedTabs = ['core4', 'files', 'vault', 'meeting-frame'];
      if (restrictedTabs.includes(activeTab)) {
        setSearchParams({ tab: 'info' });
      }
    }
  }, [isCallScoringTier, activeTab, setSearchParams]);

  // Load profile -> agency -> members -> staff users
  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("agency_id")
          .eq("id", user.id)
          .maybeSingle();
        if (pErr) throw pErr;
        const aId = profile?.agency_id as string | null;
        setAgencyId(aId || null);

        if (aId) {
          const { data: agency, error: aErr } = await supabase
            .from("agencies")
            .select("id,name,agency_email,phone,logo_url,staff_can_upload_calls,rc_ingest_key")
            .eq("id", aId)
            .maybeSingle();
          if (aErr) throw aErr;
          setAgencyName(agency?.name || "");
          setAgencyEmail(agency?.agency_email || "");
          setAgencyPhone(agency?.phone || "");
          setAgencyLogo(agency?.logo_url || null);
          setStaffCanUploadCalls(agency?.staff_can_upload_calls ?? true);

          const { data: team, error: tErr } = await supabase
            .from("team_members")
            .select("id,name,email,role,employment,status,notes,hybrid_team_assignments,sub_producer_code,include_in_metrics,created_at")
            .eq("agency_id", aId)
            .order("created_at", { ascending: false });
          if (tErr) throw tErr;
          setMembers(team || []);

          // Fetch staff users separately (no FK constraint)
          const { data: staff, error: sErr } = await supabase
            .from("staff_users")
            .select("id, username, is_active, last_login_at, email, team_member_id")
            .eq("agency_id", aId);
          if (!sErr) setStaffUsers(staff || []);

          // Fetch key employees using edge function (bypasses RLS safely)
          try {
            const { data: keData, error: keError } = await supabase.functions.invoke('get-key-employees');
            if (!keError && keData?.data) {
              setKeyEmployees(keData.data);
            } else {
              console.error('Error fetching key employees:', keError);
              setKeyEmployees([]);
            }
          } catch (keErr) {
            console.error('Failed to fetch key employees:', keErr);
            setKeyEmployees([]);
          }
        }
      } catch (e: any) {
        console.error(e);
        toastHook({ title: "Failed to load", description: e?.message || "Unable to load agency", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user?.id]);

  const refreshData = async (aId: string) => {
    const { data: team, error: tErr } = await supabase
      .from("team_members")
      .select("id,name,email,role,employment,status,notes,hybrid_team_assignments,sub_producer_code,include_in_metrics,created_at")
      .eq("agency_id", aId)
      .order("created_at", { ascending: false });
    if (!tErr) setMembers(team || []);

    const { data: staff, error: sErr } = await supabase
      .from("staff_users")
      .select("id, username, is_active, last_login_at, email, team_member_id")
      .eq("agency_id", aId);
    if (!sErr) setStaffUsers(staff || []);

    // Fetch key employees using edge function (bypasses RLS safely)
    try {
      const { data: keData, error: keError } = await supabase.functions.invoke('get-key-employees');
      if (!keError && keData?.data) {
        setKeyEmployees(keData.data);
      } else {
        console.error('Error fetching key employees:', keError);
        setKeyEmployees([]);
      }
    } catch (keErr) {
      console.error('Failed to fetch key employees:', keErr);
      setKeyEmployees([]);
    }
  };

  const resetBulkImportState = () => {
    setBulkImportFileName("");
    setBulkImportRows([]);
    setBulkImportIssues([]);
    setBulkTemporaryPassword("");
    setShowBulkTemporaryPassword(false);
    setBulkImportLoading(false);
    setBulkImportRunning(false);
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = "";
    }
  };

  const downloadBulkTemplate = () => {
    downloadCsv("team-members-template.csv", [
      {
        name: "Jane Smith",
        email: "jane.smith@agency.com",
        role: "Sales",
      },
      {
        name: "John Davis",
        email: "john.davis@agency.com",
        role: "Service",
      },
    ]);
  };

  const downloadBulkIssues = () => {
    if (bulkImportIssues.length === 0) return;
    downloadCsv(
      "team-members-import-errors.csv",
      bulkImportIssues.map((issue) => ({
        row_number: String(issue.rowNumber),
        message: issue.message,
      }))
    );
  };

  const sanitizeUsernamePart = (value: string) => {
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, ".")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/g, "");
    return normalized || "staff";
  };

  const buildUsernameSeed = (row: BulkImportCsvRow, index: number) => {
    const emailPrefix = row.email.split("@")[0] || row.name;
    const agencySeed = sanitizeUsernamePart((agencyId || "agency").slice(0, 8));
    return `${sanitizeUsernamePart(emailPrefix)}.${agencySeed}.${index + 1}`;
  };

  const extractFunctionErrorMessage = async (error: any, fallback: string) => {
    if (error?.context?.json) {
      try {
        const payload = await error.context.json();
        return payload?.message || payload?.error || fallback;
      } catch {
        return error?.message || fallback;
      }
    }
    return error?.message || fallback;
  };

  const handleBulkFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBulkImportFileName(file.name);
    setBulkImportLoading(true);
    try {
      const { rows, issues } = await parseBulkTeamCsv(file);
      setBulkImportRows(rows);
      setBulkImportIssues(issues);
      if (rows.length === 0 && issues.length === 0) {
        toast.error("No rows found in CSV file");
      }
    } catch (error: any) {
      console.error("Failed to parse CSV:", error);
      toast.error(error?.message || "Failed to parse CSV file");
      setBulkImportRows([]);
      setBulkImportIssues([{ rowNumber: 1, message: "Unable to parse CSV file" }]);
    } finally {
      setBulkImportLoading(false);
    }
  };

  const runBulkImport = async () => {
    if (!agencyId) {
      toast.error("No agency configured");
      return;
    }
    if (bulkImportRows.length === 0) {
      toast.error("Upload a CSV with at least one valid row");
      return;
    }
    if (bulkImportIssues.length > 0) {
      toast.error("Fix CSV validation issues before importing");
      return;
    }
    if (bulkTemporaryPassword.length < 8) {
      toast.error("Temporary password must be at least 8 characters");
      return;
    }

    setBulkImportRunning(true);
    try {
      const memberByEmail = new Map<string, any>(
        members.map((member) => [String(member.email || "").toLowerCase(), member])
      );
      const staffByTeamMemberIdLocal = new Map<string, StaffUser>(
        staffUsers.filter((staff) => staff.team_member_id).map((staff) => [String(staff.team_member_id), staff])
      );
      const usedUsernames = new Set<string>(staffUsers.map((staff) => staff.username.toLowerCase()));
      const results: BulkImportCredentialRow[] = [];

      for (let index = 0; index < bulkImportRows.length; index += 1) {
        const row = bulkImportRows[index];
        const rowNumber = index + 2;

        try {
          let teamMember = memberByEmail.get(row.email);
          let memberAction: "created" | "updated" = "updated";
          const effectiveEmployment: Employment = teamMember?.employment || "Full-time";
          const effectiveStatus: MemberStatus = "active";

          const memberPayload = {
            name: row.name,
            email: row.email,
            role: row.role,
            employment: effectiveEmployment,
            status: effectiveStatus,
          };

          if (teamMember) {
            const { error: updateError } = await supabase
              .from("team_members")
              .update(memberPayload)
              .eq("id", teamMember.id);
            if (updateError) throw updateError;
          } else {
            const { data: createdMember, error: createError } = await supabase
              .from("team_members")
              .insert([{ agency_id: agencyId, ...memberPayload }])
              .select("id, name, email")
              .single();
            if (createError) throw createError;
            teamMember = createdMember;
            memberByEmail.set(row.email, teamMember);
            memberAction = "created";
          }

          if (!teamMember?.id) {
            throw new Error("Team member ID unavailable after upsert");
          }

          const existingStaffUser = staffByTeamMemberIdLocal.get(teamMember.id);

          if (existingStaffUser?.is_active) {
            const { error: syncStaffError } = await supabase
              .from("staff_users")
              .update({
                email: row.email,
                display_name: row.name,
              })
              .eq("id", existingStaffUser.id);
            if (syncStaffError) throw syncStaffError;
            staffByTeamMemberIdLocal.set(teamMember.id, {
              ...existingStaffUser,
              email: row.email,
            });
            results.push({
              rowNumber,
              name: row.name,
              email: row.email,
              role: row.role,
              employment: effectiveEmployment,
              status: effectiveStatus,
              username: existingStaffUser.username,
              temporaryPassword: null,
              result: "skipped",
              detail: "Active login already exists. Synced profile fields and left credentials unchanged.",
            });
            continue;
          }

          if (existingStaffUser && !existingStaffUser.is_active) {
            const { error: resetError } = await supabase.functions.invoke("admin_reset_staff_password", {
              body: {
                user_id: existingStaffUser.id,
                new_password: bulkTemporaryPassword,
                activate: true,
              },
            });
            if (resetError) {
              const message = await extractFunctionErrorMessage(resetError, "Failed to activate existing login");
              throw new Error(message);
            }

            const activatedStaff: StaffUser = { ...existingStaffUser, is_active: true };
            staffByTeamMemberIdLocal.set(teamMember.id, activatedStaff);
            usedUsernames.add(existingStaffUser.username.toLowerCase());

            results.push({
              rowNumber,
              name: row.name,
              email: row.email,
              role: row.role,
              employment: effectiveEmployment,
              status: effectiveStatus,
              username: existingStaffUser.username,
              temporaryPassword: bulkTemporaryPassword,
              result: "updated",
              detail: "Existing pending login activated with temporary password.",
            });
            continue;
          }

          const baseUsername = buildUsernameSeed(row, index);
          let createdStaffData: any = null;
          let finalUsername = baseUsername;
          let attempt = 0;
          const maxAttempts = 10;

          while (attempt < maxAttempts) {
            const candidate = attempt === 0 ? baseUsername : `${baseUsername}.${attempt + 1}`;
            if (usedUsernames.has(candidate.toLowerCase())) {
              attempt += 1;
              continue;
            }

            const { data: createData, error: createStaffError } = await supabase.functions.invoke("admin_create_staff_user", {
              body: {
                agency_id: agencyId,
                username: candidate,
                password: bulkTemporaryPassword,
                display_name: row.name,
                email: row.email,
                team_member_id: teamMember.id,
              },
            });

            if (!createStaffError) {
              createdStaffData = createData;
              finalUsername = createData?.user?.username || candidate;
              break;
            }

            const message = await extractFunctionErrorMessage(createStaffError, "Failed to create staff login");
            if (isUsernameConflictMessage(message)) {
              attempt += 1;
              continue;
            }

            throw new Error(message);
          }

          if (!createdStaffData) {
            throw new Error("Unable to create unique username after multiple attempts");
          }

          usedUsernames.add(finalUsername.toLowerCase());

          const createdStaffUser: StaffUser = {
            id: createdStaffData?.user?.id || crypto.randomUUID(),
            username: finalUsername,
            is_active: true,
            last_login_at: null,
            email: row.email,
            team_member_id: teamMember.id,
          };
          staffByTeamMemberIdLocal.set(teamMember.id, createdStaffUser);

          results.push({
            rowNumber,
            name: row.name,
            email: row.email,
            role: row.role,
            employment: effectiveEmployment,
            status: effectiveStatus,
            username: finalUsername,
            temporaryPassword: bulkTemporaryPassword,
            result: memberAction === "created" ? "created" : "updated",
            detail: memberAction === "created" ? "Team member and login created." : "Team member updated and login created.",
          });
        } catch (error: any) {
          console.error("Bulk import row failed:", { rowNumber, error });
          results.push({
            rowNumber,
            name: row.name,
            email: row.email,
            role: row.role,
            employment: effectiveEmployment,
            status: effectiveStatus,
            username: null,
            temporaryPassword: null,
            result: "error",
            detail: error?.message || "Unexpected error during import",
          });
        }
      }

      try {
        await refreshData(agencyId);
      } catch (refreshError) {
        console.error("Failed to refresh after bulk import:", refreshError);
      }

      setBulkCredentialRows(results);
      setLastBulkTemporaryPassword(bulkTemporaryPassword);
      setShowResultBatchPassword(false);
      setShowAllCredentials(false);
      setRevealedCredentialRows(new Set());
      setCredentialsDialogOpen(true);
      setBulkImportDialogOpen(false);
      resetBulkImportState();

      const createdCount = results.filter((row) => row.result === "created").length;
      const updatedCount = results.filter((row) => row.result === "updated").length;
      const skippedCount = results.filter((row) => row.result === "skipped").length;
      const errorCount = results.filter((row) => row.result === "error").length;
      toast.success(`Import complete: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors`);
    } catch (error: any) {
      console.error("Bulk import failed unexpectedly:", error);
      toast.error(error?.message || "Bulk import failed unexpectedly. Please try again.");
    } finally {
      setBulkImportRunning(false);
    }
  };

  const downloadCredentials = () => {
    if (bulkCredentialRows.length === 0) return;
    downloadCsv(
      "team-member-credentials.csv",
      bulkCredentialRows.map((row) => ({
        row_number: String(row.rowNumber),
        name: row.name,
        email: row.email,
        role: row.role,
        employment: row.employment,
        status: row.status,
        username: row.username || "",
        temporary_password: row.temporaryPassword || "",
        result: row.result,
        detail: row.detail,
      }))
    );
  };

  const copyCredentialsToClipboard = async () => {
    if (bulkCredentialRows.length === 0) return;
    const lines = [
      "Team Member Credentials",
      "======================",
      ...bulkCredentialRows.map((row) => {
        const tempPassword = row.temporaryPassword || "(not changed)";
        return `${row.name} | ${row.email} | username: ${row.username || "(none)"} | temp password: ${tempPassword} | ${row.result}`;
      }),
    ];
    await copyToClipboard(lines.join("\n"));
  };

  const upsertAgency = async () => {
    try {
      if (!user?.id) return;
      if (!agencyName.trim()) {
        toastHook({ title: "Name required", description: "Enter your agency name.", variant: "destructive" });
        return;
      }
      if (!agencyEmail.trim()) {
        toastHook({ title: "Email required", description: "Agency email is required for notifications.", variant: "destructive" });
        return;
      }
      if (agencyId) {
      const { error } = await supabase
          .from("agencies")
          .update({ name: agencyName.trim(), agency_email: agencyEmail.trim(), phone: agencyPhone.trim() || null })
          .eq("id", agencyId);
        if (error) throw error;
        toastHook({ title: "Saved", description: "Agency updated" });
      } else {
        // Use edge function for agency creation (requires privileged profile update)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No active session');
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-agency-and-link-profile`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              name: agencyName.trim(),
              agency_email: agencyEmail.trim() || undefined,
              phone: agencyPhone.trim() || null,
            }),
          }
        );

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create agency');
        }

        setAgencyId(result.agency_id);
        toastHook({ title: "Created", description: "Agency created and linked" });
      }
    } catch (e: any) {
      console.error(e);
      toastHook({ title: "Save failed", description: e?.message || "Unable to save agency", variant: "destructive" });
    }
  };

  const startCreate = () => {
    setEditingId(null);
    setMemberForm({ name: "", email: "", role: MEMBER_ROLES[0], employment: EMPLOYMENT_TYPES[0], status: MEMBER_STATUS[0], notes: "", hybridTeamAssignments: [], subProducerCode: "", includeInMetrics: true });
    setEditingMemberOriginalRole(null);
    setEditingMemberHasStaffUser(false);
    setMemberLoginUsername("");
    setMemberLoginUsernameOriginal("");
    setMemberDialogOpen(true);
  };

  const startEdit = (m: any) => {
    const linkedStaffUser = staffByTeamMemberId.get(m.id);
    setEditingId(m.id);
    setMemberForm({
      name: m.name,
      email: m.email,
      role: m.role,
      employment: m.employment,
      status: m.status,
      notes: m.notes || "",
      hybridTeamAssignments: m.hybrid_team_assignments || [],
      subProducerCode: m.sub_producer_code || "",
      includeInMetrics: m.include_in_metrics ?? true
    });
    setEditingMemberOriginalRole(m.role);
    setEditingMemberHasStaffUser(staffByTeamMemberId.has(m.id));
    setMemberLoginUsername(linkedStaffUser?.username || "");
    setMemberLoginUsernameOriginal(linkedStaffUser?.username || "");
    setMemberDialogOpen(true);
  };

  const saveMember = async () => {
    try {
      if (!agencyId) throw new Error("No agency configured");
      if (!memberForm.name.trim() || !memberForm.email.trim()) throw new Error("Name and email are required");
      const updateData = {
        name: memberForm.name,
        email: memberForm.email,
        role: memberForm.role,
        employment: memberForm.employment,
        status: memberForm.status,
        notes: memberForm.notes,
        hybrid_team_assignments: memberForm.role === 'Hybrid' ? memberForm.hybridTeamAssignments : null,
        sub_producer_code: memberForm.subProducerCode || null,
        include_in_metrics: memberForm.includeInMetrics
      };
      
      if (editingId) {
        const { error } = await supabase.from("team_members").update(updateData).eq("id", editingId);
        if (error) throw error;
        
        // Sync email to linked staff_users record
        const linkedStaffUser = staffByTeamMemberId.get(editingId);
        if (linkedStaffUser) {
          const staffUpdate: Record<string, unknown> = {
            email: memberForm.email
          };

          const trimmedUsername = memberLoginUsername.trim();
          if (trimmedUsername && trimmedUsername !== memberLoginUsernameOriginal) {
            staffUpdate.username = trimmedUsername;
          }

          const { error: staffError } = await supabase
            .from("staff_users")
            .update(staffUpdate)
            .eq("id", linkedStaffUser.id);

          if (staffError) {
            if ((staffError as any)?.code === "23505") {
              throw new Error("This username is already taken. Please choose a different one.");
            }
            console.error("Failed to sync email/username to staff_users:", staffError);
            throw staffError;
          }
        }
      } else {
        const { error } = await supabase.from("team_members").insert([{ agency_id: agencyId, ...updateData }]);
        if (error) throw error;
      }
      await refreshData(agencyId);
      setMemberDialogOpen(false);
      toastHook({ title: "Saved", description: "Team member saved" });
    } catch (e: any) {
      console.error(e);
      toastHook({ title: "Save failed", description: e?.message || "Unable to save member", variant: "destructive" });
    }
  };

  const openDeactivateDialog = (member: any) => {
    setMemberToDeactivate(member);
    setDeactivateDialogOpen(true);
  };

  const deactivateMember = async () => {
    if (!memberToDeactivate || !agencyId) return;
    
    try {
      // Update team member status to inactive
      const { error: memberError } = await supabase
        .from("team_members")
        .update({ status: 'inactive' })
        .eq("id", memberToDeactivate.id);
      
      if (memberError) throw memberError;
      
      // Also deactivate their staff login if they have one
      const staffUser = staffByTeamMemberId.get(memberToDeactivate.id);
      if (staffUser) {
        const { error: staffError } = await supabase
          .from("staff_users")
          .update({ is_active: false })
          .eq("team_member_id", memberToDeactivate.id);
        
        if (staffError) {
          console.error("Failed to deactivate staff login:", staffError);
        }
      }
      
      toast.success(`${memberToDeactivate.name} has been deactivated`);
      await refreshData(agencyId);
    } catch (e: any) {
      console.error("Deactivate member error:", e);
      toast.error("Failed to deactivate team member");
    } finally {
      setDeactivateDialogOpen(false);
      setMemberToDeactivate(null);
    }
  };

  const reactivateMember = async (member: any) => {
    if (!agencyId) return;
    
    try {
      const { error } = await supabase
        .from("team_members")
        .update({ status: 'active' })
        .eq("id", member.id);
      
      if (error) throw error;
      
      toast.success(`${member.name} has been reactivated`);
      await refreshData(agencyId);
    } catch (e: any) {
      console.error("Reactivate member error:", e);
      toast.error("Failed to reactivate team member");
    }
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Staff Invite handlers
  const generateUsername = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
  };

  const openInviteModal = (member: any) => {
    setSelectedMember(member);
    setInviteMode('manual');
    setManualUsername(generateUsername(member.name));
    setManualPassword(generateRandomPassword());
    setShowManualPassword(false);
    setInviteDialogOpen(true);
  };

  const handleCreateWithPassword = async () => {
    try {
      if (!selectedMember || !agencyId) return;
      
      const isKeyEmployee = selectedMember.role === 'Key Employee';
      
      // Key Employees require an email address (they use Supabase auth)
      if (isKeyEmployee) {
        if (!selectedMember.email) {
          toast.error("Key Employee requires an email address");
          return;
        }
        if (manualPassword.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }

        setInviteLoading(true);

        const { data, error } = await supabase.functions.invoke("create_key_employee_account", {
          body: {
            agency_id: agencyId,
            email: selectedMember.email,
            password: manualPassword,
            display_name: selectedMember.name,
            team_member_id: selectedMember.id,
          },
        });

        if (error) {
          let errorData: any = {};
          if (error.context?.json) {
            try {
              errorData = await error.context.json();
            } catch (parseError) {
              console.error('Could not parse error response:', parseError);
            }
          }
          
          if (errorData.error === 'email_conflict') {
            toast.error(errorData.message || "This email is already a key employee.", { duration: 8000 });
            return;
          }
          
          throw new Error(errorData.message || error.message || 'Failed to create key employee');
        }
        
        if (data?.error) {
          throw new Error(data.message || data.error);
        }

        await copyToClipboard(manualPassword);
        toast.success(`Key Employee account created! Password copied. Login at myagencybrain.com/auth`);
        setInviteDialogOpen(false);
        setSelectedMember(null);
        setManualUsername('');
        setManualPassword('');
        await refreshData(agencyId);
        return;
      }
      
      // Regular staff user flow
      if (!manualUsername.trim()) {
        toast.error("Username is required");
        return;
      }
      if (manualPassword.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }

      setInviteLoading(true);

      const { data, error } = await supabase.functions.invoke("admin_create_staff_user", {
        body: {
          agency_id: agencyId,
          username: manualUsername.trim(),
          password: manualPassword,
          display_name: selectedMember.name,
          email: selectedMember.email || undefined,
          team_member_id: selectedMember.id,
        },
      });

      // Check for errors - extract body from FunctionsHttpError via error.context.json()
      if (error) {
        let errorData: any = {};
        
        // FunctionsHttpError has response body in error.context
        if (error.context?.json) {
          try {
            errorData = await error.context.json();
            console.log('Error data from edge function:', errorData);
          } catch (parseError) {
            console.error('Could not parse error response:', parseError);
          }
        }
        
        if (errorData.error === 'email_conflict') {
          toast.error(errorData.message || "This email is already in use by another staff account.", { duration: 8000 });
          return;
        }
        
        if (errorData.error === 'team_member_already_linked') {
          toast.error(errorData.message || "This team member already has a staff login.", { duration: 6000 });
          return;
        }
        
        if (errorData.error === 'username_conflict') {
          toast.error(errorData.message || "This username is already taken. Please choose a different one.", { duration: 6000 });
          return;
        }
        
        throw new Error(errorData.message || error.message || 'Failed to create staff user');
      }
      
      // Also check for application-level errors in data (for 2xx responses with error payloads)
      if (data?.error) {
        throw new Error(data.message || data.error);
      }

      await copyToClipboard(manualPassword);
      toast.success(`Login created! Password copied. Username: ${manualUsername}`);
      setInviteDialogOpen(false);
      setSelectedMember(null);
      setManualUsername('');
      setManualPassword('');
      await refreshData(agencyId);
    } catch (e: any) {
      console.error('handleCreateWithPassword error:', e);
      
      let errorMessage = "Failed to create login";
      
      try {
        // FunctionsHttpError has response body in e.context
        if (e?.context?.json) {
          const errorData = await e.context.json();
          console.log('Error data from edge function:', errorData);
          
          if (errorData?.error === 'email_conflict' || errorData?.message?.includes('email')) {
            errorMessage = errorData.message || "This email is already in use.";
          } else if (errorData?.error === 'team_member_already_linked') {
            errorMessage = errorData.message || "This team member already has a login.";
          } else if (errorData?.message) {
            errorMessage = errorData.message;
          }
        }
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
      }
      
      toast.error(errorMessage, { duration: 8000 });
    } finally {
      setInviteLoading(false);
    }
  };

  const openManageLoginModal = (member: any, staffUser: StaffUser) => {
    setSelectedMember(member);
    setSelectedStaffUser(staffUser);
    setEditableUsername(staffUser.username || "");
    setManageLoginDialogOpen(true);
  };

  const handleSaveUsername = async () => {
    try {
      if (!selectedStaffUser || !agencyId) return;

      const trimmedUsername = editableUsername.trim();
      if (!trimmedUsername) {
        toast.error("Username is required");
        return;
      }

      if (trimmedUsername === selectedStaffUser.username) {
        toast("Username is unchanged");
        return;
      }

      setSavingUsername(true);

      const { error } = await supabase
        .from("staff_users")
        .update({ username: trimmedUsername })
        .eq("id", selectedStaffUser.id);

      if (error) {
        if ((error as any)?.code === "23505") {
          toast.error("This username is already taken. Please choose a different one.");
          return;
        }
        throw error;
      }

      setSelectedStaffUser({ ...selectedStaffUser, username: trimmedUsername });
      toast.success("Username updated");
      await refreshData(agencyId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to update username");
    } finally {
      setSavingUsername(false);
    }
  };

  const openUsernameDialog = (staffUser: StaffUser) => {
    setUsernameDialogStaffUser(staffUser);
    setUsernameDialogValue(staffUser.username || "");
    setUsernameDialogOpen(true);
  };

  const handleSaveUsernameFromTable = async () => {
    try {
      if (!usernameDialogStaffUser || !agencyId) return;

      const trimmedUsername = usernameDialogValue.trim();
      if (!trimmedUsername) {
        toast.error("Username is required");
        return;
      }

      if (trimmedUsername === usernameDialogStaffUser.username) {
        setUsernameDialogOpen(false);
        return;
      }

      setUsernameDialogSaving(true);

      const { error } = await supabase
        .from("staff_users")
        .update({ username: trimmedUsername })
        .eq("id", usernameDialogStaffUser.id);

      if (error) {
        if ((error as any)?.code === "23505") {
          toast.error("This username is already taken. Please choose a different one.");
          return;
        }
        throw error;
      }

      toast.success("Username updated");
      setUsernameDialogOpen(false);
      setUsernameDialogStaffUser(null);
      await refreshData(agencyId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to update username");
    } finally {
      setUsernameDialogSaving(false);
    }
  };

  const handleSendInvite = async () => {
    try {
      if (!selectedMember || !agencyId) return;
      
      if (!selectedMember.email) {
        toast.error("Team member has no email address");
        return;
      }

      setInviteLoading(true);

      const { data, error } = await supabase.functions.invoke("send_staff_invite", {
        body: {
          team_member_id: selectedMember.id,
          agency_id: agencyId,
        },
      });

      // Check for errors - extract body from FunctionsHttpError via error.context.json()
      if (error) {
        let errorData: any = {};
        
        if (error.context?.json) {
          try {
            errorData = await error.context.json();
            console.log('Error data from edge function:', errorData);
          } catch (parseError) {
            console.error('Could not parse error response:', parseError);
          }
        }
        
        if (errorData.error === 'email_conflict') {
          toast.error(errorData.message || "This email is already in use by another staff account.", { duration: 8000 });
          return;
        }
        
        throw new Error(errorData.message || error.message || 'Failed to send invite');
      }
      
      if (!data?.success) {
        toast.error(data?.message || data?.error || "Failed to send invite");
        return;
      }

      toast.success(`Invite sent to ${selectedMember.email}`);
      setInviteDialogOpen(false);
      setSelectedMember(null);
      await refreshData(agencyId);
    } catch (e: any) {
      console.error('handleSendInvite error:', e);
      
      let errorMessage = "Failed to send invite";
      
      try {
        if (e?.context?.json) {
          const errorData = await e.context.json();
          console.log('Error data from edge function:', errorData);
          
          if (errorData?.error === 'email_conflict' || errorData?.message?.includes('email')) {
            errorMessage = errorData.message || "This email is already in use by another staff account.";
          } else if (errorData?.message) {
            errorMessage = errorData.message;
          }
        }
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
      }
      
      toast.error(errorMessage, { duration: 8000 });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleResendInvite = async (member: any) => {
    try {
      if (!agencyId) return;
      
      if (!member.email) {
        toast.error("Team member has no email address");
        return;
      }

      const { data, error } = await supabase.functions.invoke("send_staff_invite", {
        body: {
          team_member_id: member.id,
          agency_id: agencyId,
        },
      });

      // Check for errors - extract body from FunctionsHttpError via error.context.json()
      if (error) {
        let errorData: any = {};
        
        if (error.context?.json) {
          try {
            errorData = await error.context.json();
            console.log('Error data from edge function:', errorData);
          } catch (parseError) {
            console.error('Could not parse error response:', parseError);
          }
        }
        
        if (errorData.error === 'email_conflict') {
          toast.error(errorData.message || "This email is already in use by another staff account.", { duration: 8000 });
          return;
        }
        
        throw new Error(errorData.message || error.message || 'Failed to resend invite');
      }
      
      if (!data?.success) {
        toast.error(data?.message || data?.error || "Failed to resend invite");
        return;
      }

      toast.success(`Invite resent to ${member.email}`);
      await refreshData(agencyId);
    } catch (e: any) {
      console.error('handleResendInvite error:', e);
      
      let errorMessage = "Failed to resend invite";
      
      try {
        if (e?.context?.json) {
          const errorData = await e.context.json();
          console.log('Error data from edge function:', errorData);
          
          if (errorData?.error === 'email_conflict' || errorData?.message?.includes('email')) {
            errorMessage = errorData.message || "This email is already in use by another staff account.";
          } else if (errorData?.message) {
            errorMessage = errorData.message;
          }
        }
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
      }
      
      toast.error(errorMessage, { duration: 8000 });
    }
  };

  const handleResetPassword = async () => {
    try {
      if (!selectedStaffUser || !newPassword) {
        toast.error("Password is required");
        return;
      }
      if (newPassword.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }

      const shouldActivate = !selectedStaffUser.is_active;

      const { error } = await supabase.functions.invoke("admin_reset_staff_password", {
        body: {
          user_id: selectedStaffUser.id,
          new_password: newPassword,
          ...(shouldActivate && { activate: true }),
        },
      });

      if (error) throw error;

      await copyToClipboard(newPassword);
      toast.success(
        shouldActivate
          ? "Password set and account activated! Password copied to clipboard."
          : "Password reset! New password copied to clipboard."
      );
      setResetDialogOpen(false);
      setNewPassword("");
      setShowNewPassword(false);

      // Refresh data so the row transitions to active state
      if (shouldActivate && agencyId) {
        await refreshData(agencyId);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to reset password");
    }
  };

  const handleSendResetEmail = async () => {
    try {
      if (!selectedStaffUser?.email) {
        toast.error("Staff user has no email configured");
        return;
      }

      const { error } = await supabase.functions.invoke("staff_request_password_reset", {
        body: { email: selectedStaffUser.email },
      });

      if (error) throw error;
      toast.success("Password reset email sent!");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to send reset email");
    }
  };

  const handleToggleActive = async () => {
    try {
      if (!selectedStaffUser || !agencyId) return;

      const { error } = await supabase
        .from("staff_users")
        .update({ is_active: !selectedStaffUser.is_active })
        .eq("id", selectedStaffUser.id);

      if (error) throw error;

      toast.success(selectedStaffUser.is_active ? "Staff login deactivated" : "Staff login activated");
      setManageLoginDialogOpen(false);
      setSelectedStaffUser(null);
      await refreshData(agencyId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to update status");
    }
  };

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-6">
        <h1 className="sr-only">My Agency</h1>
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className={`grid w-full ${isCallScoringTier ? 'grid-cols-4' : 'grid-cols-4 sm:grid-cols-4 md:grid-cols-8'}`}>
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Agency Info
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
            {!isCallScoringTier && (
              <TabsTrigger value="core4" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Core 4
              </TabsTrigger>
            )}
            {!isCallScoringTier && (
              <TabsTrigger value="files" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Files
              </TabsTrigger>
            )}
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            {!isCallScoringTier && (
              <TabsTrigger value="vault" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Process Vault
              </TabsTrigger>
            )}
            {!isCallScoringTier && (
              <TabsTrigger value="meeting-frame" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Meeting Frame
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="info" className="space-y-6">

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Agency Information
              <HelpButton videoKey="agency-information" />
            </CardTitle>
            <CardDescription>Update your agency profile</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {/* Agency Logo */}
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
              <Label className="sm:text-right pt-2">Logo</Label>
              <div className="col-span-1 sm:col-span-3 space-y-3">
                {agencyLogo ? (
                  <div className="flex items-center gap-4">
                    <img 
                      src={agencyLogo} 
                      alt="Agency logo" 
                      className="h-16 max-w-48 object-contain rounded border border-border/30 bg-background p-2"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={async () => {
                        if (!agencyId) return;
                        try {
                          // Delete old file from storage if it exists
                          if (agencyLogo) {
                            try {
                              // Extract path from URL - format: .../agency-logos/agencyId/filename
                              const urlPath = new URL(agencyLogo).pathname;
                              const storagePath = urlPath.split('/agency-logos/')[1]?.split('?')[0];
                              if (storagePath) {
                                await supabase.storage.from('agency-logos').remove([storagePath]);
                              }
                            } catch (storageErr) {
                              console.warn('Could not delete old logo from storage:', storageErr);
                            }
                          }
                          await supabase.from("agencies").update({ logo_url: null }).eq("id", agencyId);
                          setAgencyLogo(null);
                          toast.success("Logo removed");
                        } catch (e: any) {
                          console.error('Logo remove error:', e);
                          toast.error("Failed to remove logo");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-32 rounded border border-dashed border-border/50 flex items-center justify-center text-muted-foreground/50">
                      <Building2 className="h-8 w-8" />
                    </div>
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !agencyId) return;
                        
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error("File must be under 2MB");
                          return;
                        }

                        setUploadingLogo(true);
                        try {
                          const ext = file.name.split('.').pop();
                          // Use timestamp in filename to avoid caching issues
                          const timestamp = Date.now();
                          const filePath = `${agencyId}/logo-${timestamp}.${ext}`;
                          
                          const { error: uploadError } = await supabase.storage
                            .from('agency-logos')
                            .upload(filePath, file, { upsert: true });
                          
                          if (uploadError) throw uploadError;

                          const { data: { publicUrl } } = supabase.storage
                            .from('agency-logos')
                            .getPublicUrl(filePath);

                          const { error: dbError } = await supabase.from("agencies").update({ logo_url: publicUrl }).eq("id", agencyId);
                          if (dbError) throw dbError;
                          
                          setAgencyLogo(publicUrl);
                          toast.success("Logo uploaded!");
                        } catch (e: any) {
                          console.error('Logo upload error:', e);
                          toast.error(e?.message || "Failed to upload logo");
                        } finally {
                          setUploadingLogo(false);
                          // Reset file input so same file can be selected again
                          e.target.value = '';
                        }
                      }}
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={!agencyId || uploadingLogo}
                      onClick={() => document.getElementById('logo-upload')?.click()}
                    >
                      {uploadingLogo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                      Upload Logo
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">PNG, JPG or WebP. Max 2MB. This appears on your training card.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="agency-name" className="sm:text-right">Name</Label>
              <Input id="agency-name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="col-span-1 sm:col-span-3" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="agency-email" className="sm:text-right">Email</Label>
              <Input id="agency-email" type="email" value={agencyEmail} onChange={(e) => setAgencyEmail(e.target.value)} className="col-span-1 sm:col-span-3" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="agency-phone" className="sm:text-right">Phone</Label>
              <Input id="agency-phone" value={agencyPhone} onChange={(e) => setAgencyPhone(e.target.value)} className="col-span-1 sm:col-span-3" />
            </div>
            <div className="flex justify-end">
              <Button variant="flat" onClick={upsertAgency}>{agencyId ? "Save" : "Create Agency"}</Button>
            </div>
          </CardContent>
        </Card>

            <AgencyTemplatesManager />
          </TabsContent>

          <TabsContent value="team" className="space-y-6">

            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Manage your roster and staff logins</CardDescription>
                </div>
                <div className="flex gap-2">
                  <EmailDeliveryNoticeButton />
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      resetBulkImportState();
                      setBulkTemporaryPassword(generateRandomPassword());
                      setBulkImportDialogOpen(true);
                    }}
                    disabled={!agencyId}
                  >
                    <Upload className="h-4 w-4 mr-2" /> Bulk Upload
                  </Button>
                  <Button 
                    variant="outline" 
                    className="rounded-full" 
                    onClick={() => {
                      setKeyEmployeeForm({ name: '', email: '', password: generateRandomPassword() });
                      setKeyEmployeeDialogOpen(true);
                    }} 
                    disabled={!agencyId}
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" /> Add Key Employee
                  </Button>
                  <Dialog open={memberDialogOpen} onOpenChange={(o) => { setMemberDialogOpen(o); if (!o) setEditingId(null); }}>
                    <DialogTrigger asChild>
                      <Button className="rounded-full" onClick={startCreate} disabled={!agencyId}>
                        <Plus className="h-4 w-4 mr-2" /> Add Member
                      </Button>
                    </DialogTrigger>
              <DialogContent className="glass-surface">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Member" : "Add Member"}</DialogTitle>
                  <DialogDescription>Manage team member details</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label className="sm:text-right" htmlFor="name">Name</Label>
                    <Input id="name" value={memberForm.name} onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))} className="col-span-1 sm:col-span-3" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label className="sm:text-right" htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={memberForm.email} onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))} className="col-span-1 sm:col-span-3" />
                  </div>
                  {editingMemberHasStaffUser && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                      <Label className="sm:text-right" htmlFor="member-username">Username</Label>
                      <Input
                        id="member-username"
                        value={memberLoginUsername}
                        onChange={(e) => setMemberLoginUsername(e.target.value)}
                        className="col-span-1 sm:col-span-3"
                        placeholder="Staff portal username"
                      />
                    </div>
                  )}
                   <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                     <Label className="sm:text-right">Role</Label>
                     <Select value={memberForm.role} onValueChange={(v) => setMemberForm((f) => ({ ...f, role: v as Role }))}>
                       <SelectTrigger className="col-span-1 sm:col-span-3"><SelectValue placeholder="Select role" /></SelectTrigger>
                       <SelectContent>
                         {MEMBER_ROLES.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                       </SelectContent>
                     </Select>
                   </div>
                   {editingMemberHasStaffUser && editingMemberOriginalRole && memberForm.role !== editingMemberOriginalRole && (
                     <Alert className="border-amber-500/50 bg-amber-500/10">
                       <AlertTriangle className="h-4 w-4 text-amber-500" />
                       <AlertDescription className="text-amber-200 text-sm">
                         This member has a staff portal login. Changing their role from <strong>{editingMemberOriginalRole}</strong> to <strong>{memberForm.role}</strong> will affect their training access.
                         {memberForm.role === 'Manager' && ' They will now see Manager-only training content.'}
                         {editingMemberOriginalRole === 'Manager' && memberForm.role !== 'Manager' && ' They will lose access to Manager-only training content.'}
                       </AlertDescription>
                     </Alert>
                   )}
                   <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                     <Label className="sm:text-right" htmlFor="subProducerCode">Sub Producer Code</Label>
                     <Input 
                       id="subProducerCode" 
                       value={memberForm.subProducerCode} 
                       onChange={(e) => setMemberForm((f) => ({ ...f, subProducerCode: e.target.value }))} 
                       className="col-span-1 sm:col-span-3"
                       placeholder="e.g., 401, 402 (optional)"
                     />
                   </div>
                   
                   {memberForm.role === 'Hybrid' && (
                     <div className="grid grid-cols-4 items-start gap-3">
                       <Label className="text-right">Teams</Label>
                       <div className="col-span-3 space-y-2">
                         <p className="text-sm text-muted-foreground">Select which team(s) this hybrid member counts for:</p>
                         <div className="flex items-center space-x-2">
                           <Checkbox 
                             id="sales-team-form"
                             checked={memberForm.hybridTeamAssignments.includes('Sales')}
                             onCheckedChange={(checked) => {
                               setMemberForm(f => ({
                                 ...f,
                                 hybridTeamAssignments: checked 
                                   ? [...f.hybridTeamAssignments, 'Sales']
                                   : f.hybridTeamAssignments.filter(t => t !== 'Sales')
                               }));
                             }}
                           />
                           <Label htmlFor="sales-team-form">Sales Team</Label>
                         </div>
                         <div className="flex items-center space-x-2">
                           <Checkbox 
                             id="service-team-form"
                             checked={memberForm.hybridTeamAssignments.includes('Service')}
                             onCheckedChange={(checked) => {
                               setMemberForm(f => ({
                                 ...f,
                                 hybridTeamAssignments: checked 
                                   ? [...f.hybridTeamAssignments, 'Service']
                                   : f.hybridTeamAssignments.filter(t => t !== 'Service')
                               }));
                             }}
                           />
                           <Label htmlFor="service-team-form">Service Team</Label>
                         </div>
                       </div>
                     </div>
                   )}
                   <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                     <Label className="sm:text-right">Employment</Label>
                     <Select value={memberForm.employment} onValueChange={(v) => setMemberForm((f) => ({ ...f, employment: v as Employment }))}>
                       <SelectTrigger className="col-span-1 sm:col-span-3"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_TYPES.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                   <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                     <Label className="sm:text-right">Status</Label>
                     <Select value={memberForm.status} onValueChange={(v) => setMemberForm((f) => ({ ...f, status: v as MemberStatus }))}>
                       <SelectTrigger className="col-span-1 sm:col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        {MEMBER_STATUS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label className="sm:text-right" htmlFor="includeInMetrics">Include in Metrics</Label>
                    <div className="col-span-1 sm:col-span-3 flex items-center gap-3">
                      <Switch
                        id="includeInMetrics"
                        checked={memberForm.includeInMetrics}
                        onCheckedChange={(checked) => setMemberForm((f) => ({ ...f, includeInMetrics: checked }))}
                      />
                      <span className="text-sm text-muted-foreground">
                        {memberForm.includeInMetrics ? "Included in dashboards and compliance tracking" : "Excluded from metrics (can still submit forms)"}
                      </span>
                    </div>
                  </div>
                   <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-3">
                     <Label className="sm:text-right" htmlFor="notes">Notes</Label>
                     <Textarea id="notes" value={memberForm.notes} onChange={(e) => setMemberForm((f) => ({ ...f, notes: e.target.value }))} className="col-span-1 sm:col-span-3 min-h-[84px]" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>Cancel</Button>
                  <Button variant="flat" onClick={saveMember}>{editingId ? "Save" : "Add"}</Button>
                </div>
              </DialogContent>
            </Dialog>
                </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Sub-Prod Code</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Employment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Staff Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const staffUser = staffByTeamMemberId.get(m.id);
                  return (
                    <TableRow key={m.id} className={m.status === 'inactive' ? 'opacity-60' : ''}>
                      <TableCell>
                        <Link to={`/agency/team/${m.id}`} className="text-primary hover:underline">{m.name}</Link>
                      </TableCell>
                      <TableCell>
                        {m.sub_producer_code ? (
                          <Badge variant="outline" className="font-mono">
                            {m.sub_producer_code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{m.email}</TableCell>
                      <TableCell>{m.role}{m.role === 'Hybrid' && m.hybrid_team_assignments?.length > 0 && ` (${m.hybrid_team_assignments.join(', ')})`}</TableCell>
                      <TableCell>{m.employment}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {m.status === 'inactive' ? (
                            <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/20">Deactivated</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>
                          )}
                          {m.include_in_metrics === false && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Excluded from metrics</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {staffUser ? (
                          staffUser.is_active ? (
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className="bg-green-500/10 text-green-500 border-green-500/20"
                              >
                                ✅ {staffUser.username}
                              </Badge>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openManageLoginModal(m, staffUser)}
                              >
                                Manage
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-600 border-amber-500/20"
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                {staffUser.last_login_at ? "Deactivated" : "Pending"}
                              </Badge>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedMember(m);
                                  setSelectedStaffUser(staffUser);
                                  setNewPassword(generateRandomPassword());
                                  setShowNewPassword(true);
                                  setResetDialogOpen(true);
                                }}
                              >
                                <Key className="h-3 w-3 mr-1" />
                                Set Password
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResendInvite(m)}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Resend
                              </Button>
                            </div>
                          )
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openInviteModal(m)}
                          >
                            <Key className="h-3 w-3 mr-1" />
                            Password Setup
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/agency/team/${m.id}`} aria-label="View">
                            <Button variant="glass" size="icon" className="rounded-full">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                          {staffUser && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="rounded-full"
                              aria-label="Edit Username"
                              onClick={() => openUsernameDialog(staffUser)}
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="secondary" size="icon" className="rounded-full" aria-label="Edit" onClick={() => startEdit(m)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {m.status === 'inactive' ? (
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="rounded-full text-green-600 border-green-600/30 hover:bg-green-500/10" 
                              aria-label="Reactivate" 
                              onClick={() => reactivateMember(m)}
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10" 
                              aria-label="Deactivate" 
                              onClick={() => openDeactivateDialog(m)}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">No team members yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        {/* Key Employees Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Key Employees
            </CardTitle>
            <CardDescription>
              Key employees have full owner-level dashboard access. They log in at myagencybrain.com/auth
            </CardDescription>
          </CardHeader>
          <CardContent>
            {keyEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No key employees yet. Add a key employee to give them owner-level access to your dashboard.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keyEmployees.map((ke) => (
                      <TableRow key={ke.id}>
                        <TableCell className="font-medium">{ke.full_name || 'Unknown'}</TableCell>
                        <TableCell>{ke.email || 'No email'}</TableCell>
                        <TableCell>{new Date(ke.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => {
                              setKeyEmployeeToRemove(ke);
                              setRemoveKeyEmployeeDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="files" className="space-y-6">
        <UploadsContent />
      </TabsContent>

      <TabsContent value="settings" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Agency Settings <span className="text-xs font-semibold text-destructive ml-1">BETA</span></CardTitle>
            <CardDescription>Configure settings for your agency</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {/* Lead Sources Section - Hide for Call Scoring tier */}
              {!isCallScoringTier && (
                <AccordionItem value="lead-sources">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      Lead Sources
                      <HelpButton videoKey="tool-lead-source-manager" />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Manage the lead sources that appear when your team logs quoted households.
                    </p>
                    {agencyId && <LeadSourceManager agencyId={agencyId} />}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Policy Types Section - Hide for Call Scoring tier */}
              {!isCallScoringTier && (
                <AccordionItem value="policy-types">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      Policy Types
                      <HelpButton videoKey="tool-policy-type-manager" />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Manage the policy types that appear when your team logs quoted and sold policies.
                    </p>
                    {agencyId && <PolicyTypeManager agencyId={agencyId} />}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Brokered Carriers Section - Hide for Call Scoring tier */}
              {!isCallScoringTier && (
                <AccordionItem value="brokered-carriers">
                  <AccordionTrigger>Brokered Carriers</AccordionTrigger>
                  <AccordionContent>
                    {agencyId && <BrokeredCarriersManager agencyId={agencyId} />}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Prior Insurance Companies Section - Hide for Call Scoring tier */}
              {!isCallScoringTier && (
                <AccordionItem value="prior-insurance">
                  <AccordionTrigger>Prior Insurance Companies</AccordionTrigger>
                  <AccordionContent>
                    {agencyId && <PriorInsuranceCompaniesManager agencyId={agencyId} />}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Staff Call Recording Access Section - Always show */}
              <AccordionItem value="call-recording">
                <AccordionTrigger>Staff Call Recording Access</AccordionTrigger>
                <AccordionContent>
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div>
                      <Label className="text-base font-medium">Allow Staff Uploads</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Allow Sales, Service, and Hybrid team members to upload call recordings for scoring
                      </p>
                    </div>
                    <Switch
                      checked={staffCanUploadCalls}
                      onCheckedChange={async (checked) => {
                        if (!agencyId) return;
                        setStaffCanUploadCalls(checked);
                        const { error } = await supabase
                          .from("agencies")
                          .update({ staff_can_upload_calls: checked })
                          .eq("id", agencyId);
                        if (error) {
                          console.error("Failed to update setting:", error);
                          setStaffCanUploadCalls(!checked); // Revert on error
                          toast.error("Failed to update setting");
                        } else {
                          toast.success(checked ? "Staff can now upload calls" : "Staff call uploads disabled");
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: Managers and agency owners can always upload calls regardless of this setting.
                  </p>
                </AccordionContent>
              </AccordionItem>

              {/* Sales Email Notifications - Show for admins or agencies with sales beta access */}
              {(isAdmin || hasSalesAccess(agencyId)) && (
                <AccordionItem value="email-notifications">
                  <AccordionTrigger>Sales Email Notifications</AccordionTrigger>
                  <AccordionContent>
                    <SalesEmailSettings agencyId={agencyId} />
                  </AccordionContent>
                </AccordionItem>
              )}

              {(isAdmin || hasSalesAccess(agencyId)) && (
                <AccordionItem value="breakup-letter-settings">
                  <AccordionTrigger>Breakup Letter</AccordionTrigger>
                  <AccordionContent>
                    <BreakupLetterSettings agencyId={agencyId} />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Phone System Integrations */}
              <AccordionItem value="phone-integrations">
                <AccordionTrigger>Phone System Integrations <span className="text-xs font-semibold text-destructive ml-1">BETA</span></AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your phone system to automatically sync call logs and track team performance.
                  </p>
                  {agencyId && (
                    <DashboardCallMetricsToggle agencyId={agencyId} />
                  )}
                  {agencyId && (
                    <RingCentralReportUpload agencyId={agencyId} />
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="reports" className="space-y-6">
        <SavedReportsHistory />
      </TabsContent>

      <TabsContent value="vault" className="space-y-6">
        <ProcessVaultContent />
      </TabsContent>

      <TabsContent value="meeting-frame" className="space-y-6">
        {agencyId && <MeetingFrameTab agencyId={agencyId} />}
      </TabsContent>

      <TabsContent value="core4" className="space-y-6">
        <Core4Tab />
      </TabsContent>

    </Tabs>

    {/* Bulk Team Import Dialog */}
    <Dialog
      open={bulkImportDialogOpen}
      onOpenChange={(open) => {
        setBulkImportDialogOpen(open);
        if (!open) resetBulkImportState();
      }}
    >
      <DialogContent className="glass-surface max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload Team Members</DialogTitle>
          <DialogDescription>
            Upload a CSV with team members, then create staff logins using one shared temporary password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadBulkTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            {bulkImportIssues.length > 0 && (
              <Button type="button" variant="outline" onClick={downloadBulkIssues}>
                <Download className="h-4 w-4 mr-2" />
                Download Errors CSV
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-border/60 p-4 space-y-2">
            <p className="text-sm font-medium">Required columns</p>
            <p className="text-sm text-muted-foreground">`name`, `email`, `role`</p>
            <p className="text-xs text-muted-foreground">
              Bulk import sets everyone to active. Employment defaults to existing value (or Full-time for new members).
            </p>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleBulkFileChange}
              className="text-sm"
            />
            {bulkImportLoading && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing CSV...
              </p>
            )}
            {bulkImportFileName && !bulkImportLoading && (
              <p className="text-sm text-muted-foreground">
                File: <span className="text-foreground font-medium">{bulkImportFileName}</span>
              </p>
            )}
            {bulkImportRows.length > 0 && (
              <p className="text-sm text-green-600">
                {bulkImportRows.length} valid row{bulkImportRows.length === 1 ? "" : "s"} ready to import.
              </p>
            )}
          </div>

          {bulkImportIssues.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
              <p className="text-sm font-medium text-destructive">Validation Issues ({bulkImportIssues.length})</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {bulkImportIssues.map((issue, idx) => (
                  <p key={`${issue.rowNumber}-${idx}`} className="text-xs text-destructive/90">
                    Row {issue.rowNumber}: {issue.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border/60 p-4 space-y-2">
            <Label htmlFor="bulk-temp-password">Temporary Password (applies to all new/activated logins)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="bulk-temp-password"
                  type={showBulkTemporaryPassword ? "text" : "password"}
                  value={bulkTemporaryPassword}
                  onChange={(e) => setBulkTemporaryPassword(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowBulkTemporaryPassword(!showBulkTemporaryPassword)}
                >
                  {showBulkTemporaryPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button type="button" variant="outline" onClick={() => setBulkTemporaryPassword(generateRandomPassword())}>
                Generate
              </Button>
              <Button type="button" variant="outline" onClick={() => copyToClipboard(bulkTemporaryPassword)}>
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This avoids invite links and reset-email deliverability issues. After import, you will get a credentials screen
              with the temporary password and a downloadable CSV.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setBulkImportDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={runBulkImport}
            disabled={bulkImportRunning || bulkImportLoading || bulkImportRows.length === 0 || bulkImportIssues.length > 0}
          >
            {bulkImportRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              "Run Import"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Bulk Credentials Dialog */}
    <Dialog
      open={credentialsDialogOpen}
      onOpenChange={(open) => {
        setCredentialsDialogOpen(open);
        if (!open) {
          setShowAllCredentials(false);
          setRevealedCredentialRows(new Set());
          setShowResultBatchPassword(false);
        }
      }}
    >
      <DialogContent className="glass-surface max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import Results & Credentials</DialogTitle>
          <DialogDescription>
            Credentials are masked by default. Reveal only when needed and download the CSV before closing.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-200">
            Credentials are shown only in this session. Download the credentials CSV now.
          </AlertDescription>
        </Alert>

        {lastBulkTemporaryPassword && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Batch Temporary Password</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm">
                {showResultBatchPassword ? lastBulkTemporaryPassword : "••••••••••••"}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowResultBatchPassword((v) => !v)}>
                {showResultBatchPassword ? "Mask" : "Reveal"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => copyToClipboard(lastBulkTemporaryPassword)}>
                Copy Password
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={copyCredentialsToClipboard}>
            Copy All Credentials
          </Button>
          <Button type="button" variant="outline" onClick={downloadCredentials}>
            <Download className="h-4 w-4 mr-2" />
            Download Credentials CSV
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowAllCredentials((value) => !value)}>
            {showAllCredentials ? "Mask All Passwords" : "Reveal All Passwords"}
          </Button>
        </div>

        <div className="max-h-[380px] overflow-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Temp Password</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bulkCredentialRows.map((row) => {
                const isRevealed = showAllCredentials || revealedCredentialRows.has(row.rowNumber);
                const canReveal = !!row.temporaryPassword;
                return (
                  <TableRow key={`${row.rowNumber}-${row.email}-${row.name}`}>
                    <TableCell>{row.rowNumber}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.username || "-"}</TableCell>
                    <TableCell>
                      {row.temporaryPassword ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{isRevealed ? row.temporaryPassword : "••••••••"}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRevealedCredentialRows((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.rowNumber)) next.delete(row.rowNumber);
                                else next.add(row.rowNumber);
                                return next;
                              });
                            }}
                            disabled={!canReveal}
                          >
                            {isRevealed ? "Mask" : "Reveal"}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Not changed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.result === "error"
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : row.result === "skipped"
                              ? "bg-muted text-muted-foreground"
                              : "bg-green-500/10 text-green-600 border-green-500/20"
                        }
                      >
                        {row.result}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.detail}</TableCell>
                  </TableRow>
                );
              })}
              {bulkCredentialRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No import results yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()}>
            Print
          </Button>
          <Button onClick={() => setCredentialsDialogOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Invite Staff Dialog */}
    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
      <DialogContent className="glass-surface max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selectedMember?.role === 'Key Employee' 
              ? `Add Key Employee Login: ${selectedMember?.name}`
              : `Add Staff Login: ${selectedMember?.name}`
            }
          </DialogTitle>
          <DialogDescription>
            {selectedMember?.role === 'Key Employee' 
              ? 'Create their owner-level dashboard access. They will log in at myagencybrain.com/auth'
              : 'Choose how to create their staff portal access.'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {/* Key Employee requires email - show warning if missing */}
          {selectedMember?.role === 'Key Employee' && !selectedMember?.email && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-medium">Email Required</p>
              <p className="text-sm text-muted-foreground mt-1">
                Key Employees require an email address. Please edit this team member to add their email first.
              </p>
            </div>
          )}

          {/* Mode Selection - only for non-Key Employees */}
          {selectedMember?.role !== 'Key Employee' && (
            <div className="space-y-3">
              <div 
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  inviteMode === 'manual' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setInviteMode('manual')}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    inviteMode === 'manual' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {inviteMode === 'manual' && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <span className="font-medium">Create with Password</span>
                  <Badge variant="secondary" className="ml-auto text-xs">Recommended</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 ml-6">
                  Set their password now and share it directly
                </p>
              </div>
              
              <div 
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  inviteMode === 'email' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                } ${!selectedMember?.email ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => {
                  if (!selectedMember?.email) return;
                  setEmailNoticeModalOpen(true);
                }}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    inviteMode === 'email' ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {inviteMode === 'email' && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <span className="font-medium">Send Email Access</span>
                  <Badge variant="outline" className="ml-auto text-xs bg-destructive/10 text-destructive border-destructive/20">Not Recommended</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 ml-6">
                  {selectedMember?.email 
                    ? `Email access link to ${selectedMember.email}`
                    : 'Requires email address on team member'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Key Employee Password Fields */}
          {selectedMember?.role === 'Key Employee' && selectedMember?.email && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">Login Email</p>
                <p className="font-medium">{selectedMember.email}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-password">Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="manual-password"
                      type={showManualPassword ? "text" : "password"}
                      value={manualPassword}
                      onChange={(e) => setManualPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowManualPassword(!showManualPassword)}
                    >
                      {showManualPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setManualPassword(generateRandomPassword())}
                    title="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(manualPassword)}
                    title="Copy password"
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                They will have full owner-level access to the agency dashboard.
              </p>
            </div>
          )}

          {/* Manual Password Fields - for non-Key Employees */}
          {inviteMode === 'manual' && selectedMember?.role !== 'Key Employee' && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="space-y-2">
                <Label htmlFor="manual-username">Username</Label>
                <Input
                  id="manual-username"
                  value={manualUsername}
                  onChange={(e) => setManualUsername(e.target.value)}
                  placeholder="john.smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-password">Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="manual-password"
                      type={showManualPassword ? "text" : "password"}
                      value={manualPassword}
                      onChange={(e) => setManualPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowManualPassword(!showManualPassword)}
                    >
                      {showManualPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setManualPassword(generateRandomPassword())}
                    title="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(manualPassword)}
                    title="Copy password"
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Email Invite Info */}
          {inviteMode === 'email' && selectedMember?.email && (
            <div className="pt-2 border-t border-border/50">
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">An email will be sent to:</p>
                <p className="font-medium">{selectedMember.email}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                They'll receive a link to set their password. The invite expires in 7 days.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
          {selectedMember?.role === 'Key Employee' ? (
            <Button 
              onClick={handleCreateWithPassword} 
              disabled={inviteLoading || !selectedMember?.email}
            >
              {inviteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Create Key Employee Login
                </>
              )}
            </Button>
          ) : inviteMode === 'manual' ? (
            <Button onClick={handleCreateWithPassword} disabled={inviteLoading}>
              {inviteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Create Login
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleSendInvite} disabled={inviteLoading || !selectedMember?.email}>
              {inviteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Access
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Email Delivery Notice Modal - must be outside parent dialog */}
    <EmailDeliveryNoticeModal 
      open={emailNoticeModalOpen} 
      onOpenChange={setEmailNoticeModalOpen}
      onAcknowledge={() => {
        setEmailNoticeModalOpen(false);
        setInviteMode('email');
      }}
    />

    {/* Manage Login Dialog */}
    <Dialog open={manageLoginDialogOpen} onOpenChange={setManageLoginDialogOpen}>
      <DialogContent className="glass-surface">
        <DialogHeader>
          <DialogTitle>Manage Login: {selectedStaffUser?.username}</DialogTitle>
          <DialogDescription>
            Manage staff credentials for {selectedMember?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-staff-username">Username</Label>
            <div className="flex gap-2">
              <Input
                id="edit-staff-username"
                value={editableUsername}
                onChange={(e) => setEditableUsername(e.target.value)}
                placeholder="Enter username"
              />
              <Button
                variant="outline"
                onClick={handleSaveUsername}
                disabled={savingUsername || !editableUsername.trim() || editableUsername.trim() === (selectedStaffUser?.username || "")}
              >
                {savingUsername ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status</span>
            <Badge 
              variant="outline" 
              className={selectedStaffUser?.is_active 
                ? "bg-green-500/10 text-green-500 border-green-500/20" 
                : "bg-muted text-muted-foreground"
              }
            >
              {selectedStaffUser?.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Last Login</span>
            <span className="text-sm">
              {selectedStaffUser?.last_login_at 
                ? new Date(selectedStaffUser.last_login_at).toLocaleString()
                : "Never"
              }
            </span>
          </div>
          {selectedStaffUser?.email && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Email</span>
              <span className="text-sm">{selectedStaffUser.email}</span>
            </div>
          )}
          <div className="border-t pt-4 space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                setNewPassword(generateRandomPassword());
                setShowNewPassword(true);
                setResetDialogOpen(true);
              }}
            >
              <Key className="h-4 w-4 mr-2" />
              Reset Password
            </Button>
            {selectedStaffUser?.email && (
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleSendResetEmail}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Password Reset Email
              </Button>
            )}
            <Button 
              variant={selectedStaffUser?.is_active ? "destructive" : "outline"}
              className="w-full justify-start"
              onClick={handleToggleActive}
            >
              {selectedStaffUser?.is_active ? (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Deactivate Login
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Activate Login
                </>
              )}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setManageLoginDialogOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Quick Edit Username Dialog */}
    <Dialog open={usernameDialogOpen} onOpenChange={setUsernameDialogOpen}>
      <DialogContent className="glass-surface max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Username</DialogTitle>
          <DialogDescription>
            Update staff login username for {selectedMember?.name || usernameDialogStaffUser?.email || "staff user"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="table-username-edit">Username</Label>
          <Input
            id="table-username-edit"
            value={usernameDialogValue}
            onChange={(e) => setUsernameDialogValue(e.target.value)}
            placeholder="Enter username"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setUsernameDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveUsernameFromTable}
            disabled={usernameDialogSaving || !usernameDialogValue.trim() || usernameDialogValue.trim() === (usernameDialogStaffUser?.username || "")}
          >
            {usernameDialogSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Username"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Reset Password Dialog (context-aware: activate pending users vs reset active users) */}
    <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
      <DialogContent className="glass-surface">
        <DialogHeader>
          <DialogTitle>
            {selectedStaffUser && !selectedStaffUser.is_active ? "Set Password & Activate" : "Reset Password"}
          </DialogTitle>
          <DialogDescription>
            {selectedStaffUser && !selectedStaffUser.is_active
              ? `Set a password to activate ${selectedStaffUser?.username}'s account`
              : `Set a new password for ${selectedStaffUser?.username}`
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-4 items-center gap-3">
            <Label className="text-right">New Password</Label>
            <div className="col-span-3 flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const pwd = generateRandomPassword();
                  setNewPassword(pwd);
                  copyToClipboard(pwd);
                }}
              >
                Generate
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleResetPassword}>
            {selectedStaffUser && !selectedStaffUser.is_active ? "Set Password & Activate" : "Reset Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Deactivate Confirmation Dialog */}
    <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate Team Member</AlertDialogTitle>
          <AlertDialogDescription>
            This will deactivate <strong>{memberToDeactivate?.name}</strong> and revoke their staff login if they have one. Their historical data will be preserved and they can be reactivated later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setMemberToDeactivate(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={deactivateMember}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Deactivate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Add Key Employee Dialog */}
    <Dialog open={keyEmployeeDialogOpen} onOpenChange={setKeyEmployeeDialogOpen}>
      <DialogContent className="glass-surface max-w-md">
        <DialogHeader>
          <DialogTitle>Add Key Employee</DialogTitle>
          <DialogDescription>
            Create an account with owner-level dashboard access. They will log in at myagencybrain.com/auth
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ke-name">Name</Label>
            <Input
              id="ke-name"
              value={keyEmployeeForm.name}
              onChange={(e) => setKeyEmployeeForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Enter name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ke-email">Email (used for login)</Label>
            <Input
              id="ke-email"
              type="email"
              value={keyEmployeeForm.email}
              onChange={(e) => setKeyEmployeeForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Enter email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ke-password">Password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="ke-password"
                  type={showKeyEmployeePassword ? "text" : "password"}
                  value={keyEmployeeForm.password}
                  onChange={(e) => setKeyEmployeeForm(f => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowKeyEmployeePassword(!showKeyEmployeePassword)}
                >
                  {showKeyEmployeePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setKeyEmployeeForm(f => ({ ...f, password: generateRandomPassword() }))}
                title="Generate new password"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(keyEmployeeForm.password)}
                title="Copy password"
              >
                <Key className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setKeyEmployeeDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={async () => {
              if (!keyEmployeeForm.name.trim() || !keyEmployeeForm.email.trim()) {
                toast.error("Name and email are required");
                return;
              }
              if (keyEmployeeForm.password.length < 8) {
                toast.error("Password must be at least 8 characters");
                return;
              }
              
              setKeyEmployeeLoading(true);
              try {
                const { data, error } = await supabase.functions.invoke("create_key_employee_account", {
                  body: {
                    agency_id: agencyId,
                    email: keyEmployeeForm.email.trim(),
                    password: keyEmployeeForm.password,
                    display_name: keyEmployeeForm.name.trim(),
                  },
                });

                if (error) {
                  let errorData: any = {};
                  if (error.context?.json) {
                    try {
                      errorData = await error.context.json();
                    } catch (parseError) {
                      console.error('Could not parse error response:', parseError);
                    }
                  }
                  
                  if (errorData.error === 'email_conflict') {
                    toast.error(errorData.message || "This email is already a key employee.");
                    return;
                  }
                  
                  throw new Error(errorData.message || error.message || 'Failed to create key employee');
                }
                
                if (data?.error) {
                  throw new Error(data.message || data.error);
                }

                await copyToClipboard(keyEmployeeForm.password);
                toast.success(`Key Employee account created! Password copied.`);
                setKeyEmployeeDialogOpen(false);
                setKeyEmployeeForm({ name: '', email: '', password: '' });
                if (agencyId) await refreshData(agencyId);
              } catch (e: any) {
                console.error("Create key employee error:", e);
                toast.error(e?.message || "Failed to create key employee");
              } finally {
                setKeyEmployeeLoading(false);
              }
            }}
            disabled={keyEmployeeLoading}
          >
            {keyEmployeeLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Remove Key Employee Confirmation Dialog */}
    <AlertDialog open={removeKeyEmployeeDialogOpen} onOpenChange={setRemoveKeyEmployeeDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Key Employee</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove <strong>{keyEmployeeToRemove?.full_name || keyEmployeeToRemove?.email || 'this user'}</strong> as a key employee. 
            They will no longer have owner-level access to this agency's dashboard. Their user account will remain active.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setKeyEmployeeToRemove(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={async () => {
              if (!keyEmployeeToRemove || !agencyId) return;
              
              try {
                const { error } = await supabase
                  .from("key_employees")
                  .delete()
                  .eq("id", keyEmployeeToRemove.id);
                
                if (error) throw error;
                
                toast.success("Key employee removed");
                await refreshData(agencyId);
              } catch (e: any) {
                console.error("Remove key employee error:", e);
                toast.error("Failed to remove key employee");
              } finally {
                setRemoveKeyEmployeeDialogOpen(false);
                setKeyEmployeeToRemove(null);
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>
</div>
);
}
