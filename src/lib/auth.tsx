import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { normalizeTier, isCallScoringTier } from '@/utils/tierAccess';
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  adminLoading: boolean;
  signUp: (email: string, password: string, agencyName: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isAgencyOwner: boolean;
  isKeyEmployee: boolean;
  keyEmployeeAgencyId: string | null;
  membershipTier: string | null;
  hasTierAccess: (feature: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAgencyOwner, setIsAgencyOwner] = useState(false);
  const [isKeyEmployee, setIsKeyEmployee] = useState(false);
  const [keyEmployeeAgencyId, setKeyEmployeeAgencyId] = useState<string | null>(null);
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
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const checkMembershipTier = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('membership_tier, agency_id')
        .eq('id', userId)
        .maybeSingle();
        
      if (!error && data) {
        setMembershipTier(data.membership_tier);
        // User is an agency owner if they have an agency_id
        setIsAgencyOwner(!!data.agency_id);
      } else {
        setMembershipTier(null);
        setIsAgencyOwner(false);
      }

      // Check if user is a key employee
      const { data: keyEmployeeData } = await supabase
        .from('key_employees')
        .select('agency_id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (keyEmployeeData) {
        setIsKeyEmployee(true);
        setKeyEmployeeAgencyId(keyEmployeeData.agency_id);
      } else {
        setIsKeyEmployee(false);
        setKeyEmployeeAgencyId(null);
      }
    } catch (error) {
      console.error('Error checking membership tier:', error);
      setMembershipTier(null);
      setIsAgencyOwner(false);
      setIsKeyEmployee(false);
      setKeyEmployeeAgencyId(null);
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
        
        // Clear sidebar folder state on login so folders start closed
        if (event === 'SIGNED_IN') {
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sidebar-folder-')) {
              localStorage.removeItem(key);
            }
          });
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Check roles immediately
        if (session?.user) {
          checkUserRole(session.user.id);
          checkMembershipTier(session.user.id);
        } else {
          setIsAdmin(false);
          setAdminLoading(false);
          setMembershipTier(null);
          setIsAgencyOwner(false);
          setIsKeyEmployee(false);
          setKeyEmployeeAgencyId(null);
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


  const signUp = async (email: string, password: string, agencyName: string, fullName: string) => {
    // Always use production URL to avoid localhost redirect issues
    const redirectUrl = window.location.hostname === 'localhost'
      ? 'https://myagencybrain.com/'
      : `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          agency_name: agencyName,
          full_name: fullName,
          // No membership_tier - admin will set it after signup
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
      setIsKeyEmployee(false);
      setKeyEmployeeAgencyId(null);
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
    
    const normalized = normalizeTier(membershipTier);
    
    // Call Scoring tier: limited access to only call-scoring, exchange, and agency
    if (isCallScoringTier(membershipTier)) {
      const callScoringAllowed = ['call-scoring', 'exchange', 'agency', 'my-agency', 'account-settings'];
      return callScoringAllowed.includes(feature);
    }
    
    // AI Roleplay only for 1:1 Coaching (not Boardroom)
    if (feature === 'roleplay-trainer') {
      return normalized === 'one_on_one';
    }
    
    // 1:1 Coaching and Boardroom get everything else
    return normalized === 'one_on_one' || normalized === 'boardroom';
  };

  const value = {
    user,
    session,
    loading,
    adminLoading,
    signUp,
    signIn,
    signOut,
    isAdmin,
    isAgencyOwner,
    isKeyEmployee,
    keyEmployeeAgencyId,
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