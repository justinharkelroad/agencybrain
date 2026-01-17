export const SCORECARD_ERROR_CODES = {
  // Submission errors
  DUPLICATE_SUBMISSION: 'duplicate_submission',
  INVALID_WORK_DATE: 'invalid_work_date',
  FORM_SCHEMA_CHANGED: 'form_schema_changed',
  
  // Auth/access errors
  STAFF_NOT_LINKED: 'staff_not_linked',
  TOKEN_EXPIRED: 'token_expired',
  TOKEN_DISABLED: 'token_disabled',
  
  // Configuration errors
  FORM_NEEDS_ATTENTION: 'form_needs_attention',
  MISSING_KPIS: 'missing_kpis',
  MISSING_TARGETS: 'missing_targets',
  MISSING_SCORECARD_RULES: 'missing_scorecard_rules',
  
  // Admin errors
  CONCURRENT_EDIT: 'concurrent_edit',
  INVALID_WEIGHTS: 'invalid_weights',
  KPI_IN_USE: 'kpi_in_use',
} as const;

export type ScorecardErrorCode = typeof SCORECARD_ERROR_CODES[keyof typeof SCORECARD_ERROR_CODES];

export interface ScorecardErrorInfo {
  title: string;
  message: string;
  action: string;
  severity: 'error' | 'warning' | 'info';
  canRetry: boolean;
}

export const SCORECARD_ERRORS: Record<ScorecardErrorCode, ScorecardErrorInfo> = {
  [SCORECARD_ERROR_CODES.DUPLICATE_SUBMISSION]: {
    title: 'Submission Already Exists',
    message: 'You already submitted a scorecard for this date.',
    action: 'To update your entry, find it in your submission history and click Edit.',
    severity: 'info',
    canRetry: false,
  },
  [SCORECARD_ERROR_CODES.INVALID_WORK_DATE]: {
    title: 'Invalid Date',
    message: 'Work date must be within 7 days of today.',
    action: 'Contact your manager if you need to submit for an older date.',
    severity: 'error',
    canRetry: false,
  },
  [SCORECARD_ERROR_CODES.FORM_SCHEMA_CHANGED]: {
    title: 'Form Updated',
    message: 'This form was modified while you had it open.',
    action: 'Please refresh the page to get the latest version and re-enter your data.',
    severity: 'warning',
    canRetry: true,
  },
  [SCORECARD_ERROR_CODES.STAFF_NOT_LINKED]: {
    title: 'Account Not Linked',
    message: 'Your account is not connected to a team member profile.',
    action: 'Ask your manager to link your account in Team Settings → Staff Users.',
    severity: 'error',
    canRetry: false,
  },
  [SCORECARD_ERROR_CODES.TOKEN_EXPIRED]: {
    title: 'Link Expired',
    message: 'This form link has expired.',
    action: 'Request a new link from your manager.',
    severity: 'error',
    canRetry: false,
  },
  [SCORECARD_ERROR_CODES.TOKEN_DISABLED]: {
    title: 'Link Disabled',
    message: 'This form link has been disabled by your manager.',
    action: 'Request a new link from your manager.',
    severity: 'error',
    canRetry: false,
  },
  [SCORECARD_ERROR_CODES.FORM_NEEDS_ATTENTION]: {
    title: 'Form Configuration Issue',
    message: 'This form needs to be updated by your manager before you can submit.',
    action: 'Please let your manager know so they can fix it in the Form Editor.',
    severity: 'warning',
    canRetry: false,
  },
  [SCORECARD_ERROR_CODES.MISSING_KPIS]: {
    title: 'Missing KPI Configuration',
    message: 'Some metrics in this form are no longer available.',
    action: 'Your manager needs to update the form with the correct metrics.',
    severity: 'error',
    canRetry: false,
  },
  [SCORECARD_ERROR_CODES.MISSING_TARGETS]: {
    title: 'Missing Targets',
    message: 'Performance targets have not been configured for some metrics.',
    action: 'Your manager needs to set targets in Scorecard Settings.',
    severity: 'warning',
    canRetry: false,
  },
  [SCORECARD_ERROR_CODES.MISSING_SCORECARD_RULES]: {
    title: 'Scorecard Not Configured',
    message: 'Scorecard rules have not been set up for your team role.',
    action: 'Your manager needs to configure scorecard settings.',
    severity: 'error',
    canRetry: false,
  },
  [SCORECARD_ERROR_CODES.CONCURRENT_EDIT]: {
    title: 'Concurrent Edit Detected',
    message: 'Another admin saved changes while you were editing.',
    action: 'Please refresh to see their changes, then apply yours.',
    severity: 'warning',
    canRetry: true,
  },
  [SCORECARD_ERROR_CODES.INVALID_WEIGHTS]: {
    title: 'Invalid Weights',
    message: 'Score weights must total exactly 100%.',
    action: 'Adjust the weights so they add up to 100%.',
    severity: 'error',
    canRetry: true,
  },
  [SCORECARD_ERROR_CODES.KPI_IN_USE]: {
    title: 'KPI In Use',
    message: 'This KPI is being used by active forms.',
    action: 'Remove it from forms before deleting, or archive it instead.',
    severity: 'warning',
    canRetry: false,
  },
};

// Helper to check if an error code is a known scorecard error
export function isScorecardError(code: string): code is ScorecardErrorCode {
  return Object.values(SCORECARD_ERROR_CODES).includes(code as ScorecardErrorCode);
}
