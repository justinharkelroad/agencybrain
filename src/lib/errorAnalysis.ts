// Comprehensive Error Analysis and Logging System
// Built on FACTS, not assumptions

interface ErrorAnalysisLog {
  timestamp: string;
  context: string;
  errorType: 'authenticated_fetch' | 'anonymous_fallback' | 'anonymous_verification';
  success: boolean;
  
  // Complete error object capture
  error?: {
    code?: string;
    message?: string;
    name?: string;
    details?: string;
    hint?: string;
    status?: number;
    statusText?: string;
    
    // Additional Supabase-specific fields
    error?: string;
    error_description?: string;
    
    // Full object for unknown error structures
    fullError: any;
  };
  
  // Performance metrics
  duration?: number;
  
  // Context data
  userId?: string;
  isAuthenticated?: boolean;
  retryAttempt?: number;
}

class ErrorAnalysisLogger {
  private logs: ErrorAnalysisLog[] = [];
  private maxLogs = 100;

  logError(context: string, error: any, errorType: ErrorAnalysisLog['errorType'], additionalData?: Partial<ErrorAnalysisLog>) {
    const log: ErrorAnalysisLog = {
      timestamp: new Date().toISOString(),
      context,
      errorType,
      success: false,
      error: {
        code: error?.code,
        message: error?.message,
        name: error?.name,
        details: error?.details,
        hint: error?.hint,
        status: error?.status,
        statusText: error?.statusText,
        error: error?.error,
        error_description: error?.error_description,
        fullError: error
      },
      ...additionalData
    };

    this.logs.push(log);
    this.trimLogs();

    // Enhanced console logging with complete error analysis
    console.group(`🔍 ERROR ANALYSIS: ${context}`);
    console.log('📊 Error Type:', errorType);
    console.log('⏰ Timestamp:', log.timestamp);
    console.log('🚨 Error Code:', error?.code || 'undefined');
    console.log('📝 Error Message:', error?.message || 'undefined');
    console.log('🏷️ Error Name:', error?.name || 'undefined');
    console.log('📋 Error Details:', error?.details || 'undefined');
    console.log('💡 Error Hint:', error?.hint || 'undefined');
    console.log('🌐 HTTP Status:', error?.status || 'undefined');
    console.log('📄 Full Error Object:', error);
    
    // Pattern analysis
    const similarErrors = this.findSimilarErrors(error);
    if (similarErrors.length > 0) {
      console.log('🔗 Similar Errors Found:', similarErrors.length);
    }
    
    console.groupEnd();
  }

  logSuccess(context: string, errorType: ErrorAnalysisLog['errorType'], additionalData?: Partial<ErrorAnalysisLog>) {
    const log: ErrorAnalysisLog = {
      timestamp: new Date().toISOString(),
      context,
      errorType,
      success: true,
      ...additionalData
    };

    this.logs.push(log);
    this.trimLogs();

    console.log(`✅ SUCCESS: ${context} (${errorType})`);
  }

  private findSimilarErrors(currentError: any): ErrorAnalysisLog[] {
    return this.logs.filter(log => 
      log.success === false &&
      (log.error?.code === currentError?.code ||
       log.error?.name === currentError?.name ||
       log.error?.status === currentError?.status)
    ).slice(-5); // Last 5 similar errors
  }

  private trimLogs() {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  // Get error patterns for analysis
  getErrorPatterns(): { [key: string]: number } {
    const patterns: { [key: string]: number } = {};
    
    this.logs.filter(log => !log.success).forEach(log => {
      const pattern = `${log.error?.name || 'unknown'}:${log.error?.code || 'unknown'}`;
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    });

    return patterns;
  }

  // Get all logs for debugging
  getAllLogs(): ErrorAnalysisLog[] {
    return [...this.logs];
  }

  // Get recent failures
  getRecentFailures(minutes = 10): ErrorAnalysisLog[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    return this.logs.filter(log => !log.success && log.timestamp > cutoff);
  }
}

export const errorAnalyzer = new ErrorAnalysisLogger();

// Advanced error detection based on collected evidence
export function isAuthenticationError(error: any): boolean {
  // This will be updated as we collect more factual evidence
  // Currently based on observed patterns, will be refined with real data
  
  if (!error) return false;

  // Known authentication error patterns (to be verified with real data)
  const knownAuthErrors = [
    // HTTP status codes
    error.status === 401,
    error.status === 403,
    
    // Supabase error codes (to be confirmed)
    error.code === 'PGRST301', // JWT expired
    error.code === 'PGRST302', // JWT invalid
    
    // Error names (to be confirmed)
    error.name === 'AuthApiError',
    error.name === 'AuthInvalidTokenError',
    
    // Message patterns (to be confirmed)
    error.message?.includes('Invalid Refresh Token'),
    error.message?.includes('JWT expired'),
    error.message?.includes('403'),
    error.message?.includes('Unauthorized'),
    error.message?.includes('permission denied'),
    
    // Supabase specific (to be confirmed)
    error.error === 'invalid_token',
    error.error_description?.includes('token')
  ];

  const isAuthError = knownAuthErrors.some(condition => condition === true);
  
  // Log this detection for pattern analysis
  errorAnalyzer.logError(
    'Authentication Error Detection',
    error,
    'authenticated_fetch',
    { 
      isAuthenticated: false,
      retryAttempt: 0
    }
  );

  console.log(`🎯 Auth Error Detection Result: ${isAuthError}`);
  console.log(`📊 Detection criteria met:`, knownAuthErrors.filter(c => c === true).length);

  return isAuthError;
}

// Verify anonymous client works before using as fallback
export async function verifyAnonymousClient(): Promise<{ success: boolean; error?: any }> {
  const startTime = Date.now();
  
  try {
    console.log('🧪 Testing anonymous client independently...');
    
    const { fetchActivePromptsOnly } = await import('@/lib/dataFetchers');
    const result = await fetchActivePromptsOnly();
    // result already set above
    
    const duration = Date.now() - startTime;
    
    errorAnalyzer.logSuccess(
      'Anonymous Client Verification',
      'anonymous_verification',
      { duration, isAuthenticated: false }
    );

    console.log(`✅ Anonymous client verification SUCCESS (${duration}ms)`);
    console.log(`📊 Retrieved ${result?.length || 0} active prompts`);
    
    return { success: true };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    errorAnalyzer.logError(
      'Anonymous Client Verification',
      error,
      'anonymous_verification',
      { duration, isAuthenticated: false }
    );

    console.error('❌ Anonymous client verification FAILED:', error);
    
    return { success: false, error };
  }
}

// Get comprehensive error analysis report
export function getErrorAnalysisReport() {
  const patterns = errorAnalyzer.getErrorPatterns();
  const recentFailures = errorAnalyzer.getRecentFailures();
  const allLogs = errorAnalyzer.getAllLogs();
  
  const report = {
    summary: {
      totalLogs: allLogs.length,
      totalErrors: allLogs.filter(l => !l.success).length,
      totalSuccesses: allLogs.filter(l => l.success).length,
      recentFailures: recentFailures.length
    },
    errorPatterns: patterns,
    recentFailures: recentFailures.slice(-10), // Last 10 failures
    recommendations: generateRecommendations(patterns, recentFailures)
  };
  
  console.group('📊 COMPREHENSIVE ERROR ANALYSIS REPORT');
  console.log('📈 Summary:', report.summary);
  console.log('🔍 Error Patterns:', report.errorPatterns);
  console.log('⚠️ Recent Failures:', report.recentFailures.length);
  console.log('💡 Recommendations:', report.recommendations);
  console.groupEnd();
  
  return report;
}

function generateRecommendations(patterns: { [key: string]: number }, recentFailures: ErrorAnalysisLog[]): string[] {
  const recommendations: string[] = [];
  
  // Analyze patterns and generate actionable recommendations
  const mostCommonError = Object.keys(patterns).reduce((a, b) => patterns[a] > patterns[b] ? a : b, '');
  
  if (patterns[mostCommonError] > 3) {
    recommendations.push(`Most common error: ${mostCommonError} (${patterns[mostCommonError]} occurrences)`);
  }
  
  if (recentFailures.length > 5) {
    recommendations.push('High error rate detected - investigate authentication flow');
  }
  
  const hasAnonymousFailures = recentFailures.some(f => f.errorType === 'anonymous_fallback');
  if (hasAnonymousFailures) {
    recommendations.push('Anonymous fallback failures detected - verify anonymous client configuration');
  }
  
  return recommendations;
}