import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProactiveTip {
  id: string;
  page_route: string;
  tip_message: string;
  suggested_question: string | null;
  delay_seconds: number;
  applies_to_portals: string[];
  applies_to_tiers: string[];
}

interface UseProactiveTipProps {
  portal: 'brain' | 'staff';
  membershipTier?: string;
  isStanOpen: boolean;
  hasInteractedWithStan: boolean;
}

interface UseProactiveTipReturn {
  activeTip: ProactiveTip | null;
  dismissTip: () => void;
  showTip: boolean;
}

export function useProactiveTip({
  portal,
  membershipTier = 'all',
  isStanOpen,
  hasInteractedWithStan,
}: UseProactiveTipProps): UseProactiveTipReturn {
  const location = useLocation();
  const [showTip, setShowTip] = useState(false);
  const [dismissedPages, setDismissedPages] = useState<Set<string>>(new Set());
  const [activeTip, setActiveTip] = useState<ProactiveTip | null>(null);

  // Fetch all proactive tips
  const { data: tips = [] } = useQuery({
    queryKey: ['proactive-tips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_proactive_tips')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as ProactiveTip[];
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  // Find matching tip for current page
  const findTipForPage = useCallback((): ProactiveTip | null => {
    const currentPath = location.pathname;
    
    // Filter by portal
    const portalFiltered = tips.filter(t => 
      t.applies_to_portals.includes('both') || t.applies_to_portals.includes(portal)
    );

    // Filter by tier
    const tierFiltered = portalFiltered.filter(t =>
      t.applies_to_tiers.includes('all') || t.applies_to_tiers.includes(membershipTier)
    );

    // Find exact match first
    let matched = tierFiltered.find(t => currentPath === t.page_route);
    
    // If no exact match, try prefix match
    if (!matched) {
      matched = tierFiltered.find(t => currentPath.startsWith(t.page_route));
    }

    return matched || null;
  }, [location.pathname, tips, portal, membershipTier]);

  // Reset and set timer when page changes
  useEffect(() => {
    setShowTip(false);
    setActiveTip(null);

    const currentPath = location.pathname;

    // Don't show if:
    // - Stan is open
    // - User has interacted with Stan this session
    // - Already dismissed tip on this page
    if (isStanOpen || hasInteractedWithStan || dismissedPages.has(currentPath)) {
      return;
    }

    const tip = findTipForPage();
    if (!tip) return;

    // Set timer to show tip
    const timer = setTimeout(() => {
      // Double-check conditions before showing
      if (!isStanOpen && !hasInteractedWithStan && !dismissedPages.has(currentPath)) {
        setActiveTip(tip);
        setShowTip(true);
      }
    }, tip.delay_seconds * 1000);

    return () => clearTimeout(timer);
  }, [location.pathname, isStanOpen, hasInteractedWithStan, dismissedPages, findTipForPage]);

  // Hide tip when Stan opens
  useEffect(() => {
    if (isStanOpen) {
      setShowTip(false);
    }
  }, [isStanOpen]);

  const dismissTip = useCallback(() => {
    setShowTip(false);
    setDismissedPages(prev => new Set(prev).add(location.pathname));
  }, [location.pathname]);

  return {
    activeTip,
    dismissTip,
    showTip,
  };
}
