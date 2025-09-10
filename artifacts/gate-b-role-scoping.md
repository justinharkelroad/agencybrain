# Phase 2 - Gate B: Role Scoping + Targets Alignment  

## 1. SQL Testing: Role-based KPI Filtering

### Sales Role KPIs
```sql
SELECT kpi_id, slug, label, active 
FROM list_agency_kpis_by_role('3c58f6f6-99cd-4c7d-97bc-3b16310ed4ba', 'Sales');
```

**Results:** 4 KPIs
- Outbound Calls (outbound_calls)
- Policies Sold (sold_items) 
- Quoted Households (quoted_count)
- Talk Minutes (talk_minutes)

### Service Role KPIs
```sql
SELECT kpi_id, slug, label, active 
FROM list_agency_kpis_by_role('3c58f6f6-99cd-4c7d-97bc-3b16310ed4ba', 'Service');
```

**Results:** 4 KPIs
- Cross-Sells Uncovered (cross_sells_uncovered)
- Mini Reviews (mini_reviews)
- Outbound Calls (outbound_calls)
- Talk Minutes (talk_minutes)

### Database Function Created
```sql
CREATE OR REPLACE FUNCTION public.list_agency_kpis_by_role(
  _agency uuid,
  _role text DEFAULT NULL
)
RETURNS TABLE(kpi_id uuid, slug text, label text, active boolean)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT DISTINCT k.id, k.key, v.label, k.is_active
  FROM kpis k
  JOIN kpi_versions v ON v.kpi_id = k.id
  WHERE k.agency_id = _agency 
    AND v.valid_to IS NULL 
    AND k.is_active = true
    AND (_role IS NULL OR k.key = ANY(
      SELECT unnest(selected_metrics) 
      FROM scorecard_rules 
      WHERE agency_id = _agency AND role::text = _role
    ))
  ORDER BY v.label;
$$;
```

## 2. Code Implementation: Role-based Preselect Mapping

### Hook Update (src/hooks/useKpis.ts:28-42)
```typescript
// New hook for direct RPC call to list_agency_kpis with optional role filtering
export function useAgencyKpis(agencyId: string, role?: string) {
  return useQuery({
    queryKey: ["agency-kpis", agencyId, role],
    enabled: !!agencyId,
    queryFn: async (): Promise<AgencyKPI[]> => {
      const { data, error } = await supabase.rpc('list_agency_kpis_by_role', {
        _agency: agencyId,
        _role: role || null
      });
      
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
}
```

### Form Builder Update (src/pages/ScorecardFormBuilder.tsx:155-156)
```typescript
// Load KPIs and scorecard rules with role filtering
const { data: agencyKpis = [], isLoading: kpisLoading, error: kpisError, refetch } = useAgencyKpis(agencyId, formSchema.role);
```

### Form Editor Update (src/pages/ScorecardFormEditor.tsx:105-106)
```typescript
// Load agency KPIs for dropdown - pass role from formSchema for filtering
const { data: agencyKpis = [] } = useAgencyKpis(agencyId, formSchema?.role);
```

## 3. Scorecard Rules Alignment

**Sales Role Metrics** (from scorecard_rules):
- [outbound_calls, talk_minutes, sold_items, quoted_count]

**Service Role Metrics** (from scorecard_rules):
- [outbound_calls, talk_minutes, cross_sells_uncovered, mini_reviews]

## Gate B Status: ✅ COMPLETE

**Achievements:**
- ✅ Created role-aware KPI listing function
- ✅ Sales vs Service returns different KPI sets (4 each, 2 unique to each role)
- ✅ Updated hooks to support role filtering
- ✅ Form builders now preselect role-appropriate KPIs
- ✅ Role-based mapping aligned with scorecard_rules configuration

## UI Verification: Role-Based Form Display

### Expected Behavior
- **Sales Forms**: Show 4 KPIs (Outbound Calls, Talk Minutes, Quoted Households, Policies Sold)
- **Service Forms**: Show 4 KPIs (Outbound Calls, Talk Minutes, Cross-Sells Uncovered, Mini Reviews)
- **Management Dialog**: Shows all KPIs (no role filter for admin management)

### Implementation Details
- `ScorecardFormBuilder`: Filters KPIs by `formSchema.role` 
- `ScorecardFormEditor`: Filters KPIs by `formSchema?.role`
- `KPIManagementDialog`: No role filter (admin sees all KPIs)

The role-based filtering is now active in the form builders, ensuring users only see relevant KPIs for their selected role type.