import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  LayoutDashboard,
  Users,
  ListOrdered,
  Phone,
  TrendingUp,
  Shield,
  GraduationCap,
  Building2,
  Sparkles,
  MessageSquare,
  Settings,
  CreditCard,
  LogOut,
  Plus,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

// Logo with Stan
const LOGO_WITH_STAN = 'https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/Agency%20Brain%20Logo%20Stan.png';

interface NavItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ElementType;
  children?: NavItem[];
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { id: 'dashboard', label: 'DASHBOARD', href: '/dashboard', icon: LayoutDashboard },
  { id: 'contacts', label: 'CONTACTS', href: '/contacts', icon: Users },
  { id: 'sequence-queue', label: 'SEQUENCE QUEUE', href: '/sequence-queue', icon: ListOrdered },
  {
    id: 'sales',
    label: 'SALES',
    icon: TrendingUp,
    children: [
      { id: 'sales-dashboard', label: 'SALES DASHBOARD', href: '/sales-dashboard' },
      { id: 'lqs', label: 'LQS ROADMAP', href: '/lqs' },
      { id: 'roi', label: 'ROI ANALYTICS', href: '/roi' },
      { id: 'objections', label: 'OBJECTION MANAGER', href: '/objections' },
      { id: 'ai-bot', label: 'AI SALES BOT', href: '/ai-roleplay' },
      { id: 'winback', label: 'WINBACK HQ', href: '/winback' },
    ],
  },
  {
    id: 'service',
    label: 'SERVICE',
    icon: Shield,
    children: [
      { id: 'cancel-audit', label: 'CANCEL AUDIT', href: '/cancel-audit' },
      { id: 'renewals', label: 'RENEWALS', href: '/renewals' },
    ],
  },
  {
    id: 'accountability',
    label: 'ACCOUNTABILITY',
    icon: Phone,
    children: [
      { id: 'scorecards', label: 'SCORECARDS', href: '/scorecards' },
      { id: 'call-scoring', label: 'CALL SCORING', href: '/call-scoring' },
    ],
  },
  {
    id: 'training',
    label: 'TRAINING',
    icon: GraduationCap,
    children: [
      { id: 'standard-playbook', label: 'STANDARD PLAYBOOK', href: '/standard-playbook' },
      { id: 'agency-training', label: 'AGENCY TRAINING', href: '/agency-training' },
      { id: 'manage-training', label: 'MANAGE TRAINING', href: '/manage-training' },
    ],
  },
  {
    id: 'agency-mgmt',
    label: 'AGENCY MGMT',
    icon: Building2,
    children: [
      { id: 'sequence-builder', label: 'SEQUENCE BUILDER', href: '/sequence-builder' },
      { id: 'sales-process', label: 'SALES PROCESS', href: '/sales-process-builder' },
      { id: 'bonus-tool', label: 'ANNUAL BONUS TOOL', href: '/annual-bonus' },
      { id: 'compensation', label: 'COMPENSATION ANALYZER', href: '/compensation' },
    ],
  },
  {
    id: 'personal-growth',
    label: 'PERSONAL GROWTH',
    icon: Sparkles,
    children: [
      { id: 'flows', label: 'FLOWS', href: '/flows' },
      { id: 'core4', label: 'CORE 4', href: '/core4' },
      { id: 'targets', label: 'QUARTERLY TARGETS', href: '/targets' },
    ],
  },
  { id: 'exchange', label: 'THE EXCHANGE', href: '/exchange', icon: MessageSquare },
];

const adminNavItems: NavItem[] = [
  {
    id: 'admin',
    label: 'ADMIN',
    icon: Settings,
    children: [
      { id: 'admin-dashboard', label: 'ADMIN DASHBOARD', href: '/admin' },
      { id: 'admin-training', label: 'TRAINING ADMIN', href: '/admin/training' },
      { id: 'admin-call-scoring', label: 'CALL SCORING', href: '/admin/call-scoring/templates' },
    ],
  },
];

const accountNavItems: NavItem[] = [
  { id: 'my-agency', label: 'MY AGENCY', href: '/agency', icon: Building2 },
  { id: 'billing', label: 'BILLING', href: '/billing', icon: CreditCard },
];

interface BrutalistSidebarProps {
  agencyName?: string | null;
  isLightMode?: boolean;
}

export function BrutalistSidebar({ agencyName, isLightMode = false }: BrutalistSidebarProps) {
  const location = useLocation();
  const { signOut, isAdmin } = useAuth();
  const [openFolders, setOpenFolders] = useState<string[]>([]);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Theme-aware color classes
  const textColor = isLightMode ? 'text-[var(--brutalist-text)]' : 'text-white';
  const textMuted = isLightMode ? 'text-[var(--brutalist-text-muted)]' : 'text-white/60';
  const textDim = isLightMode ? 'text-[var(--brutalist-text-dim)]' : 'text-white/40';
  const borderColor = isLightMode ? 'border-[var(--brutalist-border-solid)]' : 'border-white';
  const borderMuted = isLightMode ? 'border-[var(--brutalist-border-solid)]/20' : 'border-white/20';
  const hoverBg = isLightMode ? 'hover:bg-[var(--brutalist-border-solid)]/5' : 'hover:bg-white/5';

  // Auto-open folder containing current route
  useEffect(() => {
    const currentPath = location.pathname;
    const allItems = [...mainNavItems, ...adminNavItems];

    for (const item of allItems) {
      if (item.children) {
        const hasActiveChild = item.children.some(child =>
          child.href && currentPath.startsWith(child.href)
        );
        if (hasActiveChild && !openFolders.includes(item.id)) {
          setOpenFolders(prev => [...prev, item.id]);
        }
      }
    }
  }, [location.pathname]);

  const toggleFolder = (folderId: string) => {
    setOpenFolders(prev =>
      prev.includes(folderId)
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const renderNavItem = (item: NavItem, depth = 0) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openFolders.includes(item.id);
    const active = isActive(item.href);

    if (hasChildren) {
      return (
        <div key={item.id}>
          <button
            onClick={() => toggleFolder(item.id)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 text-left transition-colors',
              hoverBg,
              depth > 0 && 'pl-8'
            )}
          >
            <div className="flex items-center gap-3">
              {Icon && <Icon className={cn('w-4 h-4', textDim)} />}
              <span className={cn('text-sm font-medium uppercase tracking-wider', isLightMode ? 'text-[var(--brutalist-text)]/80' : 'text-white/80')}>
                {item.label}
              </span>
            </div>
            <div className={cn('w-5 h-5 border flex items-center justify-center', isLightMode ? 'border-[var(--brutalist-border-solid)]/30' : 'border-white/30')}>
              {isOpen ? (
                <Minus className={cn('w-3 h-3', textMuted)} />
              ) : (
                <Plus className={cn('w-3 h-3', textMuted)} />
              )}
            </div>
          </button>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className={cn('border-l-2 ml-5', isLightMode ? 'border-[var(--brutalist-border-solid)]/10' : 'border-white/10')}>
                  {item.children!.map(child => renderNavItem(child, depth + 1))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        to={item.href || '#'}
        className={cn(
          'flex items-center gap-3 px-3 py-2 transition-colors',
          hoverBg,
          active && 'bg-[var(--brutalist-yellow)]/10 border-l-2 border-[var(--brutalist-yellow)]',
          !active && 'border-l-2 border-transparent',
          depth > 0 && 'pl-8'
        )}
      >
        {Icon && (
          <Icon className={cn(
            'w-4 h-4',
            active ? 'text-[var(--brutalist-yellow)]' : textDim
          )} />
        )}
        <span className={cn(
          'text-sm font-medium uppercase tracking-wider',
          active ? 'text-[var(--brutalist-yellow)]' : (isLightMode ? 'text-[var(--brutalist-text)]/80' : 'text-white/80')
        )}>
          {item.label}
        </span>
        {item.badge && item.badge > 0 && (
          <span className="ml-auto bg-[var(--brutalist-amber)] text-white text-xs px-1.5 py-0.5 font-bold">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className={cn(
      'w-64 h-screen flex flex-col bg-[#1A1A2E] border-r-2 font-brutalist',
      borderMuted
    )}>
      {/* Logo */}
      <div className={cn('p-4 border-b-2', borderMuted)}>
        <Link to="/dashboard">
          <img
            src={LOGO_WITH_STAN}
            alt="AgencyBrain"
            className="h-12 w-auto"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Main Section */}
        <div className="mb-4">
          <div className="px-3 mb-2 flex items-center gap-2">
            <div className={cn('h-px flex-1 border-t border-dashed', borderMuted)} />
            <span className={cn('text-xs uppercase tracking-wider', textDim)}>MAIN</span>
            <div className={cn('h-px flex-1 border-t border-dashed', borderMuted)} />
          </div>
          {mainNavItems.map(item => renderNavItem(item))}
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <div className="mb-4">
            <div className="px-3 mb-2 flex items-center gap-2">
              <div className={cn('h-px flex-1 border-t border-dashed', borderMuted)} />
              <span className={cn('text-xs uppercase tracking-wider', textDim)}>ADMIN</span>
              <div className={cn('h-px flex-1 border-t border-dashed', borderMuted)} />
            </div>
            {adminNavItems.map(item => renderNavItem(item))}
          </div>
        )}

        {/* Account Section */}
        <div className="mb-4">
          <div className="px-3 mb-2 flex items-center gap-2">
            <div className={cn('h-px flex-1 border-t border-dashed', borderMuted)} />
            <span className={cn('text-xs uppercase tracking-wider', textDim)}>ACCOUNT</span>
            <div className={cn('h-px flex-1 border-t border-dashed', borderMuted)} />
          </div>
          {accountNavItems.map(item => renderNavItem(item))}
        </div>
      </nav>

      {/* User Section */}
      <div className={cn('p-4 border-t-2', borderMuted)}>
        <button
          onClick={() => signOut()}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 transition-colors',
            textMuted,
            isLightMode ? 'hover:text-[var(--brutalist-text)] hover:bg-[var(--brutalist-border-solid)]/5' : 'hover:text-white hover:bg-white/5'
          )}
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium uppercase tracking-wider">SIGN OUT</span>
        </button>
      </div>
    </aside>
  );
}
