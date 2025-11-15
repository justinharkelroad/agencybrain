# Life Targets - Technical Documentation

## Architecture Overview

### Frontend Stack
- **React 18** with TypeScript
- **React Query** for data fetching and caching
- **Zustand** for state management
- **Tailwind CSS** for styling
- **Radix UI** for accessible components

### Backend Stack
- **Supabase** (PostgreSQL + Auth)
- **Deno Edge Functions** for AI processing
- **OpenAI GPT-4** for target analysis

## Database Schema

### Table: `life_targets_quarterly`

```sql
CREATE TABLE life_targets_quarterly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  quarter TEXT NOT NULL, -- 'Q1', 'Q2', 'Q3', 'Q4'
  
  -- Body domain
  body_target TEXT,
  body_narrative TEXT,
  body_daily_habit TEXT,
  body_monthly_missions JSONB,
  
  -- Being domain
  being_target TEXT,
  being_narrative TEXT,
  being_daily_habit TEXT,
  being_monthly_missions JSONB,
  
  -- Balance domain
  balance_target TEXT,
  balance_narrative TEXT,
  balance_daily_habit TEXT,
  balance_monthly_missions JSONB,
  
  -- Business domain
  business_target TEXT,
  business_narrative TEXT,
  business_daily_habit TEXT,
  business_monthly_missions JSONB,
  
  -- Metadata
  raw_session_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, quarter)
);
```

### RLS Policies

```sql
-- Users can manage their own targets
CREATE POLICY "Users can manage their own life targets"
  ON life_targets_quarterly
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all targets
CREATE POLICY "Admins can view all life targets"
  ON life_targets_quarterly
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

## API Endpoints

### Edge Functions

#### 1. `life_targets_measurability`
**Purpose**: Analyze target clarity and provide suggestions

**Input:**
```typescript
{
  targets: {
    body: string[],
    being: string[],
    balance: string[],
    business: string[]
  }
}
```

**Output:**
```typescript
{
  analysis: {
    body: ItemAnalysis[],
    being: ItemAnalysis[],
    balance: ItemAnalysis[],
    business: ItemAnalysis[]
  }
}

interface ItemAnalysis {
  original: string;
  clarity_score: number; // 0-10
  rewritten_target: string;
}
```

#### 2. `life_targets_monthly_missions`
**Purpose**: Generate 3-month breakdown of targets

**Input:**
```typescript
{
  quarter: string,
  body?: {
    target1?: string,
    target2?: string,
    narrative?: string
  },
  being?: { /* same structure */ },
  balance?: { /* same structure */ },
  business?: { /* same structure */ }
}
```

**Output:**
```typescript
{
  missions: {
    body?: {
      target1?: {
        "Month 1": { mission: string, why: string },
        "Month 2": { mission: string, why: string },
        "Month 3": { mission: string, why: string }
      }
    },
    // ... similar for other domains
  }
}
```

#### 3. `life_targets_daily_actions`
**Purpose**: Generate 10 actionable daily habits per domain

**Input:**
```typescript
{
  body?: {
    target?: string,
    monthlyMissions?: any,
    narrative?: string
  },
  // ... similar for other domains
}
```

**Output:**
```typescript
{
  dailyActions: {
    body: string[],   // 10 actions
    being: string[],
    balance: string[],
    business: string[]
  }
}
```

## State Management

### Zustand Store: `lifeTargetsStore`

```typescript
interface LifeTargetsState {
  currentQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  targets: QuarterlyTargets | null;
  measurabilityResults: MeasurabilityAnalysis | null;
  monthlyMissions: MonthlyMissionsOutput | null;
  dailyActions: DailyActionsOutput | null;
  isLoading: boolean;
  
  setCurrentQuarter: (quarter: string) => void;
  setTargets: (targets: QuarterlyTargets | null) => void;
  setMeasurabilityResults: (results: MeasurabilityAnalysis | null) => void;
  setMonthlyMissions: (missions: MonthlyMissionsOutput | null) => void;
  setDailyActions: (actions: DailyActionsOutput | null) => void;
  setIsLoading: (loading: boolean) => void;
  reset: () => void;
}
```

**Persistence**: Stored in `localStorage` under key `life-targets-storage`

## Component Hierarchy

```
LifeTargets (Dashboard)
├── Card (Progress Overview)
└── Card[] (Action Buttons)

LifeTargetsQuarterly
├── QuarterlyTargetsForm
│   ├── Select (Quarter Selector)
│   ├── Input[] (Targets)
│   └── Textarea[] (Narratives)
└── MeasurabilityAnalysisCard
    └── AnalysisItem[]
        ├── Badge (Clarity Score)
        └── Button (Apply Suggestion)

LifeTargetsMissions
└── MonthlyMissionsTimeline
    └── Domain Cards[]
        └── Mission Cards[]

LifeTargetsDaily
└── DailyActionsSelector
    └── Domain Sections[]
        └── Checkbox[] (10 actions)
```

## React Hooks

### Custom Hooks

1. **`useQuarterlyTargets(quarter: string)`**
   - Fetches targets for specified quarter
   - Returns: `{ data, isLoading, error }`

2. **`useSaveQuarterlyTargets()`**
   - Mutation hook for saving targets
   - Handles insert and update
   - Returns: `{ mutateAsync, isPending }`

3. **`useTargetMeasurability()`**
   - Calls AI analysis edge function
   - Returns: `{ mutateAsync, isPending }`

4. **`useMonthlyMissions()`**
   - Calls mission generation edge function
   - Returns: `{ mutateAsync, isPending }`

5. **`useDailyActions()`**
   - Calls daily actions edge function
   - Returns: `{ mutateAsync, isPending }`

## Performance Optimizations

### Code Splitting
```typescript
// Lazy load Life Targets pages
const LifeTargets = lazy(() => import("./pages/LifeTargets"));
const LifeTargetsQuarterly = lazy(() => import("./pages/LifeTargetsQuarterly"));
```

### Memoization
- `useMemo` for computed values (targets count, missions status)
- `useCallback` for event handlers

### Caching
- React Query: 60s stale time, 10min cache
- Edge function responses: 5min client-side cache
- localStorage: Persistent state cache

## Security

### Authentication
- JWT tokens via Supabase Auth
- Edge functions validate `auth.uid()`

### Authorization
- RLS enforces user-level isolation
- Admin role for support access

### Input Validation
- Max lengths enforced (500 chars for targets, 1000 for narratives)
- XSS prevention via React's auto-escaping
- SQL injection prevented by Supabase client

### Rate Limiting
- Edge functions: 10 requests/hour/user
- Implemented via edge function logic

## Error Handling

### Client-Side
```typescript
try {
  await mutation.mutateAsync(data);
  toast.success("Saved successfully");
} catch (error) {
  console.error("Error:", error);
  toast.error(error.message || "Failed to save");
}
```

### Edge Function Errors
```typescript
{
  error: "OpenAI API rate limit exceeded",
  code: "RATE_LIMIT_EXCEEDED",
  retryAfter: 3600 // seconds
}
```

## Testing

### Unit Tests
- Located in `src/tests/lifeTargets.test.ts`
- Run: `npm test`
- Coverage: >80% for hooks and utilities

### Integration Tests
- E2E tests via Playwright
- Located in `e2e/life-targets.spec.ts`
- Run: `npm run test:e2e`

## Deployment

### Frontend
- Automatic deployment on push to main
- Hosted on Lovable CDN

### Edge Functions
- Auto-deployed from `supabase/functions/`
- Environment variables via Supabase dashboard

### Database Migrations
- Managed via Supabase migrations
- Run: `supabase db push`

## Monitoring

### Metrics
- API response times (p50, p95, p99)
- Error rates by endpoint
- User engagement (targets set, analyses run)

### Logging
- Edge function logs in Supabase dashboard
- Client errors logged to console (dev only)

## Future Enhancements

1. **Habit Tracking**: Daily check-ins for habits
2. **Progress Charts**: Visual progress over time
3. **Sharing**: Share targets with accountability partners
4. **Templates**: Pre-built target templates by domain
5. **Export**: PDF/CSV export of quarterly plans
6. **Notifications**: Reminders for mission milestones

## Contributing
See `CONTRIBUTING.md` for development setup and guidelines.
