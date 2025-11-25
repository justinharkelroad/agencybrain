import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, agencyName: string, membershipTier?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  membershipTier: string | null;
  hasTierAccess: (feature: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [membershipTier, setMembershipTier] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const checkUserRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
        
      if (!error && data) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      setIsAdmin(false);
    }
  }, []);

  const checkMembershipTier = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('membership_tier')
        .eq('id', userId)
        .maybeSingle();
        
      if (!error && data) {
        setMembershipTier(data.membership_tier);
      } else {
        setMembershipTier(null);
      }
    } catch (error) {
      console.error('Error checking membership tier:', error);
      setMembershipTier(null);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Clear user-specific cache on auth state change
        if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          queryClient.removeQueries({ queryKey: ["focus-items"] });
          queryClient.removeQueries({ queryKey: ["brainstorm-targets"] });
          queryClient.removeQueries({ queryKey: ["quarterly-targets"] });
          queryClient.removeQueries({ queryKey: ["auth-user"] });
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Defer Supabase calls to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            checkUserRole(session.user.id);
            checkMembershipTier(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
          setMembershipTier(null);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        checkUserRole(session.user.id);
        checkMembershipTier(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkUserRole, checkMembershipTier, queryClient]);


  const signUp = async (email: string, password: string, agencyName: string, membershipTier: string = '1:1 Coaching') => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          agency_name: agencyName,
          membership_tier: membershipTier,
        }
      }
    });
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error };
  };

  const signOut = async () => {
    try {
      // Clear local state first
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setMembershipTier(null);
      
      // Then attempt to sign out from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if Supabase signOut fails, we've cleared local state
    }
  };

  const hasTierAccess = (feature: string): boolean => {
    if (!membershipTier) return false;
    
    // AI Roleplay and Bonus Grid only for 1:1 Coaching
    if (feature === 'roleplay-trainer' || feature === 'bonus-grid') {
      return membershipTier === '1:1 Coaching';
    }
    
    // All other features available to both tiers
    return true;
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isAdmin,
    membershipTier,
    hasTierAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}