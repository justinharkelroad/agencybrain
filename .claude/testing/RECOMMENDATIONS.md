# Claude Code Setup Recommendations for AgencyBrain

## Executive Summary

AgencyBrain is a sophisticated insurance agency management platform with **zero Claude Code configuration**. Based on best practices research, here are the top recommendations for improving Claude's effectiveness in this codebase.

---

## Recommendation 1: Create CLAUDE.md Project Memory

**Priority**: Critical
**Impact**: High
**Effort**: Low

### Current State
No CLAUDE.md file exists. Claude has no persistent memory of project conventions, tech stack, or common commands.

### Proposed Change
Create a comprehensive CLAUDE.md with:
- Project overview and architecture
- Tech stack (React 18, TypeScript, Vite, Supabase, Tailwind)
- Common commands (dev, build, test, lint)
- Code conventions and patterns
- Important files and directories
- Security considerations (RLS, JWT)

### Expected Impact
- Reduced context-building time in each session
- Consistent adherence to project conventions
- Fewer errors from incorrect assumptions about the codebase

---

## Recommendation 2: Create Permission Settings

**Priority**: High
**Impact**: High
**Effort**: Low

### Current State
No settings.json exists. Claude has no defined permissions, leading to prompts for every operation.

### Proposed Change
Create .claude/settings.json with:
- Allow: npm/bun commands, git operations, src/ file access
- Deny: .env files, secrets, destructive operations
- PostToolUse hooks for auto-formatting

### Expected Impact
- Faster workflow with pre-approved safe operations
- Protection of sensitive files (.env, secrets)
- Automatic code formatting on edits

---

## Recommendation 3: Create Path-Specific Rules for React/TypeScript

**Priority**: High
**Impact**: Medium-High
**Effort**: Medium

### Current State
No rules files exist. Claude doesn't know about project-specific patterns.

### Proposed Change
Create rules for:
- `rules/typescript.md` - TypeScript strict mode patterns
- `rules/react.md` - React/hooks conventions
- `rules/testing.md` - Vitest/Playwright patterns
- `rules/supabase.md` - Edge functions, RLS patterns
- `rules/security.md` - Security requirements

### Expected Impact
- Code generated follows existing patterns
- Consistent component structure
- Proper error handling and security patterns

---

## Recommendation 4: Create Code Review Subagent

**Priority**: Medium-High
**Impact**: High
**Effort**: Medium

### Current State
No custom subagents. Code review requires manual prompting.

### Proposed Change
Create `agents/code-reviewer.md` that:
- Automatically reviews code changes
- Checks for security issues (RLS bypass, JWT exposure)
- Validates TypeScript patterns
- Verifies test coverage

### Expected Impact
- Proactive code quality checks
- Security issues caught before commit
- Consistent code review standards

---

## Recommendation 5: Create Testing Skill

**Priority**: Medium
**Impact**: Medium-High
**Effort**: Medium

### Current State
No testing skill. Must manually explain test requirements each session.

### Proposed Change
Create `skills/test-runner/SKILL.md` that:
- Knows Vitest and Playwright configuration
- Runs appropriate tests based on changed files
- Provides coverage analysis
- Suggests missing test cases

### Expected Impact
- Faster test execution workflow
- Better test coverage decisions
- Consistent testing patterns

---

## Recommendation 6: Create Supabase Operations Skill

**Priority**: Medium
**Impact**: Medium
**Effort**: Medium

### Current State
No Supabase-specific guidance. Edge functions have complex patterns.

### Proposed Change
Create `skills/supabase-ops/SKILL.md` that:
- Knows edge function structure (CORS, JWT, versioning)
- Understands migration patterns
- Guides RLS policy creation
- Helps with Supabase CLI operations

### Expected Impact
- Correct edge function structure from start
- Proper security patterns in database operations
- Fewer migration errors

---

## Testing Strategy

For each recommendation, we will:
1. Create a test prompt that exercises the changed behavior
2. Run the prompt BEFORE applying the change, document response
3. Apply the recommended change
4. Run the same prompt AFTER, document response
5. Compare and analyze the impact

### Test Metrics
- Response accuracy (does Claude follow conventions?)
- Tool usage efficiency (fewer unnecessary tool calls?)
- Error prevention (catches issues earlier?)
- Context awareness (knows project patterns?)
