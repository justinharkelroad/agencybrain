# AgencyBrain - Claude Code Context

Insurance agency management platform built with React, TypeScript, and Supabase.

## Quick Commands

```bash
# Install dependencies
npm install

# Development server (http://localhost:8080)
npm run dev

# Production build
npm run build

# Run linting
npm run lint

# Run unit tests (Vitest)
npm run vitest

# Run E2E tests (Playwright)
npx playwright test
```

## Project Structure

- `src/` - React application source
  - `components/` - Reusable UI components (shadcn/ui + custom)
  - `pages/` - Route page components
  - `hooks/` - Custom React hooks
  - `lib/` - Utilities, auth, API clients
  - `types/` - TypeScript definitions
  - `contexts/` - React context providers
  - `tests/` - Unit and E2E tests
- `supabase/` - Backend infrastructure
  - `functions/` - 70+ Edge Functions (serverless)
  - `migrations/` - Database schema migrations
- `docs/` - Project documentation

## Tech Stack

- **Frontend**: React 18.3, TypeScript, Vite, Tailwind CSS
- **UI**: shadcn/ui (Radix UI + Tailwind)
- **State**: React Query, Zustand, React Context
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth)
- **Testing**: Vitest (unit), Playwright (E2E)

## Key Patterns

- **Auth**: Supabase Auth with role-based access (Sales, Service, Admin)
- **Protected Routes**: Use `ProtectedRoute` and `StaffProtectedRoute` HOCs
- **Data Fetching**: Custom hooks with React Query (e.g., `useStaffFlowStats`)
- **API**: Supabase client singleton at `@/lib/supabaseClient`
- **Styling**: Tailwind utilities with HSL CSS variables for theming
- **Forms**: React Hook Form with Zod validation

## Naming Conventions

- Components: PascalCase (`CallScorecard.tsx`)
- Hooks/Utils: camelCase (`useSessionRecovery.ts`)
- Constants: UPPER_SNAKE_CASE

## Environment

- Node.js 20+ (see `.nvmrc`)
- Environment variables in `.env` (Supabase credentials)

## Important Notes

- TypeScript strict mode is disabled at project level but enforced in components
- All database tables use Row Level Security (RLS)
- Edge Functions require JWT verification (see `supabase/config.toml`)
- PWA support enabled via vite-plugin-pwa
