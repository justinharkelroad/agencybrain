# AgencyBrain - Insurance Agency Management Platform

## Project Overview
AgencyBrain is a production-ready insurance agency management platform featuring:
- Versioned KPI tracking with role-based dashboards
- Secure public form submissions with token-based access
- Staff management with training and compliance tracking
- Sales analytics, compensation, and ROI forecasting
- Call scoring with AI-powered quality analysis

## Tech Stack
- **Frontend**: React 18 + TypeScript (strict mode) + Vite 5.4
- **Styling**: Tailwind CSS 3.4 + shadcn/ui components
- **State**: React Query 5 (server) + Zustand 5 (client)
- **Backend**: Supabase (PostgreSQL + Edge Functions with Deno)
- **Testing**: Vitest (unit) + Playwright (E2E)
- **CI/CD**: GitHub Actions with deployment gates

## Common Commands
```bash
bun dev          # Start development server
bun build        # Build for production
bun lint         # Run ESLint
npx vitest       # Run unit tests
npx vitest --coverage  # Run tests with coverage
npx playwright test    # Run E2E tests
```

## Project Structure
```
src/
├── pages/       # Route components (60+ pages)
├── components/  # Reusable UI components
│   └── ui/      # shadcn/ui primitives
├── hooks/       # Custom React hooks (50+)
├── lib/         # Core utilities & integrations
├── utils/       # Helper functions
├── types/       # TypeScript type definitions
├── config/      # Feature flags & navigation
└── tests/       # Test files

supabase/
├── functions/   # Edge functions (107 functions)
└── migrations/  # Database migrations (60+)
```

## Code Conventions

### Components
- Use functional components with hooks (no class components)
- Place in `src/components/` with PascalCase naming
- Use shadcn/ui primitives from `@/components/ui/`
- Import with `@/` alias (maps to `src/`)

### Hooks
- Custom hooks go in `src/hooks/`
- Prefix with `use` (e.g., `useDashboardData.ts`)
- Use React Query for server state, Zustand for client state

### TypeScript
- Strict mode enabled - no `any` types
- Define interfaces in `src/types/` for shared types
- Use `type` imports: `import type { Type } from 'module'`

### Testing
- Unit tests alongside source: `*.test.ts`
- E2E tests in `e2e/` and `src/tests/e2e/`
- Minimum 80% coverage, 100% for critical paths
- All tests must pass before merging (CI gate enforced)

## Key Architecture Patterns

### Versioned KPI System
- `kpis` table holds KPI definitions
- `kpi_versions` tracks label changes over time
- `forms_kpi_bindings` links forms to KPI versions
- Always capture `kpi_version_id` at submission time

### Security (Critical)
- **Row Level Security (RLS)**: All tables have RLS policies
- **Agency Scoping**: Use `has_agency_access()` for validation
- **JWT Verification**: Protected edge functions require valid JWT
- **Never expose**: .env files, API keys, user tokens

### Edge Functions Pattern
```typescript
// Standard edge function structure
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Function logic
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### Performance Targets
- Dashboard queries: <150ms
- Form submissions: <5s
- Use strategic indexing for common queries

## Important Files
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Build configuration with PWA
- `vitest.config.ts` - Unit test configuration
- `playwright.config.ts` - E2E test configuration
- `supabase/config.toml` - Edge function definitions
- `src/config/featureGates.ts` - Feature flags
- `src/lib/auth.tsx` - Authentication context

## CI/CD Gates
All PRs must pass:
1. **Gate A**: Function names match disk and config
2. **Gate B**: Edge function schema tests
3. **Gate C**: KPI smoke tests
4. **Nightly**: Full KPI validation runs at 2 AM UTC

## Security Checklist
When modifying code, verify:
- [ ] RLS policies cover new tables/columns
- [ ] Edge functions validate JWT where required
- [ ] No secrets in code or logs
- [ ] User input is validated
- [ ] Agency scoping is enforced
