# Test Report: Path-Specific Rules - BEFORE

## Test Date: 2026-01-15
## Configuration State: No rules files exist in .claude/rules/

---

## Test Prompt 1: "Create a new hook for fetching staff renewals"

### Observed Behavior (Without Rules):

**Pattern Discovery Required:**
- Must read existing hooks to understand patterns
- Must discover React Query usage
- Must find TypeScript interface conventions
- Must understand Supabase client import path

**Potential Mistakes Without Rules:**
- Might use useState instead of React Query
- Might define types inline instead of interfaces
- Might use wrong import paths
- Might not include proper error handling

**Tool Calls Needed:**
- Read 2-3 existing hooks to understand patterns
- Check lib/supabaseClient.ts for import path

---

## Test Prompt 2: "Add a new Supabase edge function for fetching user notifications"

### Observed Behavior (Without Rules):

**Pattern Discovery Required:**
- Must find edge function structure (serve(), CORS)
- Must understand JWT verification requirements
- Must discover error response format
- Must learn parameter validation patterns

**Potential Mistakes Without Rules:**
- Might use wrong Deno import syntax
- Might forget CORS headers
- Might not handle OPTIONS preflight
- Might use inconsistent error response format
- Might not validate required parameters

**Tool Calls Needed:**
- Read 2-3 existing edge functions
- Check supabase/config.toml for JWT settings

---

## Test Prompt 3: "Write unit tests for the marketing calculator"

### Observed Behavior (Without Rules):

**Pattern Discovery Required:**
- Must find test file naming convention (*.test.ts)
- Must discover Vitest configuration
- Must understand assertion patterns
- Must find mocking approach

**Potential Mistakes Without Rules:**
- Might use Jest syntax instead of Vitest
- Might not follow describe/it nesting convention
- Might not include edge case tests
- Might not check coverage requirements

**Tool Calls Needed:**
- Read existing test files for patterns
- Check vitest.config.ts for configuration

---

## Test Prompt 4: "Ensure this component handles security properly"

### Observed Behavior (Without Rules):

**Security Awareness Missing:**
- No automatic security checklist
- Must manually think through security concerns
- No prompting for RLS considerations
- No JWT verification reminders

**Potential Security Issues:**
- Might not consider agency scoping
- Might expose sensitive data
- Might bypass RLS patterns
- Might not validate user input

---

## Summary: Current State Deficiencies

| File Type | Pattern Knowledge | Security Awareness | Auto-Guidance |
|-----------|-------------------|-------------------|---------------|
| React hooks | Must discover | None | None |
| Edge functions | Must discover | None | None |
| Test files | Must discover | None | None |
| Components | Must discover | None | None |

**Impact:**
- Inconsistent code patterns
- Security considerations missed
- More tool calls to understand conventions
- Higher risk of introducing bugs
