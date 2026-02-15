import {
  LayoutDashboard,
  Bot,
  FileX,
  RefreshCw,
  ClipboardList,
  Phone,
  BookOpen,
  GraduationCap,
  Video,
  Building2,
  ShieldCheck,
  BarChart3,
  Mail,
  PhoneIncoming,
  Calculator,
  Users,
  ExternalLink,
  PhoneCall,
  Sparkles,
  Heart,
  Target,
  AudioLines,
  Rocket,
  ArrowLeftRight,
  ClipboardEdit,
  FileSpreadsheet,
  Settings,
  RotateCcw,
  Contact,
  Workflow,
  Trophy,
  FileText,
  MessageSquare,
  type LucideIcon
} from "lucide-react";
import { TrendingUp } from "lucide-react";

export type NavItemType = 'link' | 'modal' | 'external';

export type AccessConfig = {
  staff: boolean;
  manager: boolean;
  owner: boolean;
};

export type NavItem = {
  id: string;
  title: string;
  icon: LucideIcon;
  type: NavItemType;
  url?: string;
  externalUrl?: string;
  modalKey?: string;
  access: AccessConfig;
  featureCheck?: string;
  settingCheck?: 'callScoringEnabled';
  requiresTier?: '1:1';  // Requires 1:1 Coaching tier - Boardroom users see gate modal
  adminOnly?: boolean;   // Only visible to system admins (not regular agency owners)
  emailRestriction?: string;  // Only visible to this specific email address
  challengeAccess?: boolean;  // Requires agency to be in challenge beta list
  trialRestricted?: boolean;  // Some functionality restricted during trial (shows indicator)
  salesExperienceAccess?: boolean;  // Requires agency to have active sales experience assignment
  salesProcessBuilderAccess?: boolean;  // Requires agency to have sales_process_builder feature flag
  coachingInsightsAccess?: boolean;     // Requires agency to be in coaching insights beta list
  callGapsAccess?: boolean;  // Requires agency to have call_gaps feature flag
};

// Sub-folder that can appear inside a NavFolder
export type NavSubFolder = {
  id: string;
  title: string;
  icon: LucideIcon;
  access: AccessConfig;
  items: NavItem[];
  isSubFolder: true;
};

export type NavFolder = {
  id: string;
  title: string;
  icon: LucideIcon;
  access: AccessConfig;
  items: (NavItem | NavSubFolder)[];  // Can contain items or sub-folders
  isFolder: true;
  salesExperienceAccess?: boolean;  // Requires agency to have active sales experience assignment
};

export type NavEntry = NavItem | NavFolder;

export const isNavFolder = (entry: NavEntry): entry is NavFolder => {
  return 'isFolder' in entry && entry.isFolder === true;
};

export const isNavSubFolder = (item: NavItem | NavSubFolder): item is NavSubFolder => {
  return 'isSubFolder' in item && item.isSubFolder === true;
};

export const navigationConfig: NavEntry[] = [
  // Dashboard - direct link for everyone
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    type: 'link',
    url: '/dashboard',
    access: { staff: true, manager: true, owner: true },
  },

  // Contacts - unified contact profiles
  {
    id: 'contacts',
    title: 'Contacts',
    icon: Contact,
    type: 'link',
    url: '/contacts',
    access: { staff: true, manager: true, owner: true },
  },

  // Sequence Queue - tasks from assigned onboarding sequences
  {
    id: 'onboarding-tasks',
    title: 'Sequence Queue',
    icon: Workflow,
    type: 'link',
    url: '/onboarding-tasks',
    access: { staff: true, manager: true, owner: true },
  },

  // Call Scoring - TOP LEVEL for prominent visibility
  {
    id: 'call-scoring-top',
    title: 'Call Scoring',
    icon: Phone,
    type: 'link',
    url: '/call-scoring',
    access: { staff: true, manager: true, owner: true },
    settingCheck: 'callScoringEnabled',
  },

  // Sales folder - Sales Dashboard is admin-only for now
  {
    id: 'sales',
    title: 'Sales',
    icon: Bot,
    isFolder: true,
    access: { staff: true, manager: true, owner: true },
    items: [
      {
        id: 'sales-dashboard',
        title: 'Sales Dashboard',
        icon: LayoutDashboard,
        type: 'link',
        url: '/sales',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'lqs-roadmap',
        title: 'LQS Roadmap',
        icon: Target,
        type: 'link',
        url: '/lqs-roadmap',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'lqs-roi',
        title: 'ROI Analytics',
        icon: BarChart3,
        type: 'link',
        url: '/lqs-roi',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'objection-manager',
        title: 'Objection Manager',
        icon: ClipboardList,
        type: 'link',
        url: '/objection-manager',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'coaching-insights',
        title: 'Coaching Insights',
        icon: Sparkles,
        type: 'link',
        url: '/coaching-insights',
        access: { staff: true, manager: true, owner: true },
        coachingInsightsAccess: true,
      },
      {
        id: 'ai-sales-bot',
        title: 'AI Sales Bot',
        icon: Bot,
        type: 'link',
        url: '/roleplaybot',
        access: { staff: true, manager: true, owner: true },
        requiresTier: '1:1',
      },
      {
        id: 'winback-hq',
        title: 'Winback HQ',
        icon: RotateCcw,
        type: 'link',
        url: '/winback',
        access: { staff: true, manager: true, owner: true },
      },
    ],
  },

  // Service folder
  {
    id: 'service',
    title: 'Service',
    icon: FileX,
    isFolder: true,
    access: { staff: true, manager: true, owner: true },
    items: [
      {
        id: 'cancel-audit',
        title: 'Cancel Audit',
        icon: FileX,
        type: 'link',
        url: '/cancel-audit',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'renewals',
        title: 'Renewals',
        icon: RefreshCw,
        type: 'link',
        url: '/renewals',
        access: { staff: true, manager: true, owner: true },
      },
    ],
  },

  // Accountability folder
  {
    id: 'accountability',
    title: 'Accountability',
    icon: ClipboardList,
    isFolder: true,
    access: { staff: true, manager: true, owner: true },
    items: [
      {
        id: 'scorecards',
        title: 'Scorecards',
        icon: ClipboardList,
        type: 'link',
        url: '/metrics',
        access: { staff: true, manager: true, owner: true },
        trialRestricted: true,  // Editing/creating restricted during trial
      },
      {
        id: 'call-scoring',
        title: 'Call Scoring',
        icon: Phone,
        type: 'link',
        url: '/call-scoring',
        access: { staff: true, manager: true, owner: true },
        settingCheck: 'callScoringEnabled',
      },
    ],
  },

  // Training folder
  {
    id: 'training',
    title: 'Training',
    icon: GraduationCap,
    isFolder: true,
    access: { staff: true, manager: true, owner: true },
    items: [
      {
        id: 'standard-playbook',
        title: 'Standard Playbook',
        icon: BookOpen,
        type: 'link',
        url: '/training/standard',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'agency-training',
        title: 'Agency Training',
        icon: GraduationCap,
        type: 'link',
        url: '/training/agency',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'manage-training',
        title: 'Manage Training',
        icon: Settings,
        type: 'link',
        url: '/training/agency/manage',
        access: { staff: false, manager: false, owner: true },
      },
      {
        id: 'video-training-architect',
        title: 'Video Architect',
        icon: Video,
        type: 'modal',
        modalKey: 'video_training',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'six-week-challenge',
        title: '6-Week Challenge',
        icon: Target,
        type: 'link',
        url: '/training/challenge',
        access: { staff: false, manager: true, owner: true },
        challengeAccess: true,
      },
    ],
  },

  // 8-Week Sales Experience - Owner/Manager only, conditional on assignment
  {
    id: 'sales-experience',
    title: '8-Week Experience',
    icon: Trophy,
    isFolder: true,
    access: { staff: false, manager: true, owner: true },
    salesExperienceAccess: true,
    items: [
      {
        id: 'se-overview',
        title: 'Overview & Progress',
        icon: LayoutDashboard,
        type: 'link',
        url: '/sales-experience',
        access: { staff: false, manager: true, owner: true },
        salesExperienceAccess: true,
      },
      // Week 1: Sales Process Foundation
      {
        id: 'se-week-1',
        title: 'Week 1: Foundation',
        icon: BookOpen,
        isSubFolder: true,
        access: { staff: false, manager: true, owner: true },
        items: [
          {
            id: 'se-week-1-lessons',
            title: 'Lesson Materials',
            icon: Video,
            type: 'link',
            url: '/sales-experience/week/1',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-1-documents',
            title: 'Documents',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/1/documents',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-1-transcript',
            title: 'Transcript',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/1/transcript',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
        ],
      },
      // Week 2: Prospecting & Pipeline
      {
        id: 'se-week-2',
        title: 'Week 2: Prospecting',
        icon: BookOpen,
        isSubFolder: true,
        access: { staff: false, manager: true, owner: true },
        items: [
          {
            id: 'se-week-2-lessons',
            title: 'Lesson Materials',
            icon: Video,
            type: 'link',
            url: '/sales-experience/week/2',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-2-documents',
            title: 'Documents',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/2/documents',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-2-transcript',
            title: 'Transcript',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/2/transcript',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
        ],
      },
      // Week 3: Discovery & Qualification
      {
        id: 'se-week-3',
        title: 'Week 3: Discovery',
        icon: BookOpen,
        isSubFolder: true,
        access: { staff: false, manager: true, owner: true },
        items: [
          {
            id: 'se-week-3-lessons',
            title: 'Lesson Materials',
            icon: Video,
            type: 'link',
            url: '/sales-experience/week/3',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-3-documents',
            title: 'Documents',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/3/documents',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-3-transcript',
            title: 'Transcript',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/3/transcript',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
        ],
      },
      // Week 4: Building Accountability Systems
      {
        id: 'se-week-4',
        title: 'Week 4: Accountability',
        icon: BookOpen,
        isSubFolder: true,
        access: { staff: false, manager: true, owner: true },
        items: [
          {
            id: 'se-week-4-lessons',
            title: 'Lesson Materials',
            icon: Video,
            type: 'link',
            url: '/sales-experience/week/4',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-4-documents',
            title: 'Documents',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/4/documents',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-4-transcript',
            title: 'Transcript',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/4/transcript',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
        ],
      },
      // Week 5: Metrics & Performance Tracking
      {
        id: 'se-week-5',
        title: 'Week 5: Metrics',
        icon: BookOpen,
        isSubFolder: true,
        access: { staff: false, manager: true, owner: true },
        items: [
          {
            id: 'se-week-5-lessons',
            title: 'Lesson Materials',
            icon: Video,
            type: 'link',
            url: '/sales-experience/week/5',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-5-documents',
            title: 'Documents',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/5/documents',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-5-transcript',
            title: 'Transcript',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/5/transcript',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
        ],
      },
      // Week 6: Coaching Fundamentals
      {
        id: 'se-week-6',
        title: 'Week 6: Coaching',
        icon: BookOpen,
        isSubFolder: true,
        access: { staff: false, manager: true, owner: true },
        items: [
          {
            id: 'se-week-6-lessons',
            title: 'Lesson Materials',
            icon: Video,
            type: 'link',
            url: '/sales-experience/week/6',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-6-documents',
            title: 'Documents',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/6/documents',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-6-transcript',
            title: 'Transcript',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/6/transcript',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
        ],
      },
      // Week 7: One-on-One Excellence
      {
        id: 'se-week-7',
        title: 'Week 7: One-on-Ones',
        icon: BookOpen,
        isSubFolder: true,
        access: { staff: false, manager: true, owner: true },
        items: [
          {
            id: 'se-week-7-lessons',
            title: 'Lesson Materials',
            icon: Video,
            type: 'link',
            url: '/sales-experience/week/7',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-7-documents',
            title: 'Documents',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/7/documents',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-7-transcript',
            title: 'Transcript',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/7/transcript',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
        ],
      },
      // Week 8: Sustaining the System
      {
        id: 'se-week-8',
        title: 'Week 8: Sustaining',
        icon: BookOpen,
        isSubFolder: true,
        access: { staff: false, manager: true, owner: true },
        items: [
          {
            id: 'se-week-8-lessons',
            title: 'Lesson Materials',
            icon: Video,
            type: 'link',
            url: '/sales-experience/week/8',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-8-documents',
            title: 'Documents',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/8/documents',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
          {
            id: 'se-week-8-transcript',
            title: 'Transcript',
            icon: FileText,
            type: 'link',
            url: '/sales-experience/week/8/transcript',
            access: { staff: false, manager: true, owner: true },
            salesExperienceAccess: true,
          },
        ],
      },
      // Coach Messages
      {
        id: 'se-messages',
        title: 'Coach Messages',
        icon: MessageSquare,
        type: 'link',
        url: '/sales-experience/messages',
        access: { staff: false, manager: true, owner: true },
        salesExperienceAccess: true,
      },
      // Team Progress
      {
        id: 'se-team-progress',
        title: 'Team Quiz Results',
        icon: Users,
        type: 'link',
        url: '/sales-experience/team-progress',
        access: { staff: false, manager: true, owner: true },
        salesExperienceAccess: true,
      },
      // Deliverables
      {
        id: 'se-deliverables',
        title: 'Your Deliverables',
        icon: FileText,
        type: 'link',
        url: '/sales-experience/deliverables',
        access: { staff: false, manager: true, owner: true },
        salesExperienceAccess: true,
      },
    ],
  },

  // Agency Mgmt folder - managers and owners
  {
    id: 'agency-mgmt',
    title: 'Agency Mgmt',
    icon: Building2,
    isFolder: true,
    access: { staff: false, manager: true, owner: true },
    items: [
      {
        id: 'sequence-builder',
        title: 'Sequence Builder',
        icon: Workflow,
        type: 'link',
        url: '/sequence-builder',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'sales-process-builder',
        title: 'Sales Process Builder',
        icon: Sparkles,
        type: 'link',
        url: '/tools/sales-process-builder',
        access: { staff: false, manager: true, owner: true },
        salesProcessBuilderAccess: true,
      },
      {
        id: 'annual-bonus-tool',
        title: 'Annual Bonus Tool',
        icon: Calculator,
        type: 'modal',
        modalKey: 'bonus_forecast',
        access: { staff: false, manager: false, owner: true },
      },
      {
        id: 'call-efficiency-tool',
        title: 'Call Efficiency Tool',
        icon: PhoneCall,
        type: 'modal',
        modalKey: 'call_efficiency',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'compensation-analyzer',
        title: 'Compensation Analyzer',
        icon: FileSpreadsheet,
        type: 'link',
        url: '/compensation-analyzer',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'call-gaps-analyzer',
        title: 'Call Gaps Analyzer',
        icon: BarChart3,
        type: 'link',
        url: '/call-gaps',
        access: { staff: false, manager: true, owner: true },
        callGapsAccess: true,
      },
      {
        id: 'growth-center',
        title: 'Growth Center',
        icon: TrendingUp,
        type: 'link',
        url: '/growth-center',
        access: { staff: false, manager: true, owner: true },
        requiresTier: '1:1',
      },
      {
        id: 'producer-quote-dashboard',
        title: 'Quote Details',
        icon: ExternalLink,
        type: 'external',
        externalUrl: 'https://quickquote-reality.lovable.app/',
        access: { staff: false, manager: true, owner: true },
      },
      // Agency ROI Sub-folder
      {
        id: 'agency-roi',
        title: 'Agency ROI',
        icon: TrendingUp,
        isSubFolder: true,
        access: { staff: false, manager: true, owner: true },
        items: [
          {
            id: 'data-lead-forecaster',
            title: 'Data Forecaster',
            icon: BarChart3,
            type: 'modal',
            modalKey: 'data',
            access: { staff: false, manager: true, owner: true },
          },
          {
            id: 'live-transfer-forecaster',
            title: 'Transfer Forecaster',
            icon: PhoneIncoming,
            type: 'modal',
            modalKey: 'transfer',
            access: { staff: false, manager: true, owner: true },
          },
          {
            id: 'mailer-forecaster',
            title: 'Mailer Forecaster',
            icon: Mail,
            type: 'modal',
            modalKey: 'mailer',
            access: { staff: false, manager: true, owner: true },
          },
          {
            id: 'roi-on-staff',
            title: 'ROI on Staff',
            icon: Users,
            type: 'modal',
            modalKey: 'staff_roi',
            access: { staff: false, manager: true, owner: true },
          },
          {
            id: 'vendor-verifier',
            title: 'Vendor Verifier',
            icon: ShieldCheck,
            type: 'modal',
            modalKey: 'vendor',
            access: { staff: false, manager: true, owner: true },
          },
        ],
      },
    ],
  },

  // Personal Growth folder
  {
    id: 'personal-growth',
    title: 'Personal Growth',
    icon: Heart,
    isFolder: true,
    access: { staff: true, manager: true, owner: true },
    items: [
      {
        id: 'flows',
        title: 'Flows',
        icon: Sparkles,
        type: 'link',
        url: '/flows',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'core4',
        title: 'Core 4',
        icon: Heart,
        type: 'link',
        url: '/core4',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'quarterly-targets',
        title: 'Quarterly Targets',
        icon: Target,
        type: 'link',
        url: '/life-targets',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: '90-day-audio',
        title: '90 Day Audio',
        icon: AudioLines,
        type: 'link',
        url: '/theta-talk-track',
        access: { staff: true, manager: true, owner: true },
        requiresTier: '1:1',
      },
      {
        id: 'monthly-missions',
        title: 'Monthly Missions',
        icon: Rocket,
        type: 'link',
        url: '/core4#monthly-missions',
        access: { staff: true, manager: true, owner: true },
      },
    ],
  },

  // The Exchange - direct link for manager+ only
  {
    id: 'the-exchange',
    title: 'The Exchange',
    icon: ArrowLeftRight,
    type: 'link',
    url: '/exchange',
        access: { staff: true, manager: true, owner: true },
  },
];

// ============================================
// STAFF PORTAL NAVIGATION CONFIG
// ============================================
// Staff uses /staff/* routes and has role-based access
// Managers get: Video Training Architect, Agency Mgmt folder
// Staff (non-managers) don't see manager-only items

export const staffNavigationConfig: NavEntry[] = [
  // Dashboard - direct link
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    type: 'link',
    url: '/staff/dashboard',
    access: { staff: true, manager: true, owner: true },
  },

  // Contacts - unified contact profiles
  {
    id: 'contacts',
    title: 'Contacts',
    icon: Contact,
    type: 'link',
    url: '/staff/contacts',
    access: { staff: true, manager: true, owner: true },
  },

  // Submit Form - direct link (will use dynamic URL based on available forms)
  {
    id: 'submit-form',
    title: 'Submit Form',
    icon: ClipboardEdit,
    type: 'link',
    url: '/staff/submit',
    access: { staff: true, manager: true, owner: true },
  },

  // Sequence Queue - tasks from assigned onboarding sequences
  {
    id: 'onboarding-tasks',
    title: 'Sequence Queue',
    icon: Workflow,
    type: 'link',
    url: '/staff/onboarding-tasks',
    access: { staff: true, manager: true, owner: true },
  },

  // Call Scoring - TOP LEVEL for Call Scoring tier visibility
  {
    id: 'call-scoring-top',
    title: 'Call Scoring',
    icon: Phone,
    type: 'link',
    url: '/staff/call-scoring',
    access: { staff: true, manager: true, owner: true },
    settingCheck: 'callScoringEnabled',
  },

  // Sales folder
  {
    id: 'sales',
    title: 'Sales',
    icon: Bot,
    isFolder: true,
    access: { staff: true, manager: true, owner: true },
    items: [
      {
        id: 'sales-dashboard',
        title: 'Sales Dashboard',
        icon: LayoutDashboard,
        type: 'link',
        url: '/staff/sales',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'lqs-roadmap',
        title: 'LQS Roadmap',
        icon: Target,
        type: 'link',
        url: '/staff/lqs-roadmap',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'ai-sales-bot',
        title: 'AI Sales Bot',
        icon: Bot,
        type: 'link',
        url: '/staff/roleplaybot',
        access: { staff: true, manager: true, owner: true },
        requiresTier: '1:1',
      },
      {
        id: 'winback-hq',
        title: 'Winback HQ',
        icon: RotateCcw,
        type: 'link',
        url: '/staff/winback',
        access: { staff: true, manager: true, owner: true },
      },
    ],
  },

  // Accountability folder
  {
    id: 'accountability',
    title: 'Accountability',
    icon: ClipboardList,
    isFolder: true,
    access: { staff: true, manager: true, owner: true },
    items: [
      {
        id: 'scorecards',
        title: 'Scorecards',
        icon: ClipboardList,
        type: 'link',
        url: '/staff/metrics',
        access: { staff: false, manager: true, owner: true },
        trialRestricted: true,  // Editing/creating restricted during trial
      },
      {
        id: 'call-scoring',
        title: 'Call Scoring',
        icon: Phone,
        type: 'link',
        url: '/staff/call-scoring',
        access: { staff: true, manager: true, owner: true },
        settingCheck: 'callScoringEnabled',
      },
      {
        id: 'call-gaps-analyzer',
        title: 'Call Gaps Analyzer',
        icon: BarChart3,
        type: 'link',
        url: '/staff/call-gaps',
        access: { staff: false, manager: true, owner: true },
        callGapsAccess: true,
      },
    ],
  },

  // Service folder
  {
    id: 'service',
    title: 'Service',
    icon: FileX,
    isFolder: true,
    access: { staff: true, manager: true, owner: true },
    items: [
      {
        id: 'cancel-audit',
        title: 'Cancel Audit',
        icon: FileX,
        type: 'link',
        url: '/staff/cancel-audit',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'renewals',
        title: 'Renewals',
        icon: RefreshCw,
        type: 'link',
        url: '/staff/renewals',
        access: { staff: true, manager: true, owner: true },
      },
    ],
  },

  // Training folder - Video Training Architect for managers only
  {
    id: 'training',
    title: 'Training',
    icon: GraduationCap,
    isFolder: true,
    access: { staff: true, manager: true, owner: true },
    items: [
      {
        id: 'standard-playbook',
        title: 'Standard Playbook',
        icon: BookOpen,
        type: 'link',
        url: '/staff/training/standard',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'agency-training',
        title: 'Agency Training',
        icon: GraduationCap,
        type: 'link',
        url: '/staff/training/agency',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'manage-training',
        title: 'Manage Training',
        icon: GraduationCap,
        type: 'link',
        url: '/staff/training/manage',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'video-training-architect',
        title: 'Video Architect',
        icon: Video,
        type: 'modal',
        modalKey: 'video_training',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'staff-six-week-challenge',
        title: 'The Challenge',
        icon: Target,
        type: 'link',
        url: '/staff/challenge',
        access: { staff: true, manager: true, owner: true },
        challengeAccess: true,
      },
      {
        id: 'staff-sales-training',
        title: '8 Week Sales Experience',
        icon: Trophy,
        type: 'link',
        url: '/staff/sales-training',
        access: { staff: true, manager: true, owner: true },
      },
    ],
  },

  // Agency Mgmt folder - managers only
  {
    id: 'agency-mgmt',
    title: 'Agency Mgmt',
    icon: Building2,
    isFolder: true,
    access: { staff: false, manager: true, owner: true },
    items: [
      {
        id: 'annual-bonus-tool',
        title: 'Annual Bonus Tool',
        icon: Calculator,
        type: 'modal',
        modalKey: 'bonus_forecast',
        access: { staff: false, manager: false, owner: true },
      },
      {
        id: 'call-efficiency-tool',
        title: 'Call Efficiency Tool',
        icon: PhoneCall,
        type: 'modal',
        modalKey: 'call_efficiency',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'producer-quote-dashboard',
        title: 'Quote Details',
        icon: ExternalLink,
        type: 'external',
        externalUrl: 'https://quickquote-reality.lovable.app/',
        access: { staff: false, manager: true, owner: true },
      },
      // Agency ROI Sub-folder
      {
        id: 'agency-roi',
        title: 'Agency ROI',
        icon: TrendingUp,
        isSubFolder: true,
        access: { staff: false, manager: true, owner: true },
        items: [
          {
            id: 'data-lead-forecaster',
            title: 'Data Forecaster',
            icon: BarChart3,
            type: 'modal',
            modalKey: 'data',
            access: { staff: false, manager: true, owner: true },
          },
          {
            id: 'live-transfer-forecaster',
            title: 'Transfer Forecaster',
            icon: PhoneIncoming,
            type: 'modal',
            modalKey: 'transfer',
            access: { staff: false, manager: true, owner: true },
          },
          {
            id: 'mailer-forecaster',
            title: 'Mailer Forecaster',
            icon: Mail,
            type: 'modal',
            modalKey: 'mailer',
            access: { staff: false, manager: true, owner: true },
          },
          {
            id: 'roi-on-staff',
            title: 'ROI on Staff',
            icon: Users,
            type: 'modal',
            modalKey: 'staff_roi',
            access: { staff: false, manager: true, owner: true },
          },
          {
            id: 'vendor-verifier',
            title: 'Vendor Verifier',
            icon: ShieldCheck,
            type: 'modal',
            modalKey: 'vendor',
            access: { staff: false, manager: true, owner: true },
          },
        ],
      },
    ],
  },

  // Personal Growth folder - ALL items
  {
    id: 'personal-growth',
    title: 'Personal Growth',
    icon: Heart,
    isFolder: true,
    access: { staff: true, manager: true, owner: true },
    items: [
      {
        id: 'flows',
        title: 'Flows',
        icon: Sparkles,
        type: 'link',
        url: '/staff/flows',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'core4',
        title: 'Core 4',
        icon: Heart,
        type: 'link',
        url: '/staff/core4',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: 'quarterly-targets',
        title: 'Quarterly Targets',
        icon: Target,
        type: 'link',
        url: '/staff/life-targets',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: '90-day-audio',
        title: '90 Day Audio',
        icon: AudioLines,
        type: 'link',
        url: '/staff/theta-talk-track',
        access: { staff: true, manager: true, owner: true },
        requiresTier: '1:1',
      },
      {
        id: 'monthly-missions',
        title: 'Monthly Missions',
        icon: Rocket,
        type: 'link',
        url: '/staff/core4#monthly-missions',
        access: { staff: true, manager: true, owner: true },
      },
    ],
  },
];
