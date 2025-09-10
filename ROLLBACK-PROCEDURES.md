# Gate G: Rollback Procedures

## 🚨 Emergency Rollback Guide

This document provides step-by-step procedures to rollback changes made during Phase 2 (Gates A-F) if issues arise in production.

## 📋 Pre-Rollback Checklist

Before initiating any rollback:

1. **Document the Issue**: Record symptoms, error messages, and affected users
2. **Assess Impact**: Determine scope (single feature vs system-wide)
3. **Backup Current State**: Create database backup before rollback
4. **Notify Stakeholders**: Inform team of rollback initiation
5. **Prepare Communication**: Draft user communication if needed

## 🎯 Rollback Priority Order

**Critical Path**: Follow this order to minimize system disruption:

1. **Gate E** (Observability) - Safe to rollback, improves debugging
2. **Gate F** (Testing) - Safe to rollback, doesn't affect functionality  
3. **Gate C** (Performance) - Rollback indices carefully
4. **Gate D** (Security) - **DANGEROUS** - Coordinate with security team
5. **Gate B** (Role Scoping) - **DANGEROUS** - May expose cross-agency data
6. **Gate A** (KPI Versioning) - **DANGEROUS** - May cause data loss

---

## Gate E Rollback: Observability & Error Handling

**Risk Level**: 🟢 **LOW** - Safe to rollback, no data loss risk

### What to Rollback
- Structured logging in `submit_public_form`
- Friendly error responses  
- Timeout handling mechanisms
- Error correlation IDs

### Rollback Steps

#### 1. Revert Edge Function
```bash
# Navigate to the function
cd supabase/functions/submit_public_form/

# Revert to pre-Gate E version
git checkout HEAD~5 index.ts

# Or restore from backup
cp index.ts.backup index.ts

# Redeploy function
supabase functions deploy submit_public_form
```

#### 2. Remove Test Function
```sql
-- Remove test logging function
DROP FUNCTION IF EXISTS public.test_gate_e_logs();

-- Remove from config
-- Edit supabase/config.toml and remove:
-- [functions.test_gate_e_logs]
-- verify_jwt = false
```

#### 3. Verification
```bash
# Test form submission returns old error format
curl -X POST "$SUPABASE_URL/functions/v1/submit_public_form" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}' \
  | jq .

# Expected: Old error format (not structured JSON)
```

---

## Gate F Rollback: Testing & CI/CD

**Risk Level**: 🟢 **LOW** - Safe to rollback, no production impact

### What to Rollback  
- Test suite files
- CI/CD pipeline configuration
- Package.json test scripts
- GitHub Actions workflows

### Rollback Steps

#### 1. Remove Test Files
```bash
# Remove all test files
rm -rf src/tests/
rm -rf scripts/test-deployed-functions.js
rm -rf .github/workflows/ci.yml

# Remove test dependencies (if needed)
npm uninstall @testing-library/react @testing-library/jest-dom @vitest/coverage-v8
```

#### 2. Revert Package.json
```bash
# Restore original package.json (if backed up)
git checkout HEAD~10 package.json

# Or manually remove test scripts:
# - Remove all "test:*" scripts
# - Keep only: dev, build, lint, preview
```

#### 3. Verification
```bash
# Verify no test commands exist
npm run test 2>&1 | grep "Missing script"
# Should show error: Missing script: "test"

# Verify CI workflow removed
ls .github/workflows/
# Should not show ci.yml
```

---

## Gate C Rollback: Performance Optimization

**Risk Level**: 🟡 **MEDIUM** - Monitor performance after rollback

### What to Rollback
- Database indices
- Function optimizations
- Performance monitoring

### Rollback Steps

#### 1. Remove Performance Indices
```sql
-- Remove indices added in Gate C (run via Supabase SQL editor)
DROP INDEX IF EXISTS idx_kpis_agency_active;
DROP INDEX IF EXISTS idx_kpi_versions_kpi_valid;  
DROP INDEX IF EXISTS idx_forms_kpi_bindings_form_template;
DROP INDEX IF EXISTS idx_metrics_daily_member_date;
DROP INDEX IF EXISTS idx_form_templates_agency_status;

-- Verify indices removed
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('kpis', 'kpi_versions', 'forms_kpi_bindings', 'metrics_daily', 'form_templates')
ORDER BY indexname;
```

#### 2. Revert Function Changes
```sql
-- Restore original get_versioned_dashboard_data function
-- Copy from backup or git history before Gate C changes
-- This is complex - coordinate with DBA
```

#### 3. Verification & Monitoring
```bash
# Test dashboard performance (may be slower)
curl -X POST "$SUPABASE_URL/functions/v1/get_dashboard" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"agencySlug": "test-agency", "role": "Sales"}' \
  | jq .

# Monitor response times - expect >150ms after rollback
```

---

## Gate D Rollback: Security & RLS Policies

**Risk Level**: 🔴 **HIGH** - **COORDINATE WITH SECURITY TEAM**

### ⚠️ Security Warning
Rolling back RLS policies may expose cross-agency data. Proceed only with security team approval.

### What to Rollback
- RLS policy changes (ALL → SELECT restrictions)
- Function security mode changes
- Access control enhancements

### Rollback Steps

#### 1. Restore Original RLS Policies  
```sql
-- ⚠️ DANGER: This exposes write access - use extreme caution
-- Restore ALL operation policies

-- KPIs
DROP POLICY IF EXISTS "Users can read their agency KPIs" ON kpis;
CREATE POLICY "Users can manage their agency KPIs" ON kpis FOR ALL 
USING (has_agency_access(auth.uid(), agency_id));

-- KPI Versions  
DROP POLICY IF EXISTS "Users can read their agency KPI versions" ON kpi_versions;
CREATE POLICY "Users can manage their agency KPI versions" ON kpi_versions FOR ALL 
USING (EXISTS (SELECT 1 FROM kpis k WHERE k.id = kpi_versions.kpi_id AND has_agency_access(auth.uid(), k.agency_id)));

-- Forms KPI Bindings
DROP POLICY IF EXISTS "Users can read their agency form KPI bindings" ON forms_kpi_bindings;
CREATE POLICY "Users can manage their agency form KPI bindings" ON forms_kpi_bindings FOR ALL 
USING (EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = forms_kpi_bindings.form_template_id AND has_agency_access(auth.uid(), ft.agency_id)));

-- Metrics Daily
DROP POLICY IF EXISTS "Users can read their agency metrics" ON metrics_daily;
CREATE POLICY "Users can manage their agency metrics" ON metrics_daily FOR ALL 
USING (has_agency_access(auth.uid(), agency_id));
```

#### 2. Verification
```sql
-- Verify policies restored
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('kpis', 'kpi_versions', 'forms_kpi_bindings', 'metrics_daily')
ORDER BY tablename, policyname;

-- Ensure "FOR ALL" policies exist, not "FOR SELECT"
```

---

## Gate B Rollback: Role Scoping

**Risk Level**: 🔴 **HIGH** - **MAY EXPOSE CROSS-AGENCY DATA**

### ⚠️ Data Exposure Warning
Rolling back role scoping may allow users to see data from other agencies.

### What to Rollback
- Role-based data filtering
- Agency access control functions
- Cross-agency validation

### Rollback Steps

#### 1. Identify Agency Filter Removal
```sql
-- Locate functions with role-based filtering
-- This requires careful analysis of each function
-- DO NOT proceed without thorough testing

-- Example areas to check:
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_definition LIKE '%has_agency_access%'
ORDER BY routine_name;
```

#### 2. Coordinated Rollback
```bash
# This rollback requires:
# 1. Database administrator coordination
# 2. Security team approval
# 3. Staged rollback with testing
# 4. User communication about temporary access restrictions

# DO NOT attempt without proper coordination
echo "⚠️  COORDINATE WITH DBA AND SECURITY TEAM BEFORE PROCEEDING"
```

---

## Gate A Rollback: KPI Versioning & Data Integrity

**Risk Level**: 🔴 **CRITICAL** - **HIGH DATA LOSS RISK**

### ⚠️ Critical Data Loss Warning
Rolling back KPI versioning may cause **permanent data loss** of historical KPI labels and version tracking.

### What to Rollback
- KPI versioning tables (`kpi_versions`, `forms_kpi_bindings`)
- Enhanced metrics with version tracking
- Form-KPI relationship management

### Pre-Rollback Requirements

#### 1. Data Backup (MANDATORY)
```sql
-- Create backup tables BEFORE any rollback
CREATE TABLE kpi_versions_backup AS SELECT * FROM kpi_versions;
CREATE TABLE forms_kpi_bindings_backup AS SELECT * FROM forms_kpi_bindings;
CREATE TABLE metrics_daily_backup AS SELECT * FROM metrics_daily;

-- Verify backups
SELECT 'kpi_versions' as table_name, count(*) from kpi_versions_backup
UNION ALL
SELECT 'forms_kpi_bindings', count(*) from forms_kpi_bindings_backup  
UNION ALL
SELECT 'metrics_daily', count(*) from metrics_daily_backup;
```

#### 2. Impact Assessment
```sql
-- Assess data that will be lost
SELECT 
  'KPI versions to be lost' as impact_type,
  count(*) as count
FROM kpi_versions
WHERE valid_to IS NULL

UNION ALL

SELECT 
  'Form bindings to be lost',
  count(*)
FROM forms_kpi_bindings

UNION ALL

SELECT 
  'Metrics with version data',
  count(*)
FROM metrics_daily 
WHERE kpi_version_id IS NOT NULL;
```

### Rollback Steps (If Approved)

#### 1. Remove Versioning Tables
```sql
-- ⚠️ CRITICAL: This will permanently delete version history
-- Only proceed with explicit approval from data stakeholders

DROP TABLE IF EXISTS forms_kpi_bindings CASCADE;
DROP TABLE IF EXISTS kpi_versions CASCADE;

-- Remove version columns from metrics_daily
ALTER TABLE metrics_daily DROP COLUMN IF EXISTS kpi_version_id;
ALTER TABLE metrics_daily DROP COLUMN IF EXISTS label_at_submit;

-- Remove version tracking from form_templates
ALTER TABLE form_templates DROP COLUMN IF EXISTS form_kpi_version;
```

#### 2. Remove Triggers and Functions
```sql
-- Remove KPI version management triggers
DROP TRIGGER IF EXISTS create_kpi_version_on_label_change ON kpis;
DROP FUNCTION IF EXISTS create_kpi_version_on_label_change();

-- Remove version-aware functions
-- (This requires careful analysis of each function)
```

#### 3. Update Edge Functions
```bash
# Revert submit_public_form to pre-versioning logic
cd supabase/functions/submit_public_form/
git checkout HEAD~20 index.ts  # Adjust commit count as needed

# Remove version resolution logic
# Remove KPI binding lookups  
# Restore original metrics processing

supabase functions deploy submit_public_form
```

---

## 🔧 Emergency Procedures

### Immediate System Recovery

#### 1. Database Connection Issues
```bash
# Check Supabase status
curl https://status.supabase.com/

# Test database connectivity
psql "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres" -c "SELECT 1;"
```

#### 2. Edge Function Failures
```bash
# Redeploy all functions
supabase functions deploy

# Test function health
curl "$SUPABASE_URL/functions/v1/submit_public_form" \
  -X OPTIONS \
  -H "Origin: https://app.myagencybrain.com"
```

#### 3. Application Deployment Issues  
```bash
# Revert to last known good deployment
git log --oneline -10  # Find last stable commit
git checkout [stable-commit-hash]

# Redeploy via Lovable
# Visit project dashboard and republish
```

### Communication Templates

#### Internal Team Alert
```
🚨 ROLLBACK INITIATED: Gate [X] 

Issue: [Brief description]
Impact: [User/system impact]
ETA: [Expected resolution time]
Status: [In progress/Complete]

Next Update: [Time]
Contact: [Your name/contact]
```

#### User Communication
```
We're currently addressing a technical issue that may temporarily affect [specific functionality]. 

Our team is working to resolve this quickly. We expect normal service to resume within [timeframe].

We'll provide updates as we progress. Thank you for your patience.
```

---

## 📊 Post-Rollback Verification

### System Health Checks

#### 1. Core Functionality
```bash
# Test authentication
curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d '{"email": "test@example.com", "password": "test123"}'

# Test database access
# Run through main user workflows
```

#### 2. Performance Monitoring
```bash
# Monitor response times post-rollback
# Dashboard load times
# Form submission times  
# Database query performance
```

#### 3. Security Validation
```sql
-- Verify RLS policies active
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Test cross-agency access prevention
-- (Use test accounts from different agencies)
```

### Documentation Updates

#### 1. Incident Report
- **Issue Description**: What went wrong
- **Root Cause**: Why it happened  
- **Resolution**: What was rolled back
- **Prevention**: How to avoid in future
- **Timeline**: Key events and response times

#### 2. System State Documentation
- **Current Architecture**: Post-rollback state
- **Missing Features**: What functionality is lost
- **Recovery Plan**: How to re-implement safely
- **Monitoring**: What to watch for

---

## 🛡️ Prevention Strategies

### Future Rollback Prevention

#### 1. Staged Deployments
- **Dev Environment**: Test all changes thoroughly
- **Staging Environment**: Full production replica testing
- **Canary Deployment**: Gradual rollout with monitoring
- **Feature Flags**: Ability to disable features without deployment

#### 2. Enhanced Monitoring
- **Performance Metrics**: Automated alerting on degradation
- **Error Tracking**: Real-time error monitoring with thresholds
- **User Impact Monitoring**: Track user experience metrics
- **Database Health**: Query performance and connection monitoring

#### 3. Automated Testing
- **Pre-deployment Validation**: Comprehensive test suite
- **Performance Regression Testing**: Automated performance benchmarks
- **Security Testing**: Automated security policy validation
- **Integration Testing**: Cross-system functionality validation

#### 4. Backup & Recovery
- **Automated Backups**: Scheduled database and configuration backups
- **Point-in-time Recovery**: Ability to restore to specific timestamps
- **Configuration Versioning**: Track all infrastructure changes
- **Rollback Automation**: Scripted rollback procedures where possible

---

**Remember**: Always coordinate with stakeholders before initiating rollbacks, especially for Gates A, B, and D which have high data loss or security implications.

**Emergency Contact**: Ensure 24/7 access to database administrators and security team for critical rollbacks.

**Documentation**: Update this document after each incident to improve future response procedures.