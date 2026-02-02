# Supabase Query Runner

Use this skill to run queries against the AgencyBrain Supabase database for debugging and analytics.

## Quick Reference

### Connection
```bash
# Using Supabase CLI (preferred)
supabase db query "SELECT * FROM table LIMIT 10"

# Or via psql if SUPABASE_DB_URL is set
psql $SUPABASE_DB_URL -c "SELECT * FROM table LIMIT 10"
```

## Common Debug Queries

### Check recent submissions
```sql
SELECT id, team_member_id, work_date, final, created_at
FROM submissions
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

### Find staff user by email
```sql
SELECT su.id, su.email, su.team_member_id, tm.first_name, tm.last_name, a.name as agency
FROM staff_users su
LEFT JOIN team_members tm ON su.team_member_id = tm.id
LEFT JOIN agencies a ON su.agency_id = a.id
WHERE su.email ILIKE '%search_term%';
```

### Check active sessions
```sql
SELECT session_token, staff_user_id, created_at, expires_at
FROM staff_sessions
WHERE expires_at > NOW()
ORDER BY created_at DESC
LIMIT 10;
```

### Audit form submissions for a date range
```sql
SELECT
  s.work_date,
  tm.first_name || ' ' || tm.last_name as staff_name,
  ft.name as form_name,
  s.final,
  s.created_at
FROM submissions s
JOIN team_members tm ON s.team_member_id = tm.id
JOIN form_templates ft ON s.form_template_id = ft.id
WHERE s.work_date BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY s.work_date DESC, s.created_at DESC;
```

### Check RLS policies on a table
```sql
SELECT pol.polname, pol.polcmd, pg_get_expr(pol.polqual, pol.polrelid) as policy_expression
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'your_table_name';
```

### Find duplicate team members
```sql
SELECT email, first_name, last_name, COUNT(*)
FROM team_members
WHERE email IS NOT NULL
GROUP BY email, first_name, last_name
HAVING COUNT(*) > 1;
```

## Analytics Queries

### Daily active staff users (last 30 days)
```sql
SELECT
  DATE(created_at) as day,
  COUNT(DISTINCT staff_user_id) as active_users
FROM staff_sessions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

### Submissions by agency
```sql
SELECT
  a.name as agency,
  COUNT(s.id) as submission_count,
  COUNT(DISTINCT s.team_member_id) as unique_staff
FROM submissions s
JOIN team_members tm ON s.team_member_id = tm.id
JOIN agencies a ON tm.agency_id = a.id
WHERE s.work_date > NOW() - INTERVAL '30 days'
GROUP BY a.name
ORDER BY submission_count DESC;
```

## Safety Notes

- Always use LIMIT when exploring data
- Never run UPDATE/DELETE without WHERE clause
- Use transactions for multi-statement changes
- Prefer read-only queries for debugging
- RLS policies are enforced - use service role connection for admin queries
