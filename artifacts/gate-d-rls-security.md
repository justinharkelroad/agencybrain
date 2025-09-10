# Phase 2 - Gate D: RLS and Least Privilege

## Current vs Proposed RLS Policies

### 🔴 Current Policies (Too Permissive - Allow ALL operations)

```sql
-- kpis: Currently allows ALL (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Users can manage their agency KPIs" ON kpis FOR ALL 
USING (has_agency_access(auth.uid(), agency_id));

-- kpi_versions: Currently allows ALL operations  
CREATE POLICY "Users can manage their agency KPI versions" ON kpi_versions FOR ALL 
USING (EXISTS (SELECT 1 FROM kpis k WHERE k.id = kpi_versions.kpi_id AND has_agency_access(auth.uid(), k.agency_id)));

-- forms_kpi_bindings: Currently allows ALL operations
CREATE POLICY "Users can manage their agency form KPI bindings" ON forms_kpi_bindings FOR ALL 
USING (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = forms_kpi_bindings.form_template_id AND has_agency_access(auth.uid(), ft.agency_id)));

-- metrics_daily: Currently allows ALL operations
CREATE POLICY "Users can manage their agency metrics" ON metrics_daily FOR ALL 
USING (has_agency_access(auth.uid(), agency_id));
```

### 🟢 Proposed Policies (Least Privilege - READ ONLY for Dashboard)

```sql
-- kpis: Restrict to SELECT only for same-agency reads
DROP POLICY IF EXISTS "Users can manage their agency KPIs" ON kpis;
CREATE POLICY "Users can read their agency KPIs" ON kpis 
  FOR SELECT 
  USING (has_agency_access(auth.uid(), agency_id));

-- kpi_versions: Restrict to SELECT only for same-agency reads
DROP POLICY IF EXISTS "Users can manage their agency KPI versions" ON kpi_versions;
CREATE POLICY "Users can read their agency KPI versions" ON kpi_versions 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM kpis k 
    WHERE k.id = kpi_versions.kpi_id 
    AND has_agency_access(auth.uid(), k.agency_id)
  ));

-- forms_kpi_bindings: Restrict to SELECT only for same-agency reads  
DROP POLICY IF EXISTS "Users can manage their agency form KPI bindings" ON forms_kpi_bindings;
CREATE POLICY "Users can read their agency form KPI bindings" ON forms_kpi_bindings 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM form_templates ft 
    WHERE ft.id = forms_kpi_bindings.form_template_id 
    AND has_agency_access(auth.uid(), ft.agency_id)
  ));

-- metrics_daily: Restrict to SELECT only for same-agency reads
DROP POLICY IF EXISTS "Users can manage their agency metrics" ON metrics_daily;
CREATE POLICY "Users can read their agency metrics" ON metrics_daily 
  FOR SELECT 
  USING (has_agency_access(auth.uid(), agency_id));
```

## Function Security Analysis: get_versioned_dashboard_data

### Current Status: ✅ SECURITY INVOKER (Recommended)

```sql
-- Current function header (prosecdef: false = SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.get_versioned_dashboard_data(
  p_agency_slug text,
  p_role text,
  p_consolidate_versions boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER  -- ✅ Already correct
SET search_path = public
```

### 📋 Justification for SECURITY INVOKER (Current Approach)

**Why SECURITY INVOKER is preferred over SECURITY DEFINER:**

1. **Principle of Least Privilege**: Function runs with caller's privileges, not elevated system privileges
2. **Defense in Depth**: Explicit `has_agency_access()` check + RLS policies both enforced
3. **Audit Trail**: All data access attributed to actual calling user, not function owner
4. **Reduced Attack Surface**: No privilege escalation vector if function has vulnerabilities
5. **RLS Enforcement**: User's RLS policies are enforced during execution

**Current Security Controls:**
```sql
-- Explicit access check in function body
IF NOT has_agency_access(auth.uid(), agency_uuid) THEN
  RAISE EXCEPTION 'Access denied to agency data';
END IF;

-- + RLS policies on all queried tables (kpis, kpi_versions, etc.)
-- + Function runs as calling user (SECURITY INVOKER)
```

### ❌ Why NOT SECURITY DEFINER

SECURITY DEFINER would be **less secure** because:
- Function would run with owner privileges (bypassing user RLS)
- Removes defense-in-depth (relies only on explicit checks)
- Creates privilege escalation risk
- Harder to audit (actions appear as function owner, not real user)

## Gate D Recommendations

### ✅ Keep Current Function Security
- `get_versioned_dashboard_data` should remain **SECURITY INVOKER**
- Explicit access checks + RLS provide optimal security

### 🔄 Implement Least Privilege RLS
- Replace ALL policies with SELECT-only policies
- Maintain same-agency access restrictions
- Reduce attack surface for dashboard reads

### 🎯 Security Posture
- **Before**: Over-privileged (ALL operations allowed)
- **After**: Least privilege (READ-only for dashboard data)
- **Function**: Already secure with SECURITY INVOKER + explicit checks