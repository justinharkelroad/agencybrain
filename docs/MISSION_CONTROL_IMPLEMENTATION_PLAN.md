# Mission Control Implementation Plan

## Goal

Ship a new owner-only 1:1 coaching workspace called `Mission Control` that becomes the operating system for one-on-one agency clients.

This feature should let the agency owner:

- review the last coaching call
- upload or view transcripts and related artifacts
- track the top commitments they made on the call
- prove completion before the next call
- maintain a rolling mission board across months
- query an AI "mastermind" grounded in that client's own history

This feature is explicitly **not** for key employees, managers, or staff.

## Current Code Audit

### Reusable pieces

- `src/pages/Dashboard.tsx`
  - Current 1:1 CTA points to `/submit?mode=new`
  - Good entry point to replace with Mission Control
- `src/pages/Submit.tsx`
  - Already captures wins, stress, and top-three attack items
  - Good source model for the Business Pulse module
- `src/components/focus/MyCurrentFocus.tsx`
  - Good board interaction pattern
- `src/hooks/useFocusItems.ts`
  - Good optimistic mutation pattern
- `src/pages/sales-experience/SalesExperienceTranscript.tsx`
  - Good transcript presentation model
- `src/pages/sales-experience/SalesExperienceOverview.tsx`
  - Good premium-program overview layout pattern
- `src/pages/admin/ClientDetail.tsx`
  - Internal/admin analog of the client mission workspace
- `src/pages/admin/AdminOneOnOneClients.tsx`
  - Existing feature-access UI for one-on-one-specific add-ons
- `src/hooks/useFeatureAccess.ts`
  - Existing subscription/feature-access check pattern

### Access leaks that must be fixed before launch

- `src/components/ProtectedRoute.tsx`
  - `requireAgencyOwner` currently allows `isKeyEmployee`
- `src/hooks/useUserPermissions.ts`
  - key employees are mapped to effective role `owner`
- `src/hooks/useSalesExperienceAccess.ts`
  - key employees and managers can inherit premium program access
- `src/hooks/useSidebarAccess.ts`
  - key employees are normalized to manager-level nav access
- `supabase/migrations/20260130135500_fix_has_agency_access_for_key_employees.sql`
  - `has_agency_access()` intentionally includes key employees

Conclusion:

- frontend route gating cannot rely on existing owner abstractions
- backend RLS cannot rely on `has_agency_access()` alone
- Mission Control needs explicit `owner_user_id = auth.uid()` protection on its tenant-facing tables

## Product Scope

## V1 modules

1. Session Memory
2. Commitment Tracker
3. Mission Board
4. Wins + Issues
5. Business Pulse

## V2 module

6. AI Mastermind

## Route + Navigation

### Route

- Add `/mission-control`
- Add optional nested routes later:
  - `/mission-control/new-call`
  - `/mission-control/session/:sessionId`
  - `/mission-control/commitment/:commitmentId`

### Navigation placement

Add `Mission Control` under `Agency Mgmt` in `src/config/navigation.ts`.

Visibility rules:

- `owner: true`
- `manager: false`
- `staff: false`
- requires tier: `1:1`
- requires feature flag: `mission_control`

Important:

- nav filtering must not rely on current manager semantics for key employees
- use an explicit item-level gate for "true owner only"

## Access Control Design

## Frontend access

### New route guard

Add a new guard mode in `src/components/ProtectedRoute.tsx`:

- `requireTrueAgencyOwner?: boolean`

Behavior:

- allow if `isAdmin`
- allow if `isAgencyOwner`
- deny if `isKeyEmployee`
- deny if manager/staff
- if denied, redirect to `/dashboard`

### New hook

Create `src/hooks/useMissionControlAccess.ts` that returns:

- `hasAccess`
- `agencyId`
- `ownerUserId`
- `isLoading`
- `reason`

Checks:

1. authenticated user
2. `isAdmin || isAgencyOwner`
3. not `isKeyEmployee`
4. `isStrictlyOneOnOne(membershipTier)`
5. agency has `agency_feature_access.feature_key = 'mission_control'`

Do not reuse `useUserPermissions.effectiveRole` as the source of truth.

## Backend access

### Feature flag

Reuse `agency_feature_access`.

Add `mission_control` to:

- `src/pages/admin/AdminOneOnOneClients.tsx`

This allows agency-by-agency rollout without opening the feature to the entire 1:1 base on day one.

### RLS principle

For Mission Control tables, use:

- `owner_user_id = auth.uid()`
- and `has_agency_access(auth.uid(), agency_id)`

This preserves admin access while blocking key employees and other agency members.

Do not use `has_agency_access()` by itself for Mission Control data.

### Admin access

Admins should have `FOR ALL` policies via `user_roles.role = 'admin'`.

## Data Model

## Reuse as-is

- `periods`
  - monthly/pulse history only
- `uploads`
  - raw file record storage
- storage bucket `uploads`
  - attachment binary storage

## Reuse only as UI/reference pattern

- `focus_items`
- `sales_experience_transcripts`

## New tables

### 1. `mission_control_sessions`

Purpose:

- one row per coaching meeting/check-in

Columns:

- `id uuid primary key`
- `agency_id uuid not null references agencies(id)`
- `owner_user_id uuid not null references profiles(id)`
- `period_id uuid null references periods(id)`
- `session_date date not null`
- `title text not null`
- `status text not null default 'open'`
- `transcript_text text null`
- `summary_ai text null`
- `wins_json jsonb not null default '[]'::jsonb`
- `issues_json jsonb not null default '[]'::jsonb`
- `key_points_json jsonb not null default '[]'::jsonb`
- `next_call_date date null`
- `created_by uuid references profiles(id)`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `(agency_id, session_date desc)`
- `(owner_user_id, session_date desc)`

### 2. `mission_control_commitments`

Purpose:

- top commitments extracted or entered per session

Columns:

- `id uuid primary key`
- `agency_id uuid not null references agencies(id)`
- `owner_user_id uuid not null references profiles(id)`
- `session_id uuid not null references mission_control_sessions(id) on delete cascade`
- `title text not null`
- `description text null`
- `status text not null default 'not_started'`
- `priority text not null default 'high'`
- `due_date date null`
- `proof_required boolean not null default false`
- `proof_status text not null default 'not_needed'`
- `proof_notes text null`
- `reviewed_in_session_id uuid null references mission_control_sessions(id)`
- `carried_forward_from_commitment_id uuid null references mission_control_commitments(id)`
- `completed_at timestamptz null`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `(agency_id, status, due_date)`
- `(session_id)`
- `(reviewed_in_session_id)`

### 3. `mission_control_board_items`

Purpose:

- broader mission/deployment board for ongoing work

Columns:

- `id uuid primary key`
- `agency_id uuid not null references agencies(id)`
- `owner_user_id uuid not null references profiles(id)`
- `source_session_id uuid null references mission_control_sessions(id)`
- `source_commitment_id uuid null references mission_control_commitments(id)`
- `title text not null`
- `description text null`
- `column_status text not null default 'backlog'`
- `priority_level text not null default 'mid'`
- `severity_level text null`
- `proof_required boolean not null default false`
- `proof_status text not null default 'not_needed'`
- `column_order integer not null default 0`
- `completed_at timestamptz null`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `(agency_id, column_status, column_order)`
- `(owner_user_id)`

### 4. `mission_control_attachments`

Purpose:

- connect generic uploads to mission-control entities

Columns:

- `id uuid primary key`
- `agency_id uuid not null references agencies(id)`
- `owner_user_id uuid not null references profiles(id)`
- `upload_id uuid not null references uploads(id) on delete cascade`
- `session_id uuid null references mission_control_sessions(id) on delete cascade`
- `commitment_id uuid null references mission_control_commitments(id) on delete cascade`
- `board_item_id uuid null references mission_control_board_items(id) on delete cascade`
- `attachment_type text not null`
- `created_at timestamptz default now()`

Constraints:

- at least one of `session_id`, `commitment_id`, `board_item_id` must be present

### 5. Later: `mission_control_chat_threads` and `mission_control_chat_messages`

Do not ship this table set in the first deployment unless the page shell is already stable.

## Storage

Reuse the `uploads` bucket.

Path convention:

- `{agency_id}/mission-control/{session_id}/{filename}`
- `{agency_id}/mission-control/proof/{commitment_id}/{filename}`

Why:

- matches agency-scoped storage access patterns already used elsewhere
- keeps retrieval simple
- makes cleanup feasible

## Recommended File Changes

## Frontend

- `src/App.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/config/navigation.ts`
- `src/hooks/useSidebarAccess.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/admin/AdminOneOnOneClients.tsx`
- `src/pages/MissionControl.tsx` (new)
- `src/hooks/useMissionControlAccess.ts` (new)
- `src/hooks/useMissionControlOverview.ts` (new)
- `src/hooks/useMissionSessions.ts` (new)
- `src/hooks/useMissionCommitments.ts` (new)
- `src/hooks/useMissionBoard.ts` (new)
- `src/components/mission-control/*` (new)

## Backend

- `supabase/migrations/<timestamp>_mission_control_tables.sql`
- `supabase/migrations/<timestamp>_mission_control_rls.sql`
- `supabase/migrations/<timestamp>_mission_control_storage.sql` if needed

## Build Plan

## Phase 0: Access hardening

Goal:

- ensure only admins and true agency owners can see or hit this feature

Tasks:

1. add `requireTrueAgencyOwner` to `ProtectedRoute`
2. add `useMissionControlAccess`
3. add nav-level explicit true-owner gate
4. add `mission_control` to `AdminOneOnOneClients`
5. add feature-flag lookup hook if needed

Acceptance:

- owner + 1:1 + flag on: allowed
- owner + 1:1 + flag off: hidden/redirected
- key employee + 1:1 + flag on: denied
- manager/staff: denied
- admin: allowed

## Phase 1: Schema + RLS

Goal:

- persist sessions, commitments, board items, and attachments

Tasks:

1. create four new tables
2. add updated-at triggers
3. add completed-at triggers for board items/commitments where useful
4. add owner-only RLS
5. add admin override RLS

Acceptance:

- owner can CRUD own agency Mission Control rows
- key employee cannot select Mission Control rows
- admin can view/manage rows

## Phase 2: Page shell

Goal:

- ship a stable page even before AI

Tasks:

1. create `MissionControlPage`
2. add header, layout, loading, empty states
3. add summary cards:
   - next call
   - open commitments
   - overdue commitments
   - completed this month

Acceptance:

- page loads with no data
- page is mobile-safe and desktop-usable

## Phase 3: Session Memory

Goal:

- make each call reviewable and persistent

Tasks:

1. session list/timeline
2. latest session card
3. session detail drawer or route
4. transcript upload/view
5. key points/wins/issues display

Acceptance:

- owner can create a session manually
- owner can attach transcript/proof files
- past sessions are visible in order

## Phase 4: Commitment Tracker

Goal:

- capture next-call accountability cleanly

Tasks:

1. top-3 commitments panel
2. due date and status
3. proof notes + proof attachments
4. "reviewed on next call" action
5. carry-forward flow

Acceptance:

- incomplete commitments persist across sessions
- proof can be attached
- next session can mark each prior commitment as done/not done/carried

## Phase 5: Mission Board

Goal:

- support broader initiative tracking outside just top-three promises

Tasks:

1. kanban board
2. column drag/drop
3. convert commitment to board item
4. priority + severity display
5. completed history

Acceptance:

- board interaction is smooth
- order persists
- completed items are queryable

## Phase 6: Business Pulse

Goal:

- reduce reliance on separate qualitative forms

Tasks:

1. show current/previous `periods` snapshot
2. extract wins/stress/attack items from prior monthly form data
3. add Mission Control pulse editor
4. optionally keep writing to `periods` during transition

Acceptance:

- no loss of historical monthly context
- owner sees current pulse in Mission Control

## Phase 7: AI Mastermind

Goal:

- provide client-specific advisor chat grounded in real context

Tasks:

1. create chat thread/message tables
2. build retrieval context from:
   - sessions
   - commitments
   - board items
   - uploaded attachments metadata
3. create edge function for responses
4. add guardrails for owner-only data retrieval

Acceptance:

- answers cite recent session context
- no cross-agency leakage
- no generic ungrounded responses when context exists

## Testing Plan

## Frontend

- route access tests
- nav visibility tests
- page empty/loading/error states
- drag/drop persistence
- proof upload flows

## Backend

- RLS tests by persona:
  - admin
  - agency owner
  - key employee
  - manager
  - staff
- storage path validation
- feature-flag gating

## Manual QA matrix

1. 1:1 owner with feature enabled
2. 1:1 owner with feature disabled
3. boardroom owner with feature enabled
4. key employee in enabled agency
5. manager in enabled agency
6. admin user

Expected:

- only case 1 and 6 can fully use the feature

## Deployment Sequence

## Deploy 1: access + schema only

- add migrations
- add admin flag option
- do not surface nav item yet unless flag enabled

## Deploy 2: page shell

- page loads behind feature flag
- owner-only route enforced

## Deploy 3: sessions + commitments

- enable for one internal/pilot agency

## Deploy 4: board + attachments

- expand pilot

## Deploy 5: business pulse integration

- migrate away from separate 1:1 form entry where appropriate

## Deploy 6: AI mastermind

- only after enough historical session data exists to ground responses

## Go/No-Go Checklist

- true-owner frontend guard exists
- true-owner backend RLS exists
- key employee cannot see nav item
- key employee cannot deep-link into route
- key employee cannot query rows directly
- admin can support/debug
- pilot agency feature flag exists
- rollback plan documented

## Recommended First Ticket Breakdown

1. Access hardening + route guard
2. Mission Control schema + RLS
3. Mission Control page shell
4. Session Memory module
5. Commitment Tracker module
6. Mission Board module
7. Business Pulse integration
8. AI Mastermind
9. Pilot QA + rollout

## Recommendation

Do not start with AI.

Start with access hardening, then session memory, then commitments. Once the system has real history, the AI layer becomes valuable and much safer to ship.
