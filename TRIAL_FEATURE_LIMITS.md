# Trial Period Feature Limits Plan

## Overview

During the 7-day free trial, users get a **curated taste** of AgencyBrain - enough to see value, but with strategic limits that encourage conversion to paid.

---

## Feature Access Matrix

### AI Sales Roleplay
| Feature | Trial | Paid ($299/mo) | 1-on-1 Client |
|---------|-------|----------------|---------------|
| AI Roleplay Sessions | **2 sessions** | Not included | Unlimited |

**Implementation:**
- Track usage in `feature_usage` table
- After 2 sessions, show: "You've used your 2 trial roleplay sessions. Upgrade to continue practicing."
- For paid users (non-1-on-1): Show "AI Roleplay is available for 1-on-1 coaching clients"

---

### Accountability / Scorecards
| Feature | Trial | Paid ($299/mo) |
|---------|-------|----------------|
| View Scorecard | ✅ Basic template only | ✅ Full access |
| Submit Daily Data | ✅ | ✅ |
| Edit/Customize Scorecard | ❌ Locked | ✅ |
| Create New Scorecard | ❌ Locked | ✅ |
| Scorecard Settings | ❌ Locked | ✅ |

**Implementation:**
- Create a `trial_default_scorecard` template in the database
- On trial signup, auto-assign this scorecard to the agency
- Hide "Edit Scorecard", "Create Scorecard", "Scorecard Settings" buttons during trial
- Show lock icon with tooltip: "Customize your scorecards after your trial"

**Trial Scorecard Template Includes:**
- Standard daily KPIs (calls, quotes, policies, premium, etc.)
- Pre-configured for typical agency workflow
- Read-only structure, but users can submit their daily numbers

---

### Training Platform
| Feature | Trial | Paid ($299/mo) |
|---------|-------|----------------|
| View Standard Playbook Training | ✅ Full access | ✅ |
| Watch Training Videos | ✅ | ✅ |
| Complete Quizzes | ✅ | ✅ |
| Track Progress | ✅ | ✅ |
| Manage Training (Admin) | ❌ Locked | ✅ |
| Agency Training (Custom) | ❌ Locked | ✅ |
| Upload Custom Videos | ❌ Locked | ✅ |
| Create Custom Courses | ❌ Locked | ✅ |

**Implementation:**
- Hide "Manage Training" and "Agency Training" nav items/tabs during trial
- If user tries to access via URL, redirect to training hub with modal:

  ```
  ┌────────────────────────────────────────────────┐
  │  🎓 Custom Training Platform                   │
  │                                                │
  │  Build your own agency training library with   │
  │  custom videos, courses, and assessments.      │
  │                                                │
  │  This feature unlocks after your 7-day trial.  │
  │                                                │
  │  [Continue with Standard Playbook]             │
  │  [Upgrade Now to Unlock]                       │
  └────────────────────────────────────────────────┘
  ```

---

### Agency Management Tools
| Feature | Trial | Paid ($299/mo) |
|---------|-------|----------------|
| Comp Analyzer | ✅ | ✅ |
| Commission Builder | ✅ | ✅ |
| Team Roster | ✅ | ✅ |
| Agency Settings | ✅ | ✅ |
| **Bonus Tool** | ❌ Locked | ✅ |
| **Call Efficiency Tool** | ❌ Locked | ✅ |

**Implementation:**
- Show Bonus Tool and Call Efficiency Tool in nav but with lock icon
- On click, show upgrade modal:

  ```
  ┌────────────────────────────────────────────────┐
  │  🔒 Bonus Tool                                 │
  │                                                │
  │  Calculate and forecast team bonuses with      │
  │  our advanced bonus modeling tool.             │
  │                                                │
  │  Available after your 7-day trial.             │
  │                                                │
  │  [Maybe Later]  [Upgrade Now]                  │
  └────────────────────────────────────────────────┘
  ```

---

### Personal Growth
| Feature | Trial | Paid ($299/mo) |
|---------|-------|----------------|
| Core 4 Daily Tracking | ✅ | ✅ |
| Core 4 Dashboard | ✅ | ✅ |
| Monthly Missions | ✅ | ✅ |
| Life Targets | ✅ | ✅ |
| **Quarterly Targets** | ❌ Locked | ✅ |
| **90-Day Audio** | ❌ Locked | ✅ |

**Implementation:**
- Same pattern: show in nav with lock icon
- Modal on click explaining feature unlocks after trial

---

### Features with Full Trial Access
These features have NO restrictions during trial:

| Feature | Notes |
|---------|-------|
| Dashboard | Full access |
| Cancel Audit | Full access |
| Winback HQ | Full access |
| Renewal Tracking | Full access |
| LQS Tracking | Full access |
| Sales Logging | Full access |
| Leaderboard | Full access |
| Team Rings | Full access |
| Contacts | Full access |

---

## Database Schema

### Feature Limits Table

```sql
CREATE TABLE feature_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_status TEXT NOT NULL,  -- 'trialing', 'active', '1on1_client'
  feature_key TEXT NOT NULL,          -- unique feature identifier
  access_type TEXT NOT NULL,          -- 'full', 'limited', 'none'
  usage_limit INT,                    -- NULL = N/A, -1 = unlimited, N = count
  description TEXT,                   -- Human-readable description
  upgrade_message TEXT,               -- Message shown when blocked
  UNIQUE(subscription_status, feature_key)
);
```

### Seed Data

```sql
INSERT INTO feature_limits (subscription_status, feature_key, access_type, usage_limit, description, upgrade_message) VALUES
-- TRIAL LIMITS
('trialing', 'ai_roleplay', 'limited', 2, 'AI Sales Roleplay', 'You''ve used your 2 trial sessions. Upgrade for unlimited practice.'),
('trialing', 'scorecard_edit', 'none', NULL, 'Edit Scorecards', 'Customize your scorecards after your 7-day trial.'),
('trialing', 'scorecard_create', 'none', NULL, 'Create Scorecards', 'Create custom scorecards after your 7-day trial.'),
('trialing', 'training_manage', 'none', NULL, 'Manage Training', 'Build your custom training platform after your 7-day trial.'),
('trialing', 'training_agency', 'none', NULL, 'Agency Training', 'Create agency-specific training after your 7-day trial.'),
('trialing', 'bonus_tool', 'none', NULL, 'Bonus Tool', 'Access the Bonus Tool after your 7-day trial.'),
('trialing', 'call_efficiency', 'none', NULL, 'Call Efficiency Tool', 'Access the Call Efficiency Tool after your 7-day trial.'),
('trialing', 'quarterly_targets', 'none', NULL, 'Quarterly Targets', 'Set quarterly targets after your 7-day trial.'),
('trialing', '90_day_audio', 'none', NULL, '90-Day Audio', 'Access 90-Day Audio after your 7-day trial.'),

-- PAID ACCESS (everything unlocked)
('active', 'ai_roleplay', 'none', 0, 'AI Sales Roleplay', 'AI Roleplay is available for 1-on-1 coaching clients.'),
('active', 'scorecard_edit', 'full', -1, 'Edit Scorecards', NULL),
('active', 'scorecard_create', 'full', -1, 'Create Scorecards', NULL),
('active', 'training_manage', 'full', -1, 'Manage Training', NULL),
('active', 'training_agency', 'full', -1, 'Agency Training', NULL),
('active', 'bonus_tool', 'full', -1, 'Bonus Tool', NULL),
('active', 'call_efficiency', 'full', -1, 'Call Efficiency Tool', NULL),
('active', 'quarterly_targets', 'full', -1, 'Quarterly Targets', NULL),
('active', '90_day_audio', 'full', -1, '90-Day Audio', NULL),

-- 1-ON-1 CLIENT (everything unlimited)
('1on1_client', 'ai_roleplay', 'full', -1, 'AI Sales Roleplay', NULL),
('1on1_client', 'scorecard_edit', 'full', -1, 'Edit Scorecards', NULL),
('1on1_client', 'scorecard_create', 'full', -1, 'Create Scorecards', NULL),
('1on1_client', 'training_manage', 'full', -1, 'Manage Training', NULL),
('1on1_client', 'training_agency', 'full', -1, 'Agency Training', NULL),
('1on1_client', 'bonus_tool', 'full', -1, 'Bonus Tool', NULL),
('1on1_client', 'call_efficiency', 'full', -1, 'Call Efficiency Tool', NULL),
('1on1_client', 'quarterly_targets', 'full', -1, 'Quarterly Targets', NULL),
('1on1_client', '90_day_audio', 'full', -1, '90-Day Audio', NULL);
```

### Usage Tracking Table

```sql
CREATE TABLE feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  period_start DATE NOT NULL,  -- Trial start date or billing period start
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, feature_key, period_start)
);

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_feature_usage(
  p_agency_id UUID,
  p_feature_key TEXT,
  p_period_start DATE
) RETURNS INT AS $$
DECLARE
  new_count INT;
BEGIN
  INSERT INTO feature_usage (agency_id, feature_key, period_start, usage_count, last_used_at)
  VALUES (p_agency_id, p_feature_key, p_period_start, 1, NOW())
  ON CONFLICT (agency_id, feature_key, period_start)
  DO UPDATE SET
    usage_count = feature_usage.usage_count + 1,
    last_used_at = NOW(),
    updated_at = NOW()
  RETURNING usage_count INTO new_count;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql;
```

---

## Frontend Implementation

### Feature Access Hook

```typescript
// src/hooks/useFeatureAccess.ts
import { useQuery } from '@tanstack/react-query'
import { useSubscription } from './useSubscription'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/integrations/supabase/client'

interface FeatureAccess {
  canAccess: boolean
  accessType: 'full' | 'limited' | 'none'
  usageLimit: number | null
  used: number
  remaining: number | null
  upgradeMessage: string | null
  isLoading: boolean
}

export function useFeatureAccess(featureKey: string): FeatureAccess {
  const { profile } = useAuth()
  const { data: subscription, isLoading: subLoading } = useSubscription(profile?.agency_id)

  const status = subscription?.status || 'none'

  // Get limit for this feature + status
  const { data: limit, isLoading: limitLoading } = useQuery({
    queryKey: ['feature-limit', status, featureKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('feature_limits')
        .select('*')
        .eq('subscription_status', status)
        .eq('feature_key', featureKey)
        .single()
      return data
    },
    enabled: !!status,
  })

  // Get current usage
  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['feature-usage', profile?.agency_id, featureKey],
    queryFn: async () => {
      const periodStart = subscription?.trial_start
        ? new Date(subscription.trial_start).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0].slice(0, 7) + '-01' // First of month

      const { data } = await supabase
        .from('feature_usage')
        .select('usage_count')
        .eq('agency_id', profile?.agency_id)
        .eq('feature_key', featureKey)
        .eq('period_start', periodStart)
        .single()
      return data?.usage_count || 0
    },
    enabled: !!profile?.agency_id && limit?.access_type === 'limited',
  })

  const isLoading = subLoading || limitLoading || usageLoading

  if (!limit) {
    return {
      canAccess: false,
      accessType: 'none',
      usageLimit: null,
      used: 0,
      remaining: null,
      upgradeMessage: 'Feature not available',
      isLoading,
    }
  }

  const used = usage || 0
  const usageLimit = limit.usage_limit
  const remaining = usageLimit && usageLimit > 0 ? Math.max(0, usageLimit - used) : null

  let canAccess = false
  if (limit.access_type === 'full') {
    canAccess = true
  } else if (limit.access_type === 'limited' && remaining !== null) {
    canAccess = remaining > 0
  }

  return {
    canAccess,
    accessType: limit.access_type,
    usageLimit,
    used,
    remaining,
    upgradeMessage: limit.upgrade_message,
    isLoading,
  }
}
```

### Feature Gate Component

```typescript
// src/components/FeatureGate.tsx
import { useFeatureAccess } from '@/hooks/useFeatureAccess'
import { UpgradeModal } from './UpgradeModal'
import { useState } from 'react'
import { Lock } from 'lucide-react'

interface FeatureGateProps {
  feature: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { canAccess, upgradeMessage, isLoading } = useFeatureAccess(feature)
  const [showModal, setShowModal] = useState(false)

  if (isLoading) return null

  if (!canAccess) {
    return (
      <>
        {fallback || (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Lock className="w-4 h-4" />
            <span>Locked</span>
          </button>
        )}
        <UpgradeModal
          open={showModal}
          onClose={() => setShowModal(false)}
          message={upgradeMessage}
        />
      </>
    )
  }

  return <>{children}</>
}
```

### Usage in Components

```typescript
// Example: AI Roleplay page
function RoleplayPage() {
  const { canAccess, used, usageLimit, remaining, upgradeMessage } = useFeatureAccess('ai_roleplay')

  if (!canAccess) {
    return (
      <LockedFeatureCard
        title="AI Sales Roleplay"
        message={upgradeMessage}
        icon={Bot}
      />
    )
  }

  return (
    <div>
      {/* Usage indicator for limited features */}
      {usageLimit && usageLimit > 0 && (
        <div className="mb-4 p-3 bg-muted rounded-lg">
          <p className="text-sm">
            <strong>{remaining}</strong> of {usageLimit} sessions remaining
          </p>
          <Progress value={(used / usageLimit) * 100} className="mt-2" />
        </div>
      )}

      {/* Rest of roleplay UI */}
      <RoleplayInterface />
    </div>
  )
}
```

```typescript
// Example: Hiding nav items
function SidebarNav() {
  const bonusAccess = useFeatureAccess('bonus_tool')
  const callEfficiencyAccess = useFeatureAccess('call_efficiency')

  return (
    <nav>
      {/* Always visible */}
      <NavItem href="/dashboard">Dashboard</NavItem>
      <NavItem href="/sales">Sales</NavItem>

      {/* Locked during trial - show with lock icon */}
      <NavItem
        href="/bonus-tool"
        locked={!bonusAccess.canAccess}
        onClick={!bonusAccess.canAccess ? () => showUpgradeModal() : undefined}
      >
        Bonus Tool {!bonusAccess.canAccess && <Lock className="w-3 h-3" />}
      </NavItem>
    </nav>
  )
}
```

---

## Trial Default Scorecard

Create a pre-built scorecard template for trial users:

```sql
-- Template scorecard for trial users
INSERT INTO scorecard_templates (
  id,
  name,
  description,
  is_trial_default,
  kpis
) VALUES (
  'trial-default-scorecard',
  'AgencyBrain Starter Scorecard',
  'Pre-configured scorecard for your trial. Customize after upgrading.',
  true,
  '[
    {"key": "calls", "label": "Calls Made", "type": "number", "goal": 50},
    {"key": "quotes", "label": "Quotes", "type": "number", "goal": 10},
    {"key": "policies", "label": "Policies Sold", "type": "number", "goal": 3},
    {"key": "premium", "label": "Premium", "type": "currency", "goal": 5000},
    {"key": "households", "label": "Households", "type": "number", "goal": 2},
    {"key": "items", "label": "Items", "type": "number", "goal": 5}
  ]'
);
```

On trial signup, auto-assign this scorecard to the agency.

---

## Summary: Trial vs Paid

| Area | Feature | Trial | Paid |
|------|---------|-------|------|
| **Roleplay** | AI Sessions | 2 sessions | Not included* |
| **Scorecards** | View/Submit | ✅ (default template) | ✅ |
| | Edit/Create | ❌ | ✅ |
| **Training** | Standard Playbook | ✅ | ✅ |
| | Manage/Agency Training | ❌ | ✅ |
| **Tools** | Comp Analyzer | ✅ | ✅ |
| | Commission Builder | ✅ | ✅ |
| | Bonus Tool | ❌ | ✅ |
| | Call Efficiency | ❌ | ✅ |
| **Personal Growth** | Core 4 | ✅ | ✅ |
| | Monthly Missions | ✅ | ✅ |
| | Life Targets | ✅ | ✅ |
| | Quarterly Targets | ❌ | ✅ |
| | 90-Day Audio | ❌ | ✅ |
| **Everything Else** | Dashboard, Cancel Audit, Winback, LQS, etc. | ✅ | ✅ |

*AI Roleplay is unlimited for 1-on-1 coaching clients only

---

## Implementation Checklist

- [ ] Create `feature_limits` table with seed data
- [ ] Create `feature_usage` table
- [ ] Create `increment_feature_usage` function
- [ ] Create `useFeatureAccess` hook
- [ ] Create `FeatureGate` component
- [ ] Create `UpgradeModal` component
- [ ] Create trial default scorecard template
- [ ] Update sidebar nav to show lock icons
- [ ] Update each restricted page to use FeatureGate
- [ ] Add usage indicators for limited features (roleplay)
- [ ] Test all feature gates in trial mode
- [ ] Test all features unlock after payment
