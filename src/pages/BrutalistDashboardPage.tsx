import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { BrutalistDashboard, BrutalistSidebar } from '@/components/brutalist';
import { Plus, FileText, HelpCircle, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Brutalist Dashboard Page
 *
 * This is a test page for the new Neo-Brutalist dashboard design.
 * Access it at /brutalist-dashboard to preview the new design with real data.
 *
 * Supports both dark and light mode via toggle.
 */
export default function BrutalistDashboardPage() {
  const { user } = useAuth();
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [isLightMode, setIsLightMode] = useState(false);

  // Fetch agency info
  useEffect(() => {
    const fetchAgencyInfo = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.agency_id) {
        setAgencyId(profile.agency_id);

        const { data: agency } = await supabase
          .from('agencies')
          .select('name')
          .eq('id', profile.agency_id)
          .maybeSingle();

        if (agency) {
          setAgencyName(agency.name);
        }
      }
    };

    fetchAgencyInfo();
  }, [user?.id]);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const themeClass = isLightMode ? 'brutalist-app-light' : 'brutalist-app';

  return (
    <div className={cn(themeClass, 'flex h-screen overflow-hidden')}>
      {/* Sidebar */}
      <BrutalistSidebar agencyName={agencyName} isLightMode={isLightMode} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className={cn(
          'border-b-2 px-4 py-3 flex items-center justify-between font-brutalist',
          isLightMode
            ? 'bg-[var(--brutalist-surface)] border-[var(--brutalist-border-solid)]'
            : 'bg-[var(--brutalist-bg)] border-white'
        )}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-sm uppercase tracking-wider',
                isLightMode ? 'text-[var(--brutalist-text-muted)]' : 'text-white/60'
              )}>
                DASHBOARD
              </span>
              <button className={cn(
                'w-6 h-6 border flex items-center justify-center transition-colors',
                isLightMode
                  ? 'border-[var(--brutalist-border-solid)]/30 text-[var(--brutalist-text-muted)] hover:bg-[var(--brutalist-border-solid)]/10'
                  : 'border-white/30 text-white/60 hover:bg-white/10'
              )}>
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          <h1 className={cn(
            'text-xl font-bold uppercase tracking-wide',
            isLightMode ? 'text-[var(--brutalist-text)]' : 'text-white'
          )}>
            {agencyName || 'Loading...'}
          </h1>

          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              className={cn(
                'w-10 h-10 border-2 flex items-center justify-center transition-colors',
                isLightMode
                  ? 'border-[var(--brutalist-border-solid)] text-[var(--brutalist-text)] hover:bg-[var(--brutalist-border-solid)] hover:text-[var(--brutalist-surface)]'
                  : 'border-white text-white hover:bg-white hover:text-[var(--brutalist-bg)]'
              )}
              title={isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {isLightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <button className={cn(
              'border-2 px-4 py-2 text-sm uppercase font-bold transition-colors flex items-center gap-2',
              isLightMode
                ? 'border-[var(--brutalist-border-solid)] text-[var(--brutalist-text)] hover:bg-[var(--brutalist-border-solid)] hover:text-[var(--brutalist-surface)]'
                : 'border-white text-white hover:bg-white hover:text-[var(--brutalist-bg)]'
            )}>
              <Plus className="w-4 h-4" />
              QUOTED HOUSEHOLD
            </button>
            <button className="border-2 border-[var(--brutalist-yellow)] bg-[var(--brutalist-yellow)] px-4 py-2 text-sm uppercase font-bold hover:opacity-90 transition-colors flex items-center gap-2 text-[#1A1A2E]">
              <FileText className="w-4 h-4" />
              SUBMIT FORM
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto">
          <BrutalistDashboard agencyId={agencyId} agencyName={agencyName} isLightMode={isLightMode} />
        </main>
      </div>
    </div>
  );
}
