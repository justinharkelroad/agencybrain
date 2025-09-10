# Gate G — Rollback Notes for Dashboard Fixes

## Emergency Rollback Procedures

### Database Rollback (HIGH PRIORITY)

If the new RPC function causes issues, rollback to the previous version:

```sql
-- ROLLBACK: Restore original function signature
CREATE OR REPLACE FUNCTION public.get_versioned_dashboard_data(
  p_agency_slug text,
  p_role text,
  p_consolidate_versions boolean DEFAULT false
)
RETURNS TABLE(
  metrics jsonb,
  tiles jsonb,
  contest jsonb[],
  table_data jsonb[]
) AS $$
BEGIN
  -- Original implementation with 7-day window logic
  -- This would need to be restored from previous migration
  RAISE EXCEPTION 'Rollback function needs previous implementation restored';
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

SELECT pg_notify('pgrst','reload schema');
```

### Frontend Rollback (MEDIUM PRIORITY)

Revert hook signature changes:

```typescript
// ROLLBACK: Original hook signature
export function useVersionedDashboardData(
  agencySlug: string,
  role: "Sales" | "Service",
  options: DashboardOptions = {}
) {
  return useQuery({
    queryKey: ["versioned-dashboard", agencySlug, role, options],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_versioned_dashboard_data', {
        p_agency_slug: agencySlug,
        p_role: role,
        p_consolidate_versions: options.consolidateVersions || false
      });
      // ... rest of original implementation
    }
  });
}

// ROLLBACK: Original dashboard component call
const { data: dashboardData } = useDashboardDataWithFallback(
  agencyProfile?.agencySlug || "",
  role,
  { consolidateVersions: false },
  selectedDate  // back to 4th parameter
);
```

### Risk Assessment

**Database Changes**: 
- **Risk Level**: HIGH
- **Impact**: Complete dashboard data loss if function fails
- **Recovery Time**: 5-10 minutes
- **Dependencies**: All dashboard views, reports, analytics

**Frontend Changes**:
- **Risk Level**: MEDIUM  
- **Impact**: Dashboard UI broken, empty states not working
- **Recovery Time**: 2-3 minutes
- **Dependencies**: MetricsDashboard component, related hooks

### Monitoring & Alerts

Watch for these error patterns after deployment:

1. **Database Errors**:
   ```
   ERROR: function get_versioned_dashboard_data does not exist
   ERROR: column "label_at_submit" does not exist
   ```

2. **Frontend Errors**:
   ```
   TypeError: Cannot read property 'map' of undefined
   Error: useDashboardDataWithFallback requires 4-5 parameters
   ```

3. **Performance Issues**:
   ```
   WARN: Query execution time > 5000ms
   ERROR: Connection timeout in dashboard data fetch
   ```

### Verification Steps Post-Rollback

1. **Test Dashboard Load**: Visit `/metrics` and verify data displays
2. **Test Date Picker**: Change dates and confirm results update
3. **Test Empty States**: Navigate to dates with no submissions
4. **Test Role Switch**: Toggle between Sales/Service roles
5. **Check Console**: Ensure no JavaScript errors in browser console

### Prevention for Future Updates

1. **Stage Testing**: Always test database changes in staging first
2. **Gradual Rollout**: Deploy to subset of users initially  
3. **Monitoring**: Set up alerts for dashboard page load failures
4. **Backup Plan**: Keep previous RPC function definitions in git history
5. **User Communication**: Notify users of maintenance windows for dashboard changes

### Contact Information

- **Database Issues**: Admin can access Supabase dashboard for RPC function management
- **Frontend Issues**: Check browser console and component error boundaries
- **Emergency**: Revert both database and frontend changes immediately if critical functionality fails

The rollback should restore the "last 7 days" behavior and remove empty state handling, returning to the previous phantom row behavior until a proper fix can be re-implemented.