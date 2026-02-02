# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgencyBrain is a production-ready insurance agency management platform. It's a multi-tenant SaaS application with sales tracking, training, compensation analysis, and staff management features.

**Tech Stack**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase (PostgreSQL + Edge Functions)

## Development Commands

```bash
npm run dev          # Start dev server (localhost:8080)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run Vitest unit tests
npm run test:watch   # Vitest watch mode
npm run test:e2e     # Playwright E2E tests
```

Run a single test file:
```bash
npx vitest run src/tests/your-test.test.ts
```

Run tests matching a pattern:
```bash
npx vitest run -t "pattern"
```

## Architecture

### Data Flow
```
React Components → React Query hooks → Supabase SDK → Edge Functions → PostgreSQL (RLS)
```

### Key Directories
- `src/components/` - 424 React components, including `ui/` for shadcn/ui
- `src/pages/` - Route-level pages (`admin/`, `agency/`, `staff/`)
- `src/hooks/` - 127 custom React hooks
- `src/lib/` - Core utilities (`auth.tsx`, `supabaseClient.ts`, `utils.ts`)
- `src/config/navigation.ts` - Hierarchical navigation with role-based access
- `supabase/functions/` - 113 Deno edge functions
- `supabase/migrations/` - 548 database migrations

### State Management
- **AuthProvider** (`src/lib/auth.tsx`): User session and roles
- **Zustand**: Global stores (bonus grid state, chat persistence)
- **React Query**: Server state and caching

### Multi-Tenant Security
- All data is agency-scoped via Row-Level Security (RLS) policies
- User roles: admin, agency owner, key employee, staff
- Edge functions use `SECURITY INVOKER` (run with caller privileges)
- `has_agency_access(auth.uid(), agency_id)` validates access in RLS policies

### Public Form System
- Token-based access without authentication
- Edge functions: `submit_public_form`, `resolve_public_form`
- Versioned KPI tracking (`kpi_versions`, `forms_kpi_bindings`)

## CI/CD

Deployments are gated by GitHub Actions (`.github/workflows/edge-deploy-gates.yml`):

- **Gate A** (blocking): Verify functions on disk match `supabase/config.toml`
- **Gate B** (non-blocking): Resolve function schema validation
- **Gate C** (non-blocking): KPI smoke test

Edge functions auto-deploy to Supabase on push to `main`.

## Database Conventions

- All tables have RLS policies enforcing agency isolation
- Use `FOR SELECT` for read-only dashboard queries
- Never use `SECURITY DEFINER` without explicit justification
- Migrations in `supabase/migrations/` are versioned and reversible

## Testing

- **Vitest**: Unit tests with jsdom, setup in `src/tests/setup.ts`
- **Playwright**: E2E tests in `src/tests/e2e/`
- Supabase client is auto-mocked in tests

Test locations:
- `src/tests/` - Main test directory (security, edge functions, integration)
- `src/tests/e2e/` - Playwright E2E tests
- `src/utils/*.test.ts` - Unit tests co-located with utilities

## Path Aliases

`@/*` maps to `./src/*` (configured in `tsconfig.json` and `vite.config.ts`)
