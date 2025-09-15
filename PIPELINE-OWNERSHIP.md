# Public Form Pipeline Ownership & Rollback Plan

## Current State
**Tag**: `v-public-form-pipeline-green`  
**Message**: "resolve_public_form rp-1.4 + submit_public_form normalization + safe finalize; 8 artifacts verified"

## Edge Function Ownership
**Primary Owner**: Development Team Lead  
**Secondary Owner**: Platform Engineer  

### Responsibilities
- No PR merges to main without:
  - Attaching all 8 verification artifacts OR
  - CI links proving artifact validation
- Monitor edge function logs daily
- Respond to P1 issues within 2 hours

## Gate Requirements (Required on Main)

### Gate A: DISK_SET == CONFIG_SET
- Validates function names in `/supabase/functions/*/index.ts` match `supabase/config.toml`
- **Failure Action**: Blocks deployment

### Gate B: Resolve Function Schema Test  
- Tests `resolve_public_form` returns 200 with required fields:
  - `form.schema`
  - `form.settings` 
  - `form.team_members`
  - `form.lead_sources`
- **Failure Action**: Blocks deployment

### Gate C: KPI Smoke Test
- Tests `submit_public_form` returns 200 + submission_id
- Validates payload normalization (unprefixed)
- Confirms metrics row creation with non-null version fields
- Checks null_violations=0 for current date
- **Failure Action**: Blocks deployment

## Nightly Monitoring
- **Schedule**: 02:00 UTC daily
- **Tests**: Same as Gates B & C
- **Auto-escalation**: Creates P1 issue on failure with:
  - Full test logs
  - Rollback instructions
  - Emergency contact information

## Emergency Rollback Plan

### Immediate Response (< 5 minutes)
```bash
# Deploy known good state immediately
git checkout v-public-form-pipeline-green
git push --force-with-lease origin main
```

### Rollback Triggers
- Any gate failure in production
- KPI data corruption detected
- Public form submission 500 errors > 5% in 10 minutes
- Dashboard showing incorrect metrics

### Post-Rollback Actions
1. Investigate root cause
2. Create hotfix branch from `v-public-form-pipeline-green`
3. Test all 8 artifacts before re-deployment
4. Document incident and prevention measures

## Customer Protection
- Diagnostics rendered only when `isAdmin && VITE_SHOW_DIAGNOSTICS===true`
- No console logs on public pages except errors
- Error messages sanitized for external users

## Monitoring Alerts
- Edge function error rate > 1%
- Response time > 2 seconds
- Database constraint violations
- Null metrics rows detected