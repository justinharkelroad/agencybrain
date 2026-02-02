# Tech Debt Scanner

Use this skill to find and report technical debt in the AgencyBrain codebase.

## What to Scan For

### 1. Duplicate Code
Look for similar patterns across:
- `src/components/` - 424 components may have duplicated UI patterns
- `src/hooks/` - 127 hooks may have overlapping logic
- `supabase/functions/` - 113 edge functions often repeat auth/CORS boilerplate

### 2. Dead Code
- Unused exports in hooks
- Components not imported anywhere
- Edge functions not listed in `supabase/config.toml`
- Unused React Query hooks

### 3. Inconsistent Patterns
- Mixed auth patterns (x-staff-session vs JWT)
- Inconsistent error handling
- Mixed naming conventions (camelCase vs snake_case in functions)

### 4. Missing Types
- `any` types in TypeScript
- Missing return types on functions
- Untyped API responses

### 5. Performance Issues
- Missing React.memo on frequently re-rendered components
- Missing useMemo/useCallback where beneficial
- N+1 queries in edge functions

## Scan Commands

When user invokes this skill, run these checks:

```bash
# Find unused exports
npx ts-prune src/

# Find duplicate code blocks
npx jscpd src/components --min-lines 10 --min-tokens 50

# Find any types
grep -r ": any" src/ --include="*.ts" --include="*.tsx" | wc -l

# Find TODO/FIXME comments
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ supabase/functions/
```

## Output Format

When reporting tech debt, categorize by:

1. **Critical** - Security issues, broken functionality
2. **High** - Performance problems, duplicate logic causing bugs
3. **Medium** - Code quality, maintainability
4. **Low** - Style inconsistencies, minor cleanup

For each item, provide:
- File path and line number
- Description of the issue
- Suggested fix
- Estimated effort (trivial/small/medium/large)

## Integration with CLAUDE.md

After identifying patterns that repeatedly cause issues, suggest updates to CLAUDE.md to prevent future occurrences.
