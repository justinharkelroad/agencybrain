/**                                    
   * Staff Access Audit Script
   * Scans the codebase for common staff access issues
   */

  import * as fs from 'fs';
  import * as path from 'path';
  import { execSync } from 'child_process';

  interface Issue {
    file: string;
    line?: number;
    type: 'rls_policy' | 'inner_join' | 'unknown_fallback' |
  'missing_staff_check' | 'outdated_access_function';
    severity: 'high' | 'medium' | 'low';
    description: string;
    autoFixable: boolean;
    pattern?: string;
  }

  interface AuditResult {
    issues: Issue[];
    filesScanned: number;
    timestamp: string;
    changedFilesOnly: boolean;
  }

  const MIGRATIONS_DIR = 'supabase/migrations';
  const FUNCTIONS_DIR = 'supabase/functions';

  const PROBLEMATIC_PATTERNS = {
    innerJoinStaffUsers: {
      pattern: /staff_users!inner\s*\(/g,
      type: 'inner_join' as const,
      severity: 'high' as const,
      description: 'Using !inner join on staff_users can fail if FK
  relationship has issues',
      autoFixable: true,
    },
    unknownFallback: {
      pattern: /let\s+userName\s*=\s*["']Unknown["']/g,
      type: 'unknown_fallback' as const,
      severity: 'medium' as const,
      description: 'Using "Unknown" fallback instead of
  staff_users.display_name',
      autoFixable: true,
    },
    sessionStaffUsersAccess: {
      pattern: /session\.staff_users\./g,
      type: 'inner_join' as const,
      severity: 'high' as const,
      description: 'Accessing session.staff_users directly (should use
  separate query)',
      autoFixable: true,
    },
    directProfileCheck: {
      pattern: /FROM\s+profiles\s+p\s+WHERE\s+p\.id\s*=.*(?:auth\.uid\(\)
  |_user_id)(?!.*has_agency_access)/gi,
      type: 'rls_policy' as const,
      severity: 'medium' as const,
      description: 'Direct profile check may miss key_employees and
  staff_users',
      autoFixable: false,
    },
  };

  const SKIP_PATTERNS = [/node_modules/, /\.git/, /dist/, /build/,
  /coverage/];

  function shouldSkipFile(filePath: string): boolean {
    return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
  }

  function scanFile(filePath: string): Issue[] {
    const issues: Issue[] = [];
    if (shouldSkipFile(filePath) || !fs.existsSync(filePath)) return
  issues;

    const content = fs.readFileSync(filePath, 'utf-8');

    for (const [, config] of Object.entries(PROBLEMATIC_PATTERNS)) {
      const matches = content.matchAll(config.pattern);
      for (const match of matches) {
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        issues.push({
          file: filePath,
          line: lineNumber,
          type: config.type,
          severity: config.severity,
          description: config.description,
          autoFixable: config.autoFixable,
          pattern: match[0].substring(0, 50),
        });
      }
    }
    return issues;
  }

  function scanDirectory(dir: string): Issue[] {
    const issues: Issue[] = [];
    if (!fs.existsSync(dir)) return issues;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        issues.push(...scanDirectory(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') ||
  entry.name.endsWith('.sql'))) {
        issues.push(...scanFile(fullPath));
      }
    }
    return issues;
  }

  function runAudit(): AuditResult {
    const issues: Issue[] = [];
    issues.push(...scanDirectory(MIGRATIONS_DIR));
    issues.push(...scanDirectory(FUNCTIONS_DIR));

    return {
      issues,
      filesScanned: issues.length,
      timestamp: new Date().toISOString(),
      changedFilesOnly: false,
    };
  }

  const args = process.argv.slice(2);
  const result = runAudit();

  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`# Staff Access Audit\n`);
    console.log(`Issues found: ${result.issues.length}`);
    result.issues.forEach(i => console.log(`- ${i.file}:${i.line} -
  ${i.description}`));
  }

  export { runAudit };
  export type { Issue, AuditResult };
