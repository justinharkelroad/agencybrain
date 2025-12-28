import { 
  LayoutDashboard, 
  Bot, 
  FileX, 
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
  type LucideIcon
} from "lucide-react";

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
};

export type NavFolder = {
  id: string;
  title: string;
  icon: LucideIcon;
  access: AccessConfig;
  items: NavItem[];
  isFolder: true;
};

export type NavEntry = NavItem | NavFolder;

export const isNavFolder = (entry: NavEntry): entry is NavFolder => {
  return 'isFolder' in entry && entry.isFolder === true;
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

  // Sales folder
  {
    id: 'sales',
    title: 'Sales',
    icon: Bot,
    isFolder: true,
    access: { staff: true, manager: true, owner: true },
    items: [
      {
        id: 'ai-sales-bot',
        title: 'AI Sales Bot',
        icon: Bot,
        type: 'link',
        url: '/roleplaybot',
        access: { staff: true, manager: true, owner: true },
        requiresTier: '1:1',
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
        id: 'video-training-architect',
        title: 'Video Training Architect',
        icon: Video,
        type: 'modal',
        modalKey: 'video_training',
        access: { staff: false, manager: true, owner: true },
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
        id: 'vendor-verifier',
        title: 'Vendor Verifier',
        icon: ShieldCheck,
        type: 'modal',
        modalKey: 'vendor',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'data-lead-forecaster',
        title: 'Data Lead Forecaster',
        icon: BarChart3,
        type: 'modal',
        modalKey: 'data',
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
        id: 'live-transfer-forecaster',
        title: 'Live Transfer Forecaster',
        icon: PhoneIncoming,
        type: 'modal',
        modalKey: 'transfer',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'annual-bonus-tool',
        title: 'Annual Bonus Tool',
        icon: Calculator,
        type: 'modal',
        modalKey: 'bonus_forecast',
        access: { staff: false, manager: false, owner: true }, // Owner + Key Employees only
      },
      {
        id: 'producer-quote-dashboard',
        title: 'Producer Quote Details',
        icon: ExternalLink,
        type: 'external',
        externalUrl: 'https://quickquote-reality.lovable.app/',
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
        id: 'call-efficiency-tool',
        title: 'Call Efficiency Tool',
        icon: PhoneCall,
        type: 'modal',
        modalKey: 'call_efficiency',
        access: { staff: false, manager: true, owner: true },
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
        title: 'Set Your Quarterly Targets',
        icon: Target,
        type: 'link',
        url: '/life-targets',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: '90-day-audio',
        title: 'Create Your 90 Day Target Audio',
        icon: AudioLines,
        type: 'link',
        url: '/theta-talk-track',
        access: { staff: true, manager: true, owner: true },
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
    access: { staff: false, manager: true, owner: true },
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

  // Submit Form - direct link (will use dynamic URL based on available forms)
  {
    id: 'submit-form',
    title: 'Submit Form',
    icon: ClipboardEdit,
    type: 'link',
    url: '/staff/submit',
    access: { staff: true, manager: true, owner: true },
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
        id: 'ai-sales-bot',
        title: 'AI Sales Bot',
        icon: Bot,
        type: 'link',
        url: '/staff/roleplaybot',
        access: { staff: true, manager: true, owner: true },
        requiresTier: '1:1',
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
        id: 'call-scoring',
        title: 'Call Scoring',
        icon: Phone,
        type: 'link',
        url: '/staff/call-scoring',
        access: { staff: true, manager: true, owner: true },
        settingCheck: 'callScoringEnabled',
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
        id: 'video-training-architect',
        title: 'Video Training Architect',
        icon: Video,
        type: 'modal',
        modalKey: 'video_training',
        access: { staff: false, manager: true, owner: true },
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
        id: 'vendor-verifier',
        title: 'Vendor Verifier',
        icon: ShieldCheck,
        type: 'modal',
        modalKey: 'vendor',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'data-lead-forecaster',
        title: 'Data Lead Forecaster',
        icon: BarChart3,
        type: 'modal',
        modalKey: 'data',
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
        id: 'live-transfer-forecaster',
        title: 'Live Transfer Forecaster',
        icon: PhoneIncoming,
        type: 'modal',
        modalKey: 'transfer',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'producer-quote-dashboard',
        title: 'Producer Quote Details',
        icon: ExternalLink,
        type: 'external',
        externalUrl: 'https://quickquote-reality.lovable.app/',
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
        id: 'call-efficiency-tool',
        title: 'Call Efficiency Tool',
        icon: PhoneCall,
        type: 'modal',
        modalKey: 'call_efficiency',
        access: { staff: false, manager: true, owner: true },
      },
      {
        id: 'annual-bonus-tool',
        title: 'Annual Bonus Tool',
        icon: Calculator,
        type: 'modal',
        modalKey: 'bonus_forecast',
        access: { staff: false, manager: false, owner: true },
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
        title: 'Set Your Quarterly Targets',
        icon: Target,
        type: 'link',
        url: '/staff/life-targets',
        access: { staff: true, manager: true, owner: true },
      },
      {
        id: '90-day-audio',
        title: 'Create Your 90 Day Target Audio',
        icon: AudioLines,
        type: 'link',
        url: '/staff/theta-talk-track',
        access: { staff: true, manager: true, owner: true },
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
