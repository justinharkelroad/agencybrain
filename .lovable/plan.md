
# Fix: Staff Login Edge Function 404 Errors (Production)

## Problem Identified

Josh and Jason are intermittently getting "Unable to sign in. Please try again." errors on production (`myagencybrain.com/staff/login`). 

**Root Cause:** The Supabase edge function `staff_login` is returning **intermittent 404 errors** in production. When 404s occur, the `function_id` is `nil`, meaning Supabase's edge function router cannot locate the function.

Evidence from production logs:
- `POST | 404` with `function_id: nil` (function not found)
- Interspersed with `POST | 200` (successful logins)

This is causing the CORS/ERR_FAILED errors shown in your screenshot, because a 404 response from an edge function doesn't include proper CORS headers.

## Contributing Factor

There are TypeScript build errors in recently added edge functions that may be destabilizing the deployment:

```
TS18046: 'error' is of type 'unknown'
  at supabase/functions/ringcentral-oauth-init/index.ts:87
  at supabase/functions/ringcentral-sync-calls/index.ts:370
```

When edge functions fail to build, Supabase deployment can become unstable, causing intermittent 404s across all functions.

---

## Solution

### Step 1: Fix TypeScript Errors in RingCentral Functions

Both files have the same issue: accessing `.message` on an `unknown` type in catch blocks.

**File: `supabase/functions/ringcentral-oauth-init/index.ts`**
```typescript
// Line 85-91: Change from
} catch (error) {
  console.error("[ringcentral-oauth-init] Error:", error);
  return new Response(JSON.stringify({ error: error.message }), { ... });
}

// To
} catch (error) {
  console.error("[ringcentral-oauth-init] Error:", error);
  const message = error instanceof Error ? error.message : "Internal server error";
  return new Response(JSON.stringify({ error: message }), { ... });
}
```

**File: `supabase/functions/ringcentral-sync-calls/index.ts`**
```typescript
// Line 368-373: Change from
} catch (error) {
  console.error("[ringcentral-sync] Error:", error);
  return new Response(JSON.stringify({ error: error.message }), { ... });
}

// To
} catch (error) {
  console.error("[ringcentral-sync] Error:", error);
  const message = error instanceof Error ? error.message : "Internal server error";
  return new Response(JSON.stringify({ error: message }), { ... });
}
```

### Step 2: Redeploy Edge Functions

After fixing the build errors, the edge functions will be automatically redeployed. This should stabilize the routing and eliminate the 404s.

---

## Technical Details

| File | Change |
|------|--------|
| `supabase/functions/ringcentral-oauth-init/index.ts` | Fix TypeScript TS18046 error on line 87 |
| `supabase/functions/ringcentral-sync-calls/index.ts` | Fix TypeScript TS18046 error on line 370 |

**No changes needed to `staff_login` itself** - the function code is correct. The issue is deployment stability caused by build errors in other functions.

---

## Expected Outcome

After these fixes:
- Build will succeed without errors
- Edge functions will deploy cleanly
- `staff_login` will no longer return intermittent 404s
- Josh, Jason, and all staff users will be able to log in reliably
