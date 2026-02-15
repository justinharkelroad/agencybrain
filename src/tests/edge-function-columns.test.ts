/**
 * Static analysis test: verifies that edge functions using PostgREST nested
 * selects reference real column names from the generated Supabase types.
 *
 * WHY: On 2026-02-08, `send-sale-notification` and `send-daily-sales-summary`
 * used `sale_policies(policy_type)` but the real column is `policy_type_name`.
 * PostgREST silently errored, and because both calls are fire-and-forget, no
 * sales emails were sent for 5 days before anyone noticed.
 *
 * This test parses the generated types file to extract real column names per
 * table, then scans edge function source for `.select(...)` calls containing
 * nested resource references like `table_name(col1, col2)` and flags any
 * column that doesn't exist on the actual table.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Parse the generated Supabase types file and extract { tableName: Set<column> } */
function parseTableColumns(typesPath: string): Record<string, Set<string>> {
  const src = fs.readFileSync(typesPath, 'utf-8');
  const tables: Record<string, Set<string>> = {};

  // Match the Row type block for each table:
  //   table_name: {
  //     Row: {
  //       col_a: ...
  //       col_b: ...
  //     }
  const tableRowRegex = /^\s{6}(\w+):\s*\{\s*\n\s*Row:\s*\{([\s\S]*?)\}/gm;
  let match: RegExpExecArray | null;

  while ((match = tableRowRegex.exec(src)) !== null) {
    const tableName = match[1];
    const rowBlock = match[2];
    const cols = new Set<string>();

    // Each line inside Row looks like:  col_name: type
    for (const line of rowBlock.split('\n')) {
      const colMatch = line.match(/^\s+(\w+)\s*:/);
      if (colMatch) cols.add(colMatch[1]);
    }

    if (cols.size > 0) tables[tableName] = cols;
  }

  return tables;
}

/** Recursively collect all .ts files under a directory */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip _shared and node_modules
      if (entry.name !== '_shared' && entry.name !== 'node_modules') {
        results.push(...collectTsFiles(full));
      }
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extract nested resource column references from .select() calls.
 * Matches patterns like: table_name(col1, col2, col3)
 * Returns array of { table, columns[], line }
 */
function extractNestedSelects(
  source: string,
): Array<{ table: string; columns: string[]; line: number }> {
  const results: Array<{ table: string; columns: string[]; line: number }> = [];
  const lines = source.split('\n');

  // We look for patterns like:  some_table(col1, col2)
  // inside .select() template strings or string arguments
  // This regex matches: word(word, word, ...) but not function calls like toLocaleDateString(...)
  const nestedRegex = /\b([a-z][a-z0-9_]*)\(([a-z_][a-z0-9_, ]*)\)/g;

  // Known Supabase table names we care about (to avoid matching JS function calls)
  // We'll filter by checking if the "table" exists in our parsed schema

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Only scan lines that look like they're inside a .select() call
    // (contain .select, or are continuation lines within a template literal select block)
    let m: RegExpExecArray | null;
    nestedRegex.lastIndex = 0;
    while ((m = nestedRegex.exec(line)) !== null) {
      const table = m[1];
      const colsStr = m[2];
      const columns = colsStr.split(',').map((c) => c.trim()).filter(Boolean);
      // Filter out alias syntax like "alias:real_table" — take only the table part
      results.push({ table, columns, line: i + 1 });
    }
  }

  return results;
}

// ── test ─────────────────────────────────────────────────────────────────────

describe('Edge Function PostgREST Column Validation', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const typesPath = path.join(repoRoot, 'src/integrations/supabase/types.ts');
  const functionsDir = path.join(repoRoot, 'supabase/functions');

  it('should have a parseable types file', () => {
    expect(fs.existsSync(typesPath)).toBe(true);
    const tables = parseTableColumns(typesPath);
    expect(Object.keys(tables).length).toBeGreaterThan(0);
    // Sanity check: sale_policies should have policy_type_name
    expect(tables['sale_policies']).toBeDefined();
    expect(tables['sale_policies'].has('policy_type_name')).toBe(true);
    expect(tables['sale_policies'].has('policy_type')).toBe(false);
  });

  it('should not reference non-existent columns in nested PostgREST selects', () => {
    const tables = parseTableColumns(typesPath);
    const edgeFunctions = collectTsFiles(functionsDir);
    const violations: string[] = [];

    for (const filePath of edgeFunctions) {
      const source = fs.readFileSync(filePath, 'utf-8');
      const nested = extractNestedSelects(source);

      for (const { table, columns, line } of nested) {
        // Only validate tables we know about from the schema
        if (!tables[table]) continue;

        const knownCols = tables[table];
        for (const col of columns) {
          // Skip aliased columns (e.g., "alias:real_col" — the part before colon is alias)
          const realCol = col.includes(':') ? col.split(':')[1].trim() : col;
          if (!knownCols.has(realCol)) {
            const rel = path.relative(repoRoot, filePath);
            violations.push(
              `${rel}:${line} — "${table}" has no column "${realCol}" (did you mean one of: ${[...knownCols].sort().join(', ')}?)`,
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found ${violations.length} invalid PostgREST nested select column(s):\n\n` +
          violations.map((v) => `  • ${v}`).join('\n'),
      );
    }
  });
});
