---
paths:
  - "src/components/**/*.tsx"
  - "src/pages/**/*.tsx"
---

# React Components Rules

## File Organization
- Reusable components: `src/components/`
- Page components: `src/pages/`
- UI primitives (shadcn): `src/components/ui/`

## Component Structure
```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ComponentNameProps {
  requiredProp: string;
  optionalProp?: number;
  onAction?: (value: string) => void;
}

export function ComponentName({ requiredProp, optionalProp, onAction }: ComponentNameProps) {
  const [localState, setLocalState] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{requiredProp}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Component content */}
      </CardContent>
    </Card>
  );
}
```

## Conventions
- **Functional components only** (class components only for error boundaries)
- **Named exports** (not default exports)
- **PascalCase** for component names and files
- **Interface suffix** with `Props` (e.g., `ButtonProps`)

## Styling
- Use **Tailwind CSS** for all styling
- Use **shadcn/ui** components from `@/components/ui/`
- Icons from **lucide-react**
- No inline styles or CSS modules

## Imports
```typescript
// Path alias - always use @/
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';

// Not: '../../../lib/auth'
```

## State Management
- **Local state**: `useState` for component-specific state
- **Server state**: React Query hooks from `src/hooks/`
- **Global client state**: Zustand stores

## Props
- Define TypeScript interface for all props
- Use destructuring in function signature
- Provide sensible defaults for optional props

## Event Handlers
```typescript
// Prefix with 'handle' or 'on'
const handleClick = () => { ... };
const handleSubmit = (e: FormEvent) => { ... };

// Pass as props
<Button onClick={handleClick}>Click</Button>
```

## Conditional Rendering
```typescript
// Prefer early returns for loading/error states
if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorAlert error={error} />;

// Use && for simple conditions
{isVisible && <Component />}

// Use ternary for either/or
{isEditing ? <EditForm /> : <DisplayView />}
```
