# Metrics Auto-Feed Rollout Plan

## Goal
Replace manual daily scorecard entry for automatable metrics with a reliable, auditable pipeline that still preserves agency choice.

## Product Decisions
- Metrics remains canonical for targets, attainment, and summary scoring.
- Dashboard remains presentation-first; it does not become a second scoring engine.
- Call automation is opt-in at agency level via mode:
  - `off`: manual-only call metrics.
  - `shadow`: auto-calculated call metrics visible for validation, not canonical.
  - `on`: auto call metrics can feed canonical daily metrics.
- Role visibility:
  - Staff: only personal metrics and statuses.
  - Owner/Admin/Manager: team rollups plus individual drill-down.

## Scorecard Policy
- Transition period: keep scorecard form, but auto-fed fields are read-only.
- Correction path: owner/admin can apply audited adjustments with reason.
- End state: no daily form submission required for metrics that are fully auto-fed.

## Daily Timing Model (Agency Local Time)
- `8:00 AM`: soft close for prior day.
- `9:30 AM`: hard lock snapshot for prior day.
- `10:00 AM`: summary email sent from locked snapshot.

## Data Model
- Raw sources:
  - `call_events`, `call_metrics_daily` (RingCentral)
  - `metrics_daily` (manual scorecard + dashboard linked metrics)
- Phase 1 foundation:
  - `agencies.call_metrics_mode`
  - `metrics_daily_facts` (normalized per-user/day facts, manual + auto values, source/status)
  - `metrics_daily_snapshots` and `metrics_daily_snapshot_rows` (versioned lock snapshots)

## Phases
1. Phase 1: Foundation
- Add `call_metrics_mode` and normalized fact + snapshot scaffolding.
- Keep existing UI and summary behavior unchanged.

2. Phase 2: Canonical Read Path + API
- Shift summary generation to snapshot reads.
- Add owner/staff API paths for snapshot/fact status views.
 - API endpoint: `supabase/functions/get_metrics_snapshot`

3. Phase 3: Staff + Owner UI
- Staff My Metrics page with source/status badges.
- Owner Team Metrics page with exception queue and adjustment actions.

4. Phase 4: Scheduler + Email
- Implement soft close/hard lock jobs.
- Send 10:00 AM summary from locked snapshot.

5. Phase 5: Form Decommission
- Disable required manual input for `AutoLocked` metrics.
- Keep audited adjustment workflow.

## Acceptance Criteria
- Toggle off (`call_metrics_mode='off'`) means no call automation impact on canonical scoring.
- Staff cannot access team-level metrics data.
- Daily summary is deterministic and traceable to a locked snapshot version.
- Missing/partial call ingest is explicit (not silently treated as zero).
- Adjustments are auditable (who/when/why/before/after).
