# Rollback Procedures

## Quick Rollback Commands

### Option 1: Rollback to Full Function Set (Recommended)
```bash
git checkout v-functions-restored
git push origin main --force-with-lease
```

### Option 2: Emergency Rollback (KPI Issues Only)
```bash
git checkout v-submit-public-form-hotfix  
git push origin main --force-with-lease
```

## When to Use Each Rollback

### Use `v-functions-restored` when:
- General edge function issues
- Non-KPI related problems
- Performance degradation
- New feature failures

### Use `v-submit-public-form-hotfix` when:
- KPI data corruption detected
- `null_violations > 0` in metrics_daily
- `preselected_kpi_*` keys appear in payload_json
- Missing `kpi_version_id` or `label_at_submit`

## Rollback Verification Steps

### After Rollback to `v-functions-restored`
1. **Function Count:** `ls -1 supabase/functions/*/index.ts | wc -l` should be 17
2. **Config Match:** Functions in `supabase/config.toml` match disk
3. **KPI Smoke:** Run smoke test, verify all checks pass
4. **Dashboard:** Verify metrics display correctly

### After Rollback to `v-submit-public-form-hotfix`  
1. **Function Count:** `ls -1 supabase/functions/*/index.ts | wc -l` should be 1
2. **Critical Function:** Only `submit_public_form` should be deployed
3. **KPI Priority:** Verify KPI normalization and data integrity
4. **Staged Recovery:** Follow Phase 3 procedure to restore functions

## Recovery After Rollback

### From `v-functions-restored`
1. Identify and fix the specific issue
2. Test locally
3. Deploy with gates enabled
4. Verify smoke tests pass

### From `v-submit-public-form-hotfix`
1. Fix KPI normalization issue
2. Follow Phase 3 batch restoration:
   - Batch 1: validate-invite, resolve_public_form
   - Batch 2: get_dashboard, get_member_month_snapshot  
   - Batch 3: explorer_search, explorer_feed, repair_explorer_data
   - Batch 4: list_agency_kpis, delete_kpi, recalc_metrics
   - Batch 5: scheduler_email
   - Batch 6: admin-* and analyze-performance
3. Verify gates pass after each batch
4. Tag new release when complete

## Emergency Contacts

- **KPI Issues:** Check Supabase logs immediately
- **Data Integrity:** Review `metrics_daily` table for corruption
- **Rollback Failure:** Verify git tags exist and are accessible

## Monitoring After Rollback

- **Immediate:** Check dashboard metrics populate correctly
- **1 Hour:** Verify no null violations in recent submissions  
- **24 Hours:** Confirm nightly smoke tests pass
- **1 Week:** Monitor for regression patterns

## Tags Reference

- `v-submit-public-form-hotfix`: KPI normalization locked, single function
- `v-functions-restored`: KPI normalization locked + full function set restored