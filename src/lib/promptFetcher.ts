// Bulletproof Prompt Fetcher
// Built on facts from comprehensive error analysis

import { supabase } from '@/lib/supabaseClient';
import { errorAnalyzer, isAuthenticationError, verifyAnonymousClient } from '@/lib/errorAnalysis';

interface PromptFetchResult {
  success: boolean;
  data: any[] | null;
  error?: any;
  method: 'authenticated' | 'anonymous_fallback' | 'anonymous_verified';
  duration: number;
  verified: boolean; // Whether anonymous client was verified before use
}

export async function fetchPromptsWithComprehensiveErrorHandling(
  context: string,
  includeInactive = false
): Promise<PromptFetchResult> {
  
  const startTime = Date.now();
  let attemptCount = 0;

  console.group(`🚀 BULLETPROOF PROMPT FETCH: ${context}`);
  console.log('⚙️ Include Inactive:', includeInactive);
  console.log('🕐 Started at:', new Date().toISOString());

  // Phase 1: Try authenticated fetch with comprehensive error logging
  try {
    attemptCount++;
    console.log(`📡 Attempt ${attemptCount}: Authenticated fetch`);
    
    const query = supabase.from('prompts').select('*').order('category');
    
    if (!includeInactive) {
      query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }

    const duration = Date.now() - startTime;
    
    errorAnalyzer.logSuccess(
      `${context} - Authenticated Fetch`, 
      'authenticated_fetch',
      { duration, isAuthenticated: true, retryAttempt: attemptCount }
    );

    console.log(`✅ Authenticated fetch SUCCESS (${duration}ms)`);
    console.log(`📊 Retrieved ${data?.length || 0} prompts`);
    console.groupEnd();

    return {
      success: true,
      data: data || [],
      method: 'authenticated',
      duration,
      verified: false
    };

  } catch (authError: any) {
    const duration = Date.now() - startTime;
    
    // Comprehensive error logging
    errorAnalyzer.logError(
      `${context} - Authenticated Fetch`,
      authError,
      'authenticated_fetch',
      { duration, isAuthenticated: true, retryAttempt: attemptCount }
    );

    console.log(`❌ Authenticated fetch FAILED (${duration}ms)`);
    
    // Phase 2: Fact-based authentication error detection
    const isAuthError = isAuthenticationError(authError);
    
    if (!isAuthError) {
      console.log('🚫 Not an authentication error - no fallback attempted');
      console.groupEnd();
      
      return {
        success: false,
        data: null,
        error: authError,
        method: 'authenticated',
        duration,
        verified: false
      };
    }

    console.log('🔄 Authentication error detected - attempting anonymous fallback');

    // Phase 3: Verify anonymous client before using as fallback
    console.log('🧪 Verifying anonymous client capability...');
    
    const verification = await verifyAnonymousClient();
    
    if (!verification.success) {
      console.log('❌ Anonymous client verification FAILED');
      console.groupEnd();
      
      return {
        success: false,
        data: null,
        error: verification.error || authError,
        method: 'anonymous_verified',
        duration: Date.now() - startTime,
        verified: false
      };
    }

    console.log('✅ Anonymous client verified - proceeding with fallback');

    // Phase 4: Execute verified anonymous fallback
    try {
      attemptCount++;
      console.log(`📡 Attempt ${attemptCount}: Anonymous fallback (verified)`);
      
      const { fetchActivePromptsOnly } = await import('@/lib/dataFetchers');
      
      let data: any[];
      
      if (includeInactive) {
        // For inactive prompts, we can't use anonymous client (RLS restriction)
        console.log('⚠️ Cannot fetch inactive prompts with anonymous client due to RLS');
        throw new Error('Cannot fetch inactive prompts anonymously - RLS restriction');
      } else {
        data = await fetchActivePromptsOnly();
      }

      const totalDuration = Date.now() - startTime;
      
      errorAnalyzer.logSuccess(
        `${context} - Anonymous Fallback`,
        'anonymous_fallback',
        { duration: totalDuration, isAuthenticated: false, retryAttempt: attemptCount }
      );

      console.log(`✅ Anonymous fallback SUCCESS (${totalDuration}ms)`);
      console.log(`📊 Retrieved ${data?.length || 0} active prompts`);
      console.groupEnd();

      return {
        success: true,
        data: data || [],
        method: 'anonymous_fallback',
        duration: totalDuration,
        verified: true
      };

    } catch (anonError: any) {
      const totalDuration = Date.now() - startTime;
      
      errorAnalyzer.logError(
        `${context} - Anonymous Fallback`,
        anonError,
        'anonymous_fallback',
        { duration: totalDuration, isAuthenticated: false, retryAttempt: attemptCount }
      );

      console.log(`❌ Anonymous fallback FAILED (${totalDuration}ms)`);
      console.groupEnd();

      return {
        success: false,
        data: null,
        error: anonError,
        method: 'anonymous_fallback',
        duration: totalDuration,
        verified: true
      };
    }
  }
}

// Convenience functions for specific use cases
export async function fetchActivePromptsOnly(context: string): Promise<PromptFetchResult> {
  return fetchPromptsWithComprehensiveErrorHandling(context, false);
}

export async function fetchAllPrompts(context: string): Promise<PromptFetchResult> {
  return fetchPromptsWithComprehensiveErrorHandling(context, true);
}

// Error pattern analysis for this specific fetching
export function analyzePromptFetchingPatterns() {
  console.log('🔬 ANALYZING PROMPT FETCHING ERROR PATTERNS...');
  
  const report = errorAnalyzer.getAllLogs()
    .filter(log => log.context.includes('Prompt'))
    .slice(-20); // Last 20 prompt-related logs

  const patterns = {
    authFailures: report.filter(l => !l.success && l.errorType === 'authenticated_fetch').length,
    anonFailures: report.filter(l => !l.success && l.errorType === 'anonymous_fallback').length,
    totalAttempts: report.length,
    successRate: (report.filter(l => l.success).length / report.length * 100).toFixed(1)
  };

  console.log('📊 Prompt Fetching Analysis:', patterns);
  return patterns;
}

// Export error analysis functions
export { getErrorAnalysisReport } from '@/lib/errorAnalysis';