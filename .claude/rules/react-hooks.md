---
paths:
  - "src/hooks/**/*.ts"
  - "src/hooks/**/*.tsx"
---

# React Hooks Rules

## File Structure
- Place hooks in `src/hooks/`
- Use `use` prefix (e.g., `useStaffRenewals.ts`)
- One hook per file unless tightly coupled

## Pattern Template
```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

interface HookParams {
  // Define input parameters
}

interface HookData {
  // Define return data shape
}

export function useHookName(params: HookParams) {
  return useQuery({
    queryKey: ["unique-key", params.dependentValue],
    enabled: !!params.requiredValue,
    queryFn: async (): Promise<HookData> => {
      // Implementation
    }
  });
}
```

## State Management
- Use React Query for server state (data fetching)
- Use Zustand for client state (UI state, filters)
- Never use useState for cacheable server data

## TypeScript Requirements
- Define interfaces for params and return types
- No `any` types - use proper typing
- Export hook function, not default export

## Error Handling
- React Query handles errors automatically
- Log errors with context for debugging
- Return structured error information

## Common Patterns
- `enabled: !!requiredParam` - conditional fetching
- `queryKey: ["name", ...deps]` - cache key includes dependencies
- `staleTime` / `cacheTime` for performance tuning
