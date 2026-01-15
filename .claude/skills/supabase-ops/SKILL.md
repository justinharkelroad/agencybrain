---
name: supabase-ops
description: Supabase operations specialist for AgencyBrain. Creates edge functions, migrations, RLS policies, and manages database operations. Use when working with Supabase, creating functions, writing migrations, or configuring security policies.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
model: sonnet
---

# AgencyBrain Supabase Operations

Expert Supabase operations for the AgencyBrain insurance platform. Handles edge functions, migrations, RLS policies, and database operations.

## Edge Functions

### Directory Structure
```
supabase/functions/
├── _shared/             # Shared utilities
│   └── cors.ts          # CORS headers
├── function_name/
│   └── index.ts         # Function entry point
```

### Create New Edge Function

1. Create directory and file:
```bash
mkdir -p supabase/functions/function_name
```

2. Use this template for `index.ts`:
```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with user's auth context
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' }
        }
      }
    );

    // Parse request
    const url = new URL(req.url);
    const param = url.searchParams.get('param');

    // Validate required parameters
    if (!param) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Business logic
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('column', param);

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Operation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

3. Register in `supabase/config.toml`:
```toml
[functions.function_name]
verify_jwt = true  # false for public endpoints
```

### JWT Configuration
- `verify_jwt = true`: Protected endpoints (user data, admin ops)
- `verify_jwt = false`: Public endpoints (public forms, health)

## Database Migrations

### Create Migration
```bash
# Generate timestamped migration file
supabase migration new migration_name
```

### Migration Template
```sql
-- Migration: Create new_table
-- Description: Purpose of this migration

-- Create table
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_new_table_agency_id ON new_table(agency_id);
CREATE INDEX idx_new_table_created_at ON new_table(created_at DESC);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own agency data"
ON new_table FOR SELECT
USING (agency_id = (auth.jwt() ->> 'agency_id')::UUID);

CREATE POLICY "Users can insert own agency data"
ON new_table FOR INSERT
WITH CHECK (agency_id = (auth.jwt() ->> 'agency_id')::UUID);

CREATE POLICY "Users can update own agency data"
ON new_table FOR UPDATE
USING (agency_id = (auth.jwt() ->> 'agency_id')::UUID);

CREATE POLICY "Users can delete own agency data"
ON new_table FOR DELETE
USING (agency_id = (auth.jwt() ->> 'agency_id')::UUID);

-- Update trigger for updated_at
CREATE TRIGGER update_new_table_updated_at
  BEFORE UPDATE ON new_table
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Run Migrations
```bash
supabase db push        # Push to remote
supabase migration list # List migrations
```

## Row Level Security (RLS)

### Agency Scoping Pattern
```sql
-- Standard agency-scoped policy
CREATE POLICY "policy_name"
ON table_name FOR operation
USING (agency_id = (auth.jwt() ->> 'agency_id')::UUID);

-- Using has_agency_access() function
CREATE POLICY "policy_name"
ON table_name FOR SELECT
USING (has_agency_access(agency_slug));
```

### Policy Types
- `FOR SELECT`: Read operations
- `FOR INSERT`: Create operations (use WITH CHECK)
- `FOR UPDATE`: Modify operations
- `FOR DELETE`: Remove operations
- `FOR ALL`: All operations

### Complete RLS Template
```sql
-- Enable RLS (required)
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- SELECT: Who can read
CREATE POLICY "table_select_policy"
ON table_name FOR SELECT
USING (agency_id = (auth.jwt() ->> 'agency_id')::UUID);

-- INSERT: Who can create (use WITH CHECK)
CREATE POLICY "table_insert_policy"
ON table_name FOR INSERT
WITH CHECK (agency_id = (auth.jwt() ->> 'agency_id')::UUID);

-- UPDATE: Who can modify
CREATE POLICY "table_update_policy"
ON table_name FOR UPDATE
USING (agency_id = (auth.jwt() ->> 'agency_id')::UUID);

-- DELETE: Who can remove
CREATE POLICY "table_delete_policy"
ON table_name FOR DELETE
USING (agency_id = (auth.jwt() ->> 'agency_id')::UUID);
```

## Common Operations

### Database Queries in Edge Functions
```typescript
// Using .from() for table operations
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('agency_id', agencyId);

// Using .rpc() for stored procedures
const { data, error } = await supabase.rpc('function_name', {
  p_param: value
});
```

### Performance Targets
- Dashboard queries: <150ms
- Form submissions: <5s
- Use indexes for frequent queries

## Security Checklist

Before deploying:
- [ ] RLS enabled on all tables
- [ ] Policies cover SELECT/INSERT/UPDATE/DELETE
- [ ] Agency scoping enforced
- [ ] JWT verification configured
- [ ] Input validation in edge functions
- [ ] No internal errors exposed to client
