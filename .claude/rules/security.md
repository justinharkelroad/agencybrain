---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "supabase/**/*"
---

# Security Rules

## CRITICAL: Row Level Security (RLS)

### Every Database Operation Must:
1. Use RLS-protected tables (all tables have RLS enabled)
2. Verify agency access with `has_agency_access()` function
3. Never bypass RLS with service role key client-side

### Agency Scoping Pattern
```sql
-- In RLS policy
CREATE POLICY "Users can only see their agency data"
ON table_name FOR SELECT
USING (agency_id = auth.jwt() ->> 'agency_id');
```

```typescript
// In edge function - validate access
const { data: hasAccess } = await supabase.rpc('has_agency_access', {
  p_agency_slug: agencySlug
});
if (!hasAccess) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
}
```

## JWT and Authentication

### Protected Endpoints
- Require valid JWT for user-specific data
- Configure `verify_jwt = true` in config.toml
- Extract user context from JWT, don't trust client input

### Public Endpoints (verify_jwt = false)
- Only for truly public data (public forms, health checks)
- Still validate input rigorously
- Never expose sensitive data

## Input Validation

### Always Validate:
```typescript
// Required parameters
if (!param || typeof param !== 'string') {
  return new Response(JSON.stringify({ error: 'Invalid parameter' }), { status: 400 });
}

// Slugs and identifiers
const slugRegex = /^[a-z0-9-]+$/;
if (!slugRegex.test(slug)) {
  return new Response(JSON.stringify({ error: 'Invalid slug format' }), { status: 400 });
}

// UUIDs
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

## Secrets and Environment Variables

### Never:
- Log secrets or API keys
- Include secrets in error messages
- Expose .env contents
- Commit credentials to git

### Always:
- Use `Deno.env.get()` for secrets in edge functions
- Use `import.meta.env.VITE_*` for client-safe vars only
- Treat SUPABASE_SERVICE_ROLE_KEY as highly sensitive

## Error Handling

### Safe Error Responses:
```typescript
// Good - generic message
return new Response(JSON.stringify({ error: 'Operation failed' }), { status: 500 });

// Bad - exposes internals
return new Response(JSON.stringify({ error: dbError.message }), { status: 500 });
```

### Logging:
```typescript
// Log details server-side for debugging
console.error('Operation failed:', { userId, operation, error: error.message });

// Return generic message to client
return new Response(JSON.stringify({ error: 'Operation failed' }), { status: 500 });
```

## Security Checklist
Before committing, verify:
- [ ] No secrets in code or logs
- [ ] RLS policies cover new tables/columns
- [ ] Agency scoping enforced
- [ ] Input validation implemented
- [ ] JWT verification configured correctly
- [ ] Error messages don't leak internals
