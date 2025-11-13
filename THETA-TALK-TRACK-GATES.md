# THETA TALK TRACK - GATED IMPLEMENTATION PLAN

## Overview

**Project**: Theta Talk Track - Public AI-powered personalized 21-minute theta brainwave audio track generator  
**Methodology**: Gate-based development with artifact proof checkpoints  
**Stack**: React, Supabase, OpenAI GPT-4, ElevenLabs TTS, FFmpeg/Tone.js

---

## GATE 0 - Foundation & Database Schema

### Status: 🔴 NOT STARTED

### Scope
1. Create 5 database tables with proper indexes  
2. Implement RLS policies for public access  
3. Create Supabase Storage bucket for audio files  
4. Implement session tracking for anonymous users  
5. Create Zustand state management store

### Pass Criteria

#### ✅ Database Tables Created  
**SQL Check:**  
```sql
-- Verify all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'theta_targets',
  'theta_affirmations', 
  'theta_voice_tracks',
  'theta_final_tracks',
  'theta_track_leads'
);
-- Expected: 5 rows returned
```

#### ✅ Indexes Exist  
**SQL Check:**  
```sql
SELECT tablename, indexname FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename LIKE 'theta_%'
ORDER BY tablename, indexname;
-- Expected: Minimum 8 indexes across all tables
```

#### ✅ RLS Policies Active  
**SQL Check:**  
```sql
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename LIKE 'theta_%'
ORDER BY tablename, policyname;
-- Expected: Minimum 3 policies per table (INSERT, SELECT, UPDATE)
```

#### ✅ Storage Bucket Exists  
**Supabase Dashboard Check:**  
- Navigate to Storage → Buckets  
- Verify `theta-audio-tracks` bucket exists  
- Verify public access enabled  
- Verify MIME types: `audio/mpeg`, `audio/wav`, `audio/mp3`

#### ✅ State Management Working  
**Browser Console Check:**  
```javascript
// In browser console after visiting any theta page
window.__ZUSTAND_DEVTOOLS_STORE__
// Should show theta track store with initial state
```

### Artifacts Required

**File: `artifacts/gate-0-database-schema.md`**

```markdown
# Gate 0 - Database Schema - ARTIFACTS

## Migration SQL
[Full SQL migration code]

## Table Definitions
### theta_targets
- Columns: id, user_id, session_id, faith, family, fitness, finance, created_at, updated_at
- Indexes: idx_theta_targets_user, idx_theta_targets_session

### theta_affirmations
[Full schema]

### theta_voice_tracks
[Full schema]

### theta_final_tracks
[Full schema]

### theta_track_leads
[Full schema]

## RLS Policies
### theta_targets
- Policy 1: "Public can create targets" - INSERT - CHECK(true)
- Policy 2: "Users can view own by session" - SELECT - session_id match
- Policy 3: "Users can update own" - UPDATE - session_id match

[All policies for all tables]

## Post-Migration Verification

### Table Count Check
```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'theta_%';
```
**Result**: 5 ✅

### Index Verification
```sql
SELECT tablename, indexname FROM pg_indexes 
WHERE schemaname = 'public' AND tablename LIKE 'theta_%';
```
**Result**: [List all 8+ indexes] ✅

### RLS Status
```sql
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'theta_%';
```
**Result**: All show rowsecurity = true ✅

### Storage Bucket
- Screenshot of Supabase Storage showing theta-audio-tracks bucket
- Screenshot of bucket settings showing public access enabled

## State Store Test
```typescript
// Test code to verify store initialization
import { useThetaStore } from '@/lib/thetaTrackStore';
const store = useThetaStore.getState();
console.log('Session ID:', store.sessionId); // Should be UUID
console.log('Targets:', store.targets); // Should be empty object
```

**Console Output**: [Paste actual output] ✅
```

---

## GATE 1 - Public Routing & Navigation

### Status: 🔴 NOT STARTED

### Scope
1. Create public routes in App.tsx (no auth required)  
2. Implement ThetaNavHeader with smart back button  
3. Add Theta Talk Track to sidebar navigation  
4. Create landing page (ThetaDashboard)  
5. Implement session ID generation and persistence

### Pass Criteria

#### ✅ Public Routes Accessible  
**Browser Test:**  
```
1. Open browser in incognito mode
2. Navigate to: http://localhost:8080/theta-talk-track
3. Verify: Page loads without redirect to /auth
4. Verify: ThetaNavHeader visible with "Back to Dashboard" button
5. Navigate to: /theta-talk-track/targets
6. Verify: Page loads without authentication
```

#### ✅ Back Button Logic Working  
**Test Scenario 1 (Not Logged In):**  
```
1. Open incognito tab
2. Go to /theta-talk-track
3. Click "Back to Dashboard" button
4. Expected: Navigate to /auth
```

**Test Scenario 2 (Logged In):**  
```
1. Log in as user
2. Go to /theta-talk-track
3. Click "Back to Dashboard" button
4. Expected: Navigate to /dashboard
```

#### ✅ Sidebar Navigation Added  
**UI Check:**  
```
1. Log in to app
2. Open sidebar
3. Verify: "Theta Talk Track" appears under "Actions" section
4. Verify: Music icon (♪) displayed
5. Click link
6. Expected: Navigate to /theta-talk-track
```

#### ✅ Session Persistence Working  
**localStorage Check:**  
```javascript
// In browser console
localStorage.getItem('theta_session_id')
// Expected: UUID string that persists across page refreshes
```

#### ✅ Landing Page Rendering  
**Visual Check:**  
- Header shows "Theta Talk Track"  
- Hero section with T³ branding visible  
- 4-step process cards displayed  
- "How It Works" section visible  
- "Why Theta Waves" section visible  
- All content responsive on mobile

### Artifacts Required

**File: `artifacts/gate-1-routing-navigation.md`**

```markdown
# Gate 1 - Routing & Navigation - ARTIFACTS

## Routes Added
### App.tsx Changes
```diff
+ <Route path="/theta-talk-track" element={<ThetaDashboard />} />
+ <Route path="/theta-talk-track/targets" element={<ThetaTargets />} />
+ <Route path="/theta-talk-track/affirmations" element={<ThetaAffirmations />} />
+ <Route path="/theta-talk-track/voice-studio" element={<ThetaVoiceStudio />} />
+ <Route path="/theta-talk-track/composer" element={<ThetaComposer />} />
```

## ThetaNavHeader Component
```typescript
// Full component code with smart navigation logic
const ThetaNavHeader = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const handleBack = () => {
    navigate(user ? '/dashboard' : '/auth');
  };
  
  return (
    <div className="border-b border-border bg-background/95">
      <Button onClick={handleBack}>
        <ArrowLeft /> Back to Dashboard
      </Button>
    </div>
  );
};
```

## Sidebar Integration
### AppSidebar.tsx Changes
```diff
+ <SidebarMenuItem>
+   <SidebarMenuButton asChild>
+     <Link to="/theta-talk-track">
+       <Music className="h-4 w-4" />
+       <span>Theta Talk Track</span>
+     </Link>
+   </SidebarMenuButton>
+ </SidebarMenuItem>
```

## Session ID Hook
```typescript
// src/hooks/useThetaSession.ts
export const useThetaSession = () => {
  const [sessionId, setSessionId] = useState<string>(() => {
    const existing = localStorage.getItem('theta_session_id');
    if (existing) return existing;
    
    const newId = crypto.randomUUID();
    localStorage.setItem('theta_session_id', newId);
    return newId;
  });
  
  return sessionId;
};
```

## Verification Tests

### Public Access Test (Incognito)
1. Open: http://localhost:8080/theta-talk-track  
2. Result: ✅ Page loads without /auth redirect  
3. Screenshot: [Landing page in incognito mode]

### Back Button Test (Not Logged In)
1. Click "Back to Dashboard" while logged out  
2. Result: ✅ Navigates to /auth  
3. Network tab shows: Navigation to /auth

### Back Button Test (Logged In)
1. Log in as test user  
2. Go to /theta-talk-track  
3. Click "Back to Dashboard"  
4. Result: ✅ Navigates to /dashboard  
5. Network tab shows: Navigation to /dashboard

### Sidebar Navigation Test
1. Log in and open sidebar  
2. Result: ✅ "Theta Talk Track" visible under Actions  
3. Screenshot: [Sidebar with new menu item]

### Session Persistence Test
```javascript
// Console output
localStorage.getItem('theta_session_id')
// "550e8400-e29b-41d4-a716-446655440000" ✅

// Refresh page
localStorage.getItem('theta_session_id')
// "550e8400-e29b-41d4-a716-446655440000" ✅ (same ID)
```

### Landing Page Responsive Test
- Desktop (1920px): ✅ 4-column grid layout  
- Tablet (768px): ✅ 2-column grid layout  
- Mobile (375px): ✅ Single column stack  
- Screenshots: [Desktop, Tablet, Mobile views]
```

---

## GATE 2 - Targets Input (Step 1)

### Status: 🔴 NOT STARTED

### Scope
1. Create ThetaTargets page with 4 category cards  
2. Implement TargetModal for input  
3. Create useThetaTargets hook for database persistence  
4. Implement real-time save with optimistic updates  
5. Add progress tracking and validation

### Pass Criteria

#### ✅ Database Insert Working  
**SQL Verification:**  
```sql
-- After user saves a target via UI
SELECT session_id, faith, family, fitness, finance, created_at, updated_at
FROM theta_targets
WHERE session_id = '[test_session_id]';
-- Expected: 1 row with non-null values for filled categories
```

#### ✅ Upsert Logic Preventing Duplicates  
**Test Scenario:**  
```
1. Open targets page
2. Set Faith goal: "Complete 75 Bible studies"
3. Save
4. Verify database has 1 row
5. Go back to targets page
6. Edit Faith goal: "Complete 90 Bible studies"
7. Save
8. Verify database still has only 1 row (upserted, not inserted)
```

**SQL Check:**  
```sql
SELECT COUNT(*) FROM theta_targets WHERE session_id = '[test_session_id]';
-- Expected: 1 (not 2)
```

#### ✅ UI State Persistence  
**Test Scenario:**  
```
1. Set all 4 targets
2. Save each
3. Navigate away to /theta-talk-track
4. Navigate back to /theta-talk-track/targets
5. Verify: All 4 targets still displayed with saved values
```

#### ✅ Validation Working  
**Test Cases:**  
```
1. Open modal, try to save with < 10 chars
   Expected: Error message "Goal must be at least 10 characters"
2. Open modal, enter 500 chars
   Expected: Saves successfully
3. Open modal, enter only whitespace
   Expected: Error message
```

#### ✅ Progress Tracking  
**UI Check:**  
```
1. No targets set: "Continue with 0 Goals" button visible
2. Set 1 target: "Continue with 1 Goal" button updates
3. Set all 4 targets: "Continue with 4 Goals" button + checkmarks on all cards
```

### Artifacts Required

**File: `artifacts/gate-2-targets-input.md`**

```markdown
# Gate 2 - Targets Input - ARTIFACTS

## Component Implementation

### ThetaTargets.tsx
```typescript
// Full component code
const ThetaTargets = () => {
  const { targets, setTargets } = useThetaStore();
  const { saveTarget } = useThetaTargets();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // ... component logic
};
```

### TargetModal.tsx
```typescript
// Full modal component with validation
const TargetModal = ({ category, value, onSave, onClose }) => {
  const [text, setText] = useState(value);
  const [error, setError] = useState('');
  
  const handleSave = () => {
    if (text.trim().length < 10) {
      setError('Goal must be at least 10 characters');
      return;
    }
    onSave(text);
  };
  
  // ... modal JSX
};
```

### useThetaTargets Hook
```typescript
// src/hooks/useThetaTargets.ts
export const useThetaTargets = () => {
  const sessionId = useThetaSession();
  const { user } = useAuth();
  
  const saveTarget = async (category: string, value: string) => {
    const { data, error } = await supabase
      .from('theta_targets')
      .upsert({
        user_id: user?.id || null,
        session_id: sessionId,
        [category]: value,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'session_id'
      });
    
    if (error) throw error;
    return data;
  };
  
  // ... other methods
};
```

## Database Verification

### Initial State (Empty)
```sql
SELECT * FROM theta_targets WHERE session_id = 'test-session-123';
```
**Result**: 0 rows ✅

### After First Target Saved (Faith)
```sql
SELECT session_id, faith, family, fitness, finance, created_at
FROM theta_targets 
WHERE session_id = 'test-session-123';
```
**Result**:
| session_id       | faith                         | family | fitness | finance | created_at          |
|------------------|-------------------------------|--------|---------|---------|---------------------|
| test-session-123 | "Complete 75 Bible studies"   | NULL   | NULL    | NULL    | 2024-01-15 10:30:00 |

✅

### After All Targets Saved
```sql
SELECT session_id, faith, family, fitness, finance
FROM theta_targets 
WHERE session_id = 'test-session-123';
```
**Result**:
| session_id       | faith                         | family                 | fitness           | finance           |
|------------------|-------------------------------|------------------------|-------------------|-------------------|
| test-session-123 | "Complete 75 Bible studies"   | "12 date nights with spouse" | "Weigh under 210lbs" | "Add 5 new clients" |

✅

### Upsert Test (No Duplicate Rows)
```sql
-- After editing Faith target twice
SELECT COUNT(*) as row_count FROM theta_targets WHERE session_id = 'test-session-123';
```
**Result**: row_count = 1 ✅ (not 2 or 3)

## UI Test Results

### Validation Test 1: Too Short
- Input: "Pray"  
- Expected Error: "Goal must be at least 10 characters"  
- Result: ✅ Error displayed, save disabled

### Validation Test 2: Whitespace Only
- Input: "          "  
- Expected Error: "Goal must be at least 10 characters"  
- Result: ✅ Error displayed after trim

### Validation Test 3: Valid Input
- Input: "Complete 75 Bible study sessions in next 90 days"  
- Expected: Save successful, modal closes  
- Result: ✅ Saved to DB, UI updates

### Progress Tracking Test
- 0 targets: Button shows "Continue with 0 Goals" ✅  
- 1 target: Button shows "Continue with 1 Goal" ✅  
- 4 targets: Button shows "Continue with 4 Goals" ✅  
- All cards show green checkmarks when filled ✅

### State Persistence Test
1. Set all 4 targets ✅  
2. Navigate to dashboard ✅  
3. Return to /theta-talk-track/targets ✅  
4. All values still displayed ✅  
5. Database query confirms data persisted ✅

## Screenshots
- [Empty targets page]  
- [Target modal open for "Faith"]  
- [All 4 targets filled with checkmarks]  
- [Progress button showing "Continue with 4 Goals"]
```

---

## GATE 3 - AI Affirmations (Step 2)

### Status: 🔴 NOT STARTED

### Scope
1. Create ThetaAffirmations page with tone selection  
2. Implement OpenAI edge function for generation  
3. Build approval interface with edit/regenerate  
4. Add structured logging for observability  
5. Implement error handling and retry logic

### Pass Criteria

#### ✅ OpenAI Edge Function Deployed  
**cURL Test:**  
```bash
curl -X POST 'https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/generate-affirmations' \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "targets": {
      "faith": "Complete 75 Bible studies",
      "finance": "Add 5 new clients"
    },
    "tone": "empowering",
    "sessionId": "test-session-123"
  }'
```

**Expected Response:**  
```json
{
  "success": true,
  "affirmations": {
    "faith": [
      "I am committed to deepening my spiritual practice through 75 Bible studies",
      "I have the discipline to complete my faith journey",
      // ... 4 more
    ],
    "finance": [
      "I am a magnet for high-quality clients who value my expertise",
      // ... 5 more
    ]
  },
  "count": 12,
  "requestId": "req_abc123"
}
```

#### ✅ Database Persistence After Generation  
**SQL Check:**  
```sql
SELECT category, text, tone, approved, order_index
FROM theta_affirmations
WHERE session_id = 'test-session-123'
ORDER BY category, order_index;
-- Expected: 12 rows (6 per category)
```

#### ✅ Structured Logging Working  
**Supabase Edge Function Logs:**  
```json
{
  "timestamp": "2024-01-15T10:45:23.123Z",
  "level": "info",
  "event_type": "affirmation_generation_start",
  "session_id": "test-session-123",
  "request_id": "req_abc123",
  "tone": "empowering",
  "target_count": 2
}

{
  "timestamp": "2024-01-15T10:45:28.456Z",
  "level": "info",
  "event_type": "affirmation_generation_success",
  "session_id": "test-session-123",
  "request_id": "req_abc123",
  "generated_count": 12,
  "duration_ms": 5333
}
```

#### ✅ Approval Toggle Working  
**Test Scenario:**  
```
1. Generate affirmations
2. Click "Approve" on first affirmation
3. Verify: Green checkmark appears, border turns green
4. Check database: approved = true
5. Click "Approve" again to toggle off
6. Verify: Checkmark disappears, approved = false in DB
```

**SQL Verification:**  
```sql
-- After toggling approval
SELECT id, text, approved 
FROM theta_affirmations 
WHERE session_id = 'test-session-123' 
LIMIT 3;
```

#### ✅ Edit Functionality Working  
**Test Scenario:**  
```
1. Click edit icon on affirmation
2. Modify text: "I am wealthy" → "I am abundantly wealthy"
3. Save
4. Verify: Updated text displayed
5. Verify: "edited" badge appears
6. Check database: edited = true
```

**SQL Check:**  
```sql
SELECT text, edited FROM theta_affirmations WHERE id = '[edited-id]';
-- Expected: New text + edited = true
```

#### ✅ Regenerate Individual Working  
**Test Scenario:**  
```
1. Click regenerate icon on single affirmation
2. Verify: Loading state appears
3. Verify: New affirmation replaces old one
4. Verify: Database updated with new text
5. Verify: approved reset to false
```

#### ✅ Error Handling Working  
**Test Cases:**  
```
1. Simulate network failure (offline mode)
   Expected: "Generation failed. Please check your connection." + Retry button
2. Simulate OpenAI rate limit (mock 429 response)
   Expected: "Service busy. Please wait 30 seconds and retry."
3. Simulate invalid API key
   Expected: "Configuration error. Please contact support."
```

### Artifacts Required

**File: `artifacts/gate-3-affirmations-ai.md`**

```markdown
# Gate 3 - AI Affirmations - ARTIFACTS

## Edge Function Implementation

### generate-affirmations/index.ts
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4'

// Structured logging helper
const logStructured = (level: string, eventType: string, data: any) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event_type: eventType,
    ...data
  }));
};

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const { targets, tone, sessionId } = await req.json();
    
    logStructured('info', 'affirmation_generation_start', {
      session_id: sessionId,
      request_id: requestId,
      tone,
      target_count: Object.keys(targets).filter(k => targets[k]).length
    });
    
    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
    
    const prompt = `Generate 6 powerful affirmations for each life area based on these 90-day goals. Use ${tone} tone.
    
Faith: ${targets.faith || 'N/A'}
Family: ${targets.family || 'N/A'}
Fitness: ${targets.fitness || 'N/A'}
Finance: ${targets.finance || 'N/A'}

Requirements:
- Each affirmation must be in first person present tense
- Start with "I am", "I have", or "I create"
- Be specific to the stated goals
- ${tone} style language
- 15-25 words each
- Emotionally resonant

Return as JSON: { faith: [...], family: [...], fitness: [...], finance: [...] }
Only include categories that have goals.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
    });
    
    const affirmations = JSON.parse(response.choices[0].message.content);
    
    // Save to database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    let totalCount = 0;
    for (const [category, texts] of Object.entries(affirmations)) {
      for (const [index, text] of (texts as string[]).entries()) {
        await supabase.from('theta_affirmations').insert({
          session_id: sessionId,
          category,
          text,
          tone,
          order_index: index,
          approved: false,
        });
        totalCount++;
      }
    }
    
    const duration = Date.now() - startTime;
    
    logStructured('info', 'affirmation_generation_success', {
      session_id: sessionId,
      request_id: requestId,
      generated_count: totalCount,
      duration_ms: duration
    });
    
    return new Response(JSON.stringify({
      success: true,
      affirmations,
      count: totalCount,
      requestId
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logStructured('error', 'affirmation_generation_failed', {
      request_id: requestId,
      error: error.message,
      duration_ms: duration
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      requestId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

## cURL Test Results

### Successful Generation
```bash
curl -X POST 'https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/generate-affirmations' \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "targets": {
      "faith": "Complete 75 Bible studies in 90 days",
      "finance": "Add 5 high-value clients"
    },
    "tone": "empowering",
    "sessionId": "test-session-456"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "affirmations": {
    "faith": [
      "I am committed to deepening my spiritual journey through 75 transformative Bible studies",
      "I have the unwavering discipline to complete my sacred 90-day faith practice",
      "I create sacred time daily to connect with divine wisdom through scripture",
      "I am growing spiritually stronger with each Bible study I complete",
      "I have clarity and focus to absorb profound spiritual truths consistently",
      "I am transforming my faith into action through dedicated scripture study"
    ],
    "finance": [
      "I am a magnet for high-value clients who recognize and appreciate my expertise",
      "I have the confidence and skills to attract 5 premium clients in 90 days",
      "I create exceptional value that draws ideal clients to my business naturally",
      "I am worthy of serving high-caliber clients who pay premium rates",
      "I have a thriving pipeline of quality prospects converting into loyal clients",
      "I am building a profitable business by serving clients at the highest level"
    ]
  },
  "count": 12,
  "requestId": "req_7f2e9c8d"
}
```
✅ **Pass**

## Database Verification

### Before Generation
```sql
SELECT COUNT(*) FROM theta_affirmations WHERE session_id = 'test-session-456';
```
**Result**: 0 ✅

### After Generation
```sql
SELECT category, text, tone, approved, order_index
FROM theta_affirmations
WHERE session_id = 'test-session-456'
ORDER BY category, order_index;
```

**Result**: 12 rows ✅  
| category | text | tone | approved | order_index |  
|----------|------|------|----------|-------------|  
| faith | "I am committed to deepening my spiritual..." | empowering | false | 0 |  
| faith | "I have the unwavering discipline..." | empowering | false | 1 |  
| ... | ... | ... | false | ... |  
| finance | "I am a magnet for high-value clients..." | empowering | false | 0 |  
| finance | "I have the confidence and skills..." | empowering | false | 1 |  
[12 rows total]

### After Approval Toggle
```sql
-- User approved 3 affirmations via UI
SELECT COUNT(*) FROM theta_affirmations 
WHERE session_id = 'test-session-456' AND approved = true;
```
**Result**: 3 ✅

### After Edit
```sql
-- User edited one affirmation
SELECT text, edited FROM theta_affirmations 
WHERE session_id = 'test-session-456' AND edited = true;
```
**Result**:  
| text | edited |  
|------|--------|  
| "I am abundantly wealthy and attract premium clients effortlessly" | true |  
✅

## Edge Function Logs

### Successful Generation Log Sequence
```json
{
  "timestamp": "2024-01-15T14:22:10.123Z",
  "level": "info",
  "event_type": "affirmation_generation_start",
  "session_id": "test-session-456",
  "request_id": "req_7f2e9c8d",
  "tone": "empowering",
  "target_count": 2
}

{
  "timestamp": "2024-01-15T14:22:15.789Z",
  "level": "info",
  "event_type": "affirmation_generation_success",
  "session_id": "test-session-456",
  "request_id": "req_7f2e9c8d",
  "generated_count": 12,
  "duration_ms": 5666
}
```
✅ **Structured logs working**

### Error Handling Log (Network Failure)
```json
{
  "timestamp": "2024-01-15T14:25:33.456Z",
  "level": "error",
  "event_type": "affirmation_generation_failed",
  "request_id": "req_8a3f1b2c",
  "error": "OpenAI API request failed: Network timeout",
  "duration_ms": 30000
}
```
✅ **Error logging working**

## UI Test Results

### Tone Selection Test
1. Load affirmations page ✅  
2. See 4 tone cards: Empowering, Gentle, Analytical, Spiritual ✅  
3. Click "Empowering" ✅  
4. Verify: Green border, checkmark appears ✅  
5. Verify: "Generate My Affirmations" button enabled ✅

### Generation Loading State Test
1. Click "Generate My Affirmations" ✅  
2. Verify: Full-screen loading overlay appears ✅  
3. Verify: Animated spinner visible ✅  
4. Verify: Message rotates: "Analyzing your targets..." → "Crafting personalized affirmations..." ✅  
5. Wait for completion (5-8 seconds) ✅  
6. Verify: Loading disappears, affirmations displayed ✅

### Approval Interface Test
1. 12 affirmations displayed (6 faith, 6 finance) ✅  
2. Counter shows "0/12 Approved" ✅  
3. Click "Approve" on first affirmation ✅  
4. Verify: Green checkmark, green border ✅  
5. Counter updates to "1/12 Approved" ✅  
6. Click "Approve All" button ✅  
7. All 12 turn green, counter shows "12/12 Approved" ✅

### Edit Test
1. Hover over affirmation, click edit icon ✅  
2. Textarea appears with current text ✅  
3. Edit text: Add word "abundantly" ✅  
4. Click "Save" ✅  
5. Verify: Updated text displayed ✅  
6. Verify: Blue "edited" badge appears ✅  
7. Database confirms edited = true ✅

### Regenerate Single Test
1. Click regenerate icon on one affirmation ✅  
2. Verify: Loading spinner on that card only ✅  
3. New affirmation appears (different text) ✅  
4. Verify: Approval reset (no checkmark) ✅

### Error Handling Tests

**Network Failure:**  
1. Turn off network connection ✅  
2. Click "Generate My Affirmations" ✅  
3. Verify: Error toast appears ✅  
4. Message: "Generation failed. Please check your connection." ✅  
5. Verify: "Retry" button visible ✅

**OpenAI Rate Limit (Simulated):**  
1. Trigger rate limit (multiple rapid requests) ✅  
2. Verify: Error message: "Service busy. Please wait and retry." ✅

## Performance Metrics
- Average generation time: 5.2 seconds ✅  
- OpenAI API latency: 4.8 seconds ✅  
- Database insert time: 0.3 seconds ✅  
- Total user wait time: 5.5 seconds ✅

## Screenshots
- [Tone selection interface with 4 cards]  
- [Loading state with spinner and messages]  
- [12 affirmations displayed in approval interface]  
- [Single affirmation in edit mode]  
- [All affirmations approved with green checkmarks]  
- [Error state with retry button]
```

---

## GATE 4 - Voice Studio (Step 3)

### Status: 🔴 NOT STARTED

### Scope
1. Create ThetaVoiceStudio page with voice selection  
2. Implement ElevenLabs edge function for TTS  
3. Upload generated audio to Supabase Storage  
4. Build audio player with waveform visualization  
5. Add performance monitoring and timeout handling

### Pass Criteria

#### ✅ ElevenLabs Edge Function Deployed  
**cURL Test:**  
```bash
curl -X POST 'https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/generate-voice-track' \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "affirmations": [
      {"text": "I am wealthy", "category": "finance"},
      {"text": "I am healthy", "category": "fitness"}
    ],
    "voice": "male",
    "sessionId": "test-session-789"
  }'
```

**Expected Response:**  
```json
{
  "success": true,
  "audioUrl": "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/theta-audio-tracks/voice-tracks/voice-test-session-789-1705329123456.mp3",
  "durationSeconds": 45,
  "fileSizeBytes": 720000,
  "requestId": "req_voice_abc123"
}
```

#### ✅ Audio File Uploaded to Storage  
**Supabase Storage Check:**  
```
1. Navigate to Storage → theta-audio-tracks → voice-tracks/
2. Verify file exists: voice-test-session-789-[timestamp].mp3
3. Verify file size > 0 bytes
4. Verify public URL accessible (click and plays)
```

#### ✅ Database Record Created  
**SQL Check:**  
```sql
SELECT id, session_id, voice_type, audio_url, duration_seconds, file_size_bytes
FROM theta_voice_tracks
WHERE session_id = 'test-session-789';
-- Expected: 1 row with non-null audio_url
```

#### ✅ Audio Playback Working  
**Browser Test:**  
```
1. Complete affirmations step
2. Navigate to voice studio
3. Select "Male Voice"
4. Click "Generate Voice Track"
5. Wait for generation (30-60 seconds)
6. Verify: Audio player appears
7. Click play button
8. Verify: Audio plays with affirmations spoken
9. Verify: Waveform animates during playback
```

#### ✅ Voice Quality Test  
**Manual Listening Check:**  
```
1. Generate track with male voice
2. Listen to full track
3. Verify: Clear pronunciation
4. Verify: Natural pacing with pauses
5. Verify: No clipping or distortion
6. Generate track with female voice
7. Verify: Same quality standards
```

#### ✅ Timeout Handling  
**Test Case:**  
```
1. Simulate slow ElevenLabs API (mock 90-second response)
2. Verify: Timeout occurs at 60 seconds
3. Verify: Error message: "Voice generation timed out. Please try again."
4. Verify: Retry button appears
```

### Artifacts Required

**File: `artifacts/gate-4-voice-generation.md`**

```markdown
# Gate 4 - Voice Generation - ARTIFACTS

## Edge Function Implementation

### generate-voice-track/index.ts
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ElevenLabsClient } from 'https://esm.sh/@11labs/client@0'

const TIMEOUT_MS = 60000; // 60 second timeout

const logStructured = (level: string, eventType: string, data: any) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event_type: eventType,
    ...data
  }));
};

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const { affirmations, voice, sessionId } = await req.json();
    
    logStructured('info', 'voice_generation_start', {
      session_id: sessionId,
      request_id: requestId,
      voice_type: voice,
      affirmation_count: affirmations.length
    });
    
    // Join affirmations with pauses
    const script = affirmations
      .map((a: any) => a.text)
      .join('... ... ... '); // 3-second pause between affirmations
    
    const elevenLabs = new ElevenLabsClient({
      apiKey: Deno.env.get('ELEVENLABS_API_KEY')
    });
    
    const voiceId = voice === 'male' 
      ? 'pNInz6obpgDQGcFmaJgB' // Adam
      : '21m00Tcm4TlvDq8ikWAM'; // Rachel
    
    // Generate speech with timeout
    const audioPromise = elevenLabs.textToSpeech.convert({
      voice_id: voiceId,
      text: script,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      }
    });
    
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Voice generation timeout')), TIMEOUT_MS)
    );
    
    const audioStream = await Promise.race([audioPromise, timeoutPromise]);
    
    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = new Uint8Array(
      chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    );
    let offset = 0;
    for (const chunk of chunks) {
      audioBuffer.set(chunk, offset);
      offset += chunk.length;
    }
    
    logStructured('info', 'voice_generation_complete', {
      session_id: sessionId,
      request_id: requestId,
      file_size_bytes: audioBuffer.length,
      duration_ms: Date.now() - startTime
    });
    
    // Upload to Supabase Storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const fileName = `voice-${sessionId}-${Date.now()}.mp3`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('theta-audio-tracks')
      .upload(`voice-tracks/${fileName}`, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      });
    
    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
    
    const publicUrl = supabase.storage
      .from('theta-audio-tracks')
      .getPublicUrl(`voice-tracks/${fileName}`).data.publicUrl;
    
    logStructured('info', 'voice_upload_complete', {
      session_id: sessionId,
      request_id: requestId,
      audio_url: publicUrl
    });
    
    // Save to database
    const { data: dbData, error: dbError } = await supabase
      .from('theta_voice_tracks')
      .insert({
        session_id: sessionId,
        voice_type: voice,
        audio_url: publicUrl,
        file_size_bytes: audioBuffer.length
      })
      .select()
      .single();
    
    if (dbError) {
      throw new Error(`Database insert failed: ${dbError.message}`);
    }
    
    const totalDuration = Date.now() - startTime;
    
    logStructured('info', 'voice_generation_success', {
      session_id: sessionId,
      request_id: requestId,
      total_duration_ms: totalDuration
    });
    
    return new Response(JSON.stringify({
      success: true,
      audioUrl: publicUrl,
      fileSizeBytes: audioBuffer.length,
      requestId
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logStructured('error', 'voice_generation_failed', {
      request_id: requestId,
      error: error.message,
      duration_ms: duration
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      requestId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

## cURL Test Results

### Successful Voice Generation
```bash
curl -X POST 'https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/generate-voice-track' \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "affirmations": [
      {"text": "I am wealthy and abundant", "category": "finance"},
      {"text": "I am healthy and strong", "category": "fitness"}
    ],
    "voice": "male",
    "sessionId": "test-session-789"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "audioUrl": "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/theta-audio-tracks/voice-tracks/voice-test-session-789-1705329876543.mp3",
  "fileSizeBytes": 720000,
  "requestId": "req_voice_9d4e2a1b"
}
```
✅ **Pass**

## Storage Verification

### Supabase Storage Check
**Path**: Storage → theta-audio-tracks → voice-tracks/

**File Found**: voice-test-session-789-1705329876543.mp3  
**File Size**: 720,000 bytes (703 KB) ✅  
**Public URL**: Accessible and plays audio ✅  
**Duration**: ~45 seconds ✅

**Screenshot**: [Storage bucket showing uploaded file]

## Database Verification

### Before Generation
```sql
SELECT COUNT(*) FROM theta_voice_tracks WHERE session_id = 'test-session-789';
```
**Result**: 0 ✅

### After Generation
```sql
SELECT id, session_id, voice_type, audio_url, file_size_bytes, created_at
FROM theta_voice_tracks
WHERE session_id = 'test-session-789';
```

**Result**: 1 row ✅  
| id           | session_id       | voice_type | audio_url | file_size_bytes | created_at          |  
|--------------|------------------|------------|-----------|-----------------|---------------------|  
| uuid-abc-123 | test-session-789 | male       | https://wjqy...voice-test-session-789...mp3 | 720000 | 2024-01-15 15:44:36 |

## Edge Function Logs

### Successful Generation Log Sequence
```json
{
  "timestamp": "2024-01-15T15:44:10.123Z",
  "level": "info",
  "event_type": "voice_generation_start",
  "session_id": "test-session-789",
  "request_id": "req_voice_9d4e2a1b",
  "voice_type": "male",
  "affirmation_count": 2
}

{
  "timestamp": "2024-01-15T15:44:32.456Z",
  "level": "info",
  "event_type": "voice_generation_complete",
  "session_id": "test-session-789",
  "request_id": "req_voice_9d4e2a1b",
  "file_size_bytes": 720000,
  "duration_ms": 22333
}

{
  "timestamp": "2024-01-15T15:44:34.789Z",
  "level": "info",
  "event_type": "voice_upload_complete",
  "session_id": "test-session-789",
  "request_id": "req_voice_9d4e2a1b",
  "audio_url": "https://wjqy...voice-test-session-789...mp3"
}

{
  "timestamp": "2024-01-15T15:44:36.012Z",
  "level": "info",
  "event_type": "voice_generation_success",
  "session_id": "test-session-789",
  "request_id": "req_voice_9d4e2a1b",
  "total_duration_ms": 25889
}
```
✅ **Structured logging working**

### Timeout Test Log
```json
{
  "timestamp": "2024-01-15T15:50:15.123Z",
  "level": "error",
  "event_type": "voice_generation_failed",
  "request_id": "req_voice_timeout_1",
  "error": "Voice generation timeout",
  "duration_ms": 60000
}
```
✅ **Timeout handling working**

## UI Test Results

### Voice Selection Test
1. Navigate to voice studio page ✅  
2. See 2 voice cards: Male Voice, Female Voice ✅  
3. Each card has sample audio play button ✅  
4. Click play on Male Voice sample ✅  
5. Verify: Sample audio plays (3-5 seconds) ✅  
6. Select "Male Voice" radio button ✅  
7. Verify: "Generate Voice Track" button enabled ✅

### Generation Flow Test
1. Click "Generate Voice Track" ✅  
2. Verify: Full-screen loading overlay appears ✅  
3. Verify: Messages cycle:  
   - "Converting text to speech..." ✅  
   - "Processing 12 affirmations..." ✅  
   - "Applying voice settings..." ✅  
4. Wait for completion (25-35 seconds) ✅  
5. Verify: Loading disappears ✅  
6. Verify: Audio player appears ✅

### Audio Playback Test
1. Audio player visible with controls ✅  
2. Waveform visualization displayed ✅  
3. Duration shown: "0:45" ✅  
4. Click play button ✅  
5. Verify: Audio plays clearly ✅  
6. Verify: Waveform animates during playback ✅  
7. Verify: Affirmations audible with pauses between ✅  
8. Click pause ✅  
9. Verify: Playback pauses ✅  
10. Seek to middle of track ✅  
11. Verify: Playback resumes from seek position ✅

### Voice Quality Manual Test

**Male Voice:**  
- Pronunciation: Clear ✅  
- Pacing: Natural with appropriate pauses ✅  
- Tone: Confident and authoritative ✅  
- Volume: Consistent throughout ✅  
- No artifacts or clipping ✅

**Female Voice:**  
- Pronunciation: Clear ✅  
- Pacing: Natural with appropriate pauses ✅  
- Tone: Warm and soothing ✅  
- Volume: Consistent throughout ✅  
- No artifacts or clipping ✅

### Regenerate Test
1. Click "Regenerate" button ✅  
2. Confirm regeneration ✅  
3. New loading state appears ✅  
4. New audio generated with same text ✅  
5. Database updated with new file ✅  
6. Old file still exists in storage (not deleted) ✅

### Error Handling Tests

**Timeout Scenario:**  
1. Simulate 90-second ElevenLabs delay ✅  
2. Verify: Timeout at 60 seconds ✅  
3. Error message: "Voice generation timed out. Please try again." ✅  
4. Retry button visible ✅

**Network Failure:**  
1. Disconnect network during generation ✅  
2. Error message: "Voice generation failed. Check your connection." ✅  
3. Retry button visible ✅

## Performance Metrics
- Average generation time: 26 seconds ✅  
- ElevenLabs API latency: 22 seconds ✅  
- Storage upload time: 2.3 seconds ✅  
- Database insert time: 1.6 seconds ✅  
- Total user wait time: 27 seconds ✅

## Cost Analysis
- ElevenLabs cost per track: ~$0.30 ✅  
- Average character count: 1,800 characters ✅  
- Storage cost: ~$0.0001 per file ✅  
- Total cost per voice track: ~$0.30 ✅

## Screenshots
- [Voice selection interface with 2 cards]  
- [Loading state during generation]  
- [Audio player with waveform visualization]  
- [Playback in progress with animated waveform]
```

---

## GATE 5 - Binaural Composer (Step 4)

### Status: 🔴 NOT STARTED

### Scope
1. Create ThetaComposer page with 3-layer visualization  
2. Implement FFmpeg-based audio mixing edge function  
3. Generate 21-minute final track with binaural beats  
4. Add progress tracking and real-time status updates  
5. Implement download preparation

### Pass Criteria

#### ✅ Composer Edge Function Deployed  
**cURL Test:**  
```bash
curl -X POST 'https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/compose-final-track' \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "voiceTrackUrl": "https://wjqy...voice-track.mp3",
    "sessionId": "test-session-999"
  }'
```

**Expected Response:**  
```json
{
  "success": true,
  "audioUrl": "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/theta-audio-tracks/final-tracks/final-test-session-999-1705330123456.mp3",
  "durationSeconds": 1260,
  "fileSizeBytes": 20160000,
  "requestId": "req_compose_xyz789"
}
```

#### ✅ Final Track Duration Verification  
**Audio File Check:**  
```
1. Download final track from storage URL
2. Open in audio player (VLC, Audacity, etc.)
3. Verify duration: Exactly 21:00 (1260 seconds)
4. Verify file size: 18-22 MB range
```

#### ✅ Binaural Beat Verification  
**Audacity Spectrum Analysis:**  
```
1. Open final track in Audacity
2. Select 10-second sample from middle
3. Analyze → Plot Spectrum
4. Verify LEFT channel: Peak at 200 Hz
5. Verify RIGHT channel: Peak at 207 Hz
6. Verify difference: 7 Hz (theta frequency)
```

#### ✅ Voice Track Integration  
**Listening Test:**  
```
1. Play final track from 0:00
2. Verify: 30-second fade-in of binaural beats only
3. At 0:30: Voice affirmations begin
4. Verify: Voice loops continuously until 19:50
5. At 19:50: Voice fades out over 10 seconds
6. At 20:00 - 21:00: Binaural beats only (fade-out)
```

#### ✅ Database Record Complete  
**SQL Check:**  
```sql
SELECT id, session_id, voice_track_id, audio_url, duration_seconds, file_size_bytes, created_at
FROM theta_final_tracks
WHERE session_id = 'test-session-999';
-- Expected: 1 row with audio_url, duration_seconds = 1260
```

#### ✅ Audio Quality Check  
**Manual Listening:**  
```
1. Listen to full 21-minute track
2. Verify: No clipping or distortion
3. Verify: Smooth voice-to-binaural transitions
4. Verify: Consistent volume throughout
5. Verify: Voice clearly audible over binaural base
```

### Artifacts Required

**File: `artifacts/gate-5-binaural-composer.md`**

```markdown
# Gate 5 - Binaural Composer - ARTIFACTS

## Edge Function Implementation

### compose-final-track/index.ts
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TIMEOUT_MS = 180000; // 3 minute timeout for audio processing

const logStructured = (level: string, eventType: string, data: any) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event_type: eventType,
    ...data
  }));
};

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const { voiceTrackUrl, sessionId } = await req.json();
    
    logStructured('info', 'composition_start', {
      session_id: sessionId,
      request_id: requestId,
      voice_track_url: voiceTrackUrl
    });
    
    // Download voice track
    logStructured('info', 'downloading_voice_track', {
      session_id: sessionId,
      request_id: requestId
    });
    
    const voiceResponse = await fetch(voiceTrackUrl);
    const voiceBuffer = await voiceResponse.arrayBuffer();
    await Deno.writeFile('/tmp/voice.mp3', new Uint8Array(voiceBuffer));
    
    logStructured('info', 'voice_download_complete', {
      session_id: sessionId,
      request_id: requestId,
      file_size_bytes: voiceBuffer.byteLength
    });
    
    // Generate binaural beats and mix with FFmpeg
    logStructured('info', 'generating_binaural_mix', {
      session_id: sessionId,
      request_id: requestId
    });
    
    const command = new Deno.Command('ffmpeg', {
      args: [
        '-f', 'lavfi', '-i', 'sine=frequency=200:duration=1260', // Left: 200 Hz
        '-f', 'lavfi', '-i', 'sine=frequency=207:duration=1260', // Right: 207 Hz (7Hz diff)
        '-i', '/tmp/voice.mp3', // Voice track
        '-filter_complex', `
          [0:a]volume=0.1[binaural_left];
          [1:a]volume=0.1[binaural_right];
          [binaural_left][binaural_right]amerge=inputs=2,pan=stereo|c0<c0|c1<c1,
          afade=t=in:st=0:d=30:curve=log,afade=t=out:st=1230:d=30:curve=log[base];
          [2:a]adelay=30000|30000,afade=t=in:st=0:d=2:curve=log,
          afade=t=out:st=1250:d=10:curve=log,aloop=loop=-1:size=2e+09,
          atrim=duration=1260[voice_loop];
          [base][voice_loop]amix=inputs=2:duration=longest:dropout_transition=2[final]
        `,
        '-map', '[final]',
        '-ac', '2',
        '-b:a', '192k',
        '-y',
        '/tmp/final.mp3'
      ],
    });
    
    const { code, stderr } = await command.output();
    
    if (code !== 0) {
      const errorMsg = new TextDecoder().decode(stderr);
      throw new Error(`FFmpeg processing failed: ${errorMsg}`);
    }
    
    logStructured('info', 'binaural_mix_complete', {
      session_id: sessionId,
      request_id: requestId,
      duration_ms: Date.now() - startTime
    });
    
    // Upload final track
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const finalBuffer = await Deno.readFile('/tmp/final.mp3');
    const fileName = `final-${sessionId}-${Date.now()}.mp3`;
    
    logStructured('info', 'uploading_final_track', {
      session_id: sessionId,
      request_id: requestId,
      file_size_bytes: finalBuffer.length
    });
    
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('theta-audio-tracks')
      .upload(`final-tracks/${fileName}`, finalBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      });
    
    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
    
    const publicUrl = supabase.storage
      .from('theta-audio-tracks')
      .getPublicUrl(`final-tracks/${fileName}`).data.publicUrl;
    
    logStructured('info', 'upload_complete', {
      session_id: sessionId,
      request_id: requestId,
      audio_url: publicUrl
    });
    
    // Save to database
    const { data: dbData, error: dbError } = await supabase
      .from('theta_final_tracks')
      .insert({
        session_id: sessionId,
        audio_url: publicUrl,
        duration_seconds: 1260,
        file_size_bytes: finalBuffer.length
      })
      .select()
      .single();
    
    if (dbError) {
      throw new Error(`Database insert failed: ${dbError.message}`);
    }
    
    // Clean up temp files
    await Deno.remove('/tmp/voice.mp3');
    await Deno.remove('/tmp/final.mp3');
    
    const totalDuration = Date.now() - startTime;
    
    logStructured('info', 'composition_success', {
      session_id: sessionId,
      request_id: requestId,
      total_duration_ms: totalDuration
    });
    
    return new Response(JSON.stringify({
      success: true,
      audioUrl: publicUrl,
      durationSeconds: 1260,
      fileSizeBytes: finalBuffer.length,
      requestId
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logStructured('error', 'composition_failed', {
      request_id: requestId,
      error: error.message,
      duration_ms: duration
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      requestId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

## cURL Test Results

### Successful Composition
```bash
curl -X POST 'https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/compose-final-track' \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "voiceTrackUrl": "https://wjqy...voice-test-session-789...mp3",
    "sessionId": "test-session-999"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "audioUrl": "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/theta-audio-tracks/final-tracks/final-test-session-999-1705331234567.mp3",
  "durationSeconds": 1260,
  "fileSizeBytes": 20160000,
  "requestId": "req_compose_5f8a3b2c"
}
```
✅ **Pass**

## Audio File Verification

### Duration Check
**Tool**: VLC Media Player  
**File**: final-test-session-999-1705331234567.mp3  
**Duration**: 21:00 (1260 seconds) ✅  
**File Size**: 20,160,000 bytes (19.2 MB) ✅  
**Bitrate**: 192 kbps ✅  
**Sample Rate**: 44.1 kHz ✅  
**Channels**: 2 (Stereo) ✅

**Screenshot**: [VLC showing 21:00 duration]

### Binaural Beat Spectrum Analysis
**Tool**: Audacity  
**Sample**: 10 seconds from 5:00-5:10

**Left Channel Spectrum:**  
- Peak frequency: 200 Hz ✅  
- Amplitude: -10 dB ✅

**Right Channel Spectrum:**  
- Peak frequency: 207 Hz ✅  
- Amplitude: -10 dB ✅

**Frequency Difference**: 7 Hz (Theta range) ✅

**Screenshots**:  
- [Left channel spectrum showing 200 Hz peak]  
- [Right channel spectrum showing 207 Hz peak]

### Voice Integration Timeline Test

**0:00 - 0:30 (Fade-in):**  
- Binaural beats only ✅  
- Volume gradually increases ✅  
- No voice present ✅

**0:30 - 19:50 (Main content):**  
- Voice affirmations audible ✅  
- Binaural beats continue underneath ✅  
- Voice loops seamlessly ✅  
- No gaps or silence ✅

**19:50 - 20:00 (Voice fade-out):**  
- Voice volume decreases gradually ✅  
- Binaural beats continue ✅

**20:00 - 21:00 (Ending):**  
- Binaural beats only ✅  
- Volume gradually decreases ✅  
- Smooth fade to silence ✅

**Waveform Screenshot**: [Full 21-minute waveform in Audacity showing structure]

## Database Verification

### Before Composition
```sql
SELECT COUNT(*) FROM theta_final_tracks WHERE session_id = 'test-session-999';
```
**Result**: 0 ✅

### After Composition
```sql
SELECT id, session_id, audio_url, duration_seconds, file_size_bytes, created_at
FROM theta_final_tracks
WHERE session_id = 'test-session-999';
```

**Result**: 1 row ✅  
| id             | session_id       | audio_url | duration_seconds | file_size_bytes | created_at          |  
|----------------|------------------|-----------|------------------|-----------------|---------------------|  
| uuid-final-123 | test-session-999 | https://wjqy...final-test-session-999...mp3 | 1260 | 20160000 | 2024-01-15 16:10:34 |

## Edge Function Logs

### Successful Composition Log Sequence
```json
{
  "timestamp": "2024-01-15T16:08:10.123Z",
  "level": "info",
  "event_type": "composition_start",
  "session_id": "test-session-999",
  "request_id": "req_compose_5f8a3b2c",
  "voice_track_url": "https://wjqy...voice-test-session-789...mp3"
}

{
  "timestamp": "2024-01-15T16:08:12.456Z",
  "level": "info",
  "event_type": "downloading_voice_track",
  "session_id": "test-session-999",
  "request_id": "req_compose_5f8a3b2c"
}

{
  "timestamp": "2024-01-15T16:08:15.789Z",
  "level": "info",
  "event_type": "voice_download_complete",
  "session_id": "test-session-999",
  "request_id": "req_compose_5f8a3b2c",
  "file_size_bytes": 720000
}

{
  "timestamp": "2024-01-15T16:08:16.012Z",
  "level": "info",
  "event_type": "generating_binaural_mix",
  "session_id": "test-session-999",
  "request_id": "req_compose_5f8a3b2c"
}

{
  "timestamp": "2024-01-15T16:10:22.345Z",
  "level": "info",
  "event_type": "binaural_mix_complete",
  "session_id": "test-session-999",
  "request_id": "req_compose_5f8a3b2c",
  "duration_ms": 126333
}

{
  "timestamp": "2024-01-15T16:10:23.678Z",
  "level": "info",
  "event_type": "uploading_final_track",
  "session_id": "test-session-999",
  "request_id": "req_compose_5f8a3b2c",
  "file_size_bytes": 20160000
}

{
  "timestamp": "2024-01-15T16:10:32.901Z",
  "level": "info",
  "event_type": "upload_complete",
  "session_id": "test-session-999",
  "request_id": "req_compose_5f8a3b2c",
  "audio_url": "https://wjqy...final-test-session-999...mp3"
}

{
  "timestamp": "2024-01-15T16:10:34.234Z",
  "level": "info",
  "event_type": "composition_success",
  "session_id": "test-session-999",
  "request_id": "req_compose_5f8a3b2c",
  "total_duration_ms": 144111
}
```
✅ **Structured logging working**

## UI Test Results

### Composer Page Load
1. Navigate to /theta-talk-track/composer ✅  
2. See "Your Track Structure" section ✅  
3. 3-layer visualization displayed:  
   - Layer 1: Background (21 min, binaural beats) ✅  
   - Layer 2: Voice Affirmations (0:30-19:50) ✅  
   - Layer 3: Fade In/Out (30 sec each) ✅  
4. Total duration: "21:00 minutes" prominently shown ✅

### How to Use Section
1. "How to Use Your Theta Track" visible ✅  
2. Headphone icon displayed ✅  
3. 4 instruction bullets:  
   - "Listen twice daily" ✅  
   - "Use headphones" ✅  
   - "Relaxed state" ✅  
   - "Stay consistent" ✅

### Generation Flow
1. Click "Generate Complete Track" button ✅  
2. Full-screen loading overlay appears ✅  
3. Messages cycle:  
   - "Generating binaural beat base..." ✅  
   - "Mixing voice with theta waves..." ✅  
   - "Creating 21-minute master track..." ✅  
   - "Finalizing your track..." ✅  
4. Progress bar shows incremental progress ✅  
5. Wait for completion (2-3 minutes) ✅  
6. Loading disappears ✅  
7. Download modal appears automatically ✅

## Audio Quality Manual Test

### Full 21-Minute Listening Session
**Test Date**: 2024-01-15  
**Tester**: [Name]  
**Headphones**: Sony WH-1000XM4

**0:00 - 0:30**: Fade-in smooth, no clicks ✅  
**0:30 - 5:00**: Voice clear, binaural beats audible underneath ✅  
**5:00 - 10:00**: Voice loops seamlessly, no gaps ✅  
**10:00 - 15:00**: Consistent volume, no distortion ✅  
**15:00 - 19:50**: Voice still clear, no fatigue ✅  
**19:50 - 20:00**: Voice fade-out smooth ✅  
**20:00 - 21:00**: Binaural beats only, gentle ending ✅

**Overall Quality**: Excellent ✅  
**Would use for meditation**: Yes ✅

## Performance Metrics
- Voice track download: 3.3 seconds ✅  
- FFmpeg processing: 126 seconds (2:06) ✅  
- Storage upload: 9.2 seconds ✅  
- Database insert: 1.3 seconds ✅  
- Total generation time: 144 seconds (2:24) ✅

## Cost Analysis
- FFmpeg processing: Free (in-function) ✅  
- Storage cost: ~$0.0002 per 20MB file ✅  
- Total cost per final track: ~$0.0002 ✅  
- (Plus voice generation cost from Gate 4: $0.30)

## Screenshots
- [Composer page with 3-layer visualization]  
- [Loading state during generation]  
- [Audacity waveform of full 21-minute track]  
- [Audacity spectrum analysis showing binaural beats]
```

---

## GATE 6 - Download & Lead Capture

### Status: 🔴 NOT STARTED

### Scope
1. Create DownloadModal with form validation  
2. Implement lead capture database persistence  
3. Integrate SendGrid email notification  
4. Generate signed download URLs with expiry  
5. Implement completion screen and success flow

### Pass Criteria

#### ✅ Download Modal Appears After Generation  
**UI Test:**  
```
1. Complete all steps through final track generation
2. Verify: Modal appears automatically
3. Verify: Modal cannot be dismissed without action
4. Verify: Form fields visible: Full Name, Email, Phone (optional)
5. Verify: 2 checkboxes for opt-ins
6. Verify: "Download My Track" button
```

#### ✅ Form Validation Working  
**Test Cases:**  
```
1. Submit with empty name
   Expected: "Name must be at least 2 characters"
2. Submit with invalid email "test@"
   Expected: "Please enter a valid email"
3. Submit with valid email "test@example.com"
   Expected: Form submits successfully
4. Submit with phone "(555) 123-4567"
   Expected: Accepts and submits
```

#### ✅ Lead Saved to Database  
**SQL Verification:**  
```sql
-- After form submission
SELECT full_name, email, phone, opt_in_tips, opt_in_challenge, final_track_id, created_at
FROM theta_track_leads
WHERE email = 'test@example.com';
-- Expected: 1 row with form data
```

#### ✅ Email Sent Successfully  
**SendGrid Dashboard Check:**  
```
1. Submit download form
2. Open SendGrid dashboard
3. Navigate to Activity Feed
4. Verify: Email sent to test@example.com
5. Verify: Subject: "Your Theta Talk Track is Ready 🎵"
6. Verify: Status: Delivered
```

**Email Content Check:**  
```
1. Open email in inbox
2. Verify: Greeting includes user's name
3. Verify: Download link present and clickable
4. Verify: Usage instructions included
5. Verify: Professional formatting
```

#### ✅ Download URL Generated  
**Test Scenario:**  
```
1. Submit form
2. Verify: Browser download starts automatically
3. Verify: File saves as "theta-talk-track-2024-01-15.mp3"
4. Verify: File plays correctly
5. Verify: File size matches expected (18-22 MB)
```

#### ✅ Download Counter Incremented  
**SQL Check:**  
```sql
-- Before download
SELECT download_count FROM theta_final_tracks WHERE session_id = 'test-session-999';

-- After download
SELECT download_count, last_downloaded_at FROM theta_final_tracks WHERE session_id = 'test-session-999';
-- Expected: download_count = 1, last_downloaded_at = recent timestamp
```

#### ✅ Completion Screen Displayed  
**UI Check:**  
```
1. Complete download
2. Verify: Modal closes
3. Verify: Navigate to completion screen
4. Verify: Success message: "Your Theta Talk Track Has Been Downloaded!"
5. Verify: Two buttons visible:
   - "Create Another Track"
   - "View My Dashboard"
```

### Artifacts Required

**File: `artifacts/gate-6-download-lead-capture.md`**

```markdown
# Gate 6 - Download & Lead Capture - ARTIFACTS

[Implementation details, SQL checks, SendGrid logs, email screenshots, test results...]
```

---

## GATE 7 - Performance & Polish

### Status: 🔴 NOT STARTED

### Scope
1. Optimize page load times and code splitting  
2. Implement comprehensive error handling  
3. Add analytics tracking for all user actions  
4. Ensure mobile responsiveness across all pages  
5. Conduct accessibility audit (WCAG 2.1 AA)  
6. Implement rate limiting on edge functions

### Pass Criteria

#### ✅ Page Load Performance  
**Lighthouse Audit:**  
```
- Performance Score: ≥ 90
- First Contentful Paint: ≤ 1.5s
- Largest Contentful Paint: ≤ 2.5s
- Time to Interactive: ≤ 3.5s
- Cumulative Layout Shift: ≤ 0.1
```

#### ✅ Mobile Responsiveness  
**Test Devices:**  
```
- iPhone SE (375px): All pages functional
- iPhone 12 Pro (390px): All pages functional
- iPad (768px): All pages functional
- Desktop (1920px): All pages functional
```

#### ✅ Error Handling Coverage  
**Test Scenarios:**  
```
- Network offline: Graceful error messages
- API timeout: Retry mechanisms
- Invalid input: Clear validation feedback
- Storage full: Alternative download method
- Edge function failure: Fallback options
```

#### ✅ Analytics Events Tracked  
**Required Events:**  
```
- page_view (all theta pages)
- target_saved (per category)
- tone_selected
- affirmations_generated
- affirmation_approved
- voice_selected
- voice_generated
- track_composed
- download_form_submitted
- track_downloaded
- opt_in_tips (true/false)
- opt_in_challenge (true/false)
```

#### ✅ Accessibility Compliance  
**WCAG 2.1 AA Checklist:**  
```
- Color contrast ≥ 4.5:1 for normal text
- All images have alt text
- Keyboard navigation functional
- Screen reader compatible
- Focus indicators visible
- ARIA labels present
- Form labels associated
- Error messages accessible
```

#### ✅ Rate Limiting Active  
**Test:**  
```
1. Call generate-affirmations 5 times in 1 minute
2. Expected: 6th call returns 429 Too Many Requests
3. Call generate-voice-track 3 times in 1 minute
4. Expected: 4th call returns 429 Too Many Requests
```

### Artifacts Required

**File: `artifacts/gate-7-performance-polish.md`**

[Lighthouse scores, mobile screenshots, error handling tests, analytics verification, accessibility audit results...]

---

## GATE 8 - End-to-End Testing & Deployment

### Status: 🔴 NOT STARTED

### Scope
1. Complete happy path end-to-end test (logged out)  
2. Complete happy path end-to-end test (logged in)  
3. Test all error recovery paths  
4. Verify cross-browser compatibility  
5. Production deployment checklist  
6. Post-launch monitoring setup

### Pass Criteria

#### ✅ E2E Happy Path (Anonymous User)  
**Test Flow:**  
```
1. Open /theta-talk-track in incognito
2. Navigate through all 4 steps
3. Set 4 targets → Save
4. Select tone → Generate affirmations → Approve 12
5. Select voice → Generate voice track
6. Compose final track
7. Submit download form
8. Verify track downloaded
9. Verify email received
10. Total time: < 8 minutes
```

#### ✅ E2E Happy Path (Logged-in User)  
**Test Flow:**  
```
1. Log in as test user
2. Navigate to /theta-talk-track
3. Complete all 4 steps
4. Submit download form
5. Verify user_id associated with all records
6. Verify back button goes to /dashboard
7. Total time: < 8 minutes
```

#### ✅ Error Recovery Tests  
**Scenarios:**  
```
1. Network disconnect during affirmation generation
   → Retry successful after reconnect
2. Browser refresh at each step
   → Progress preserved, can continue
3. Navigate away and return
   → State maintained, no data loss
4. Close browser and reopen
   → Session restored via localStorage
```

#### ✅ Cross-Browser Compatibility  
**Tested Browsers:**  
```
- Chrome 120+: Fully functional
- Firefox 120+: Fully functional
- Safari 17+: Fully functional
- Edge 120+: Fully functional
- Mobile Safari (iOS 17): Fully functional
- Mobile Chrome (Android 13): Fully functional
```

#### ✅ Production Deployment Checklist  
**Pre-Launch:**  
```
- [ ] All edge functions deployed to production
- [ ] Database migrations run on production
- [ ] RLS policies verified in production
- [ ] Storage bucket created in production
- [ ] API keys configured in production secrets
- [ ] SendGrid sending domain verified
- [ ] DNS records configured
- [ ] SSL certificate active
- [ ] Error tracking configured (Sentry)
- [ ] Analytics configured (PostHog)
- [ ] Rate limiting active
- [ ] Backup strategy documented
```

#### ✅ Post-Launch Monitoring  
**Metrics Dashboard:**  
```
- Active users (real-time)
- Conversion rate (completion %)
- Average time per step
- Error rate per endpoint
- API cost per conversion
- Email delivery rate
- Download success rate
```

### Artifacts Required

**File: `artifacts/gate-8-e2e-deployment.md`**

[E2E test recordings, browser compatibility screenshots, deployment checklist completion, monitoring dashboard screenshot...]

---

## SUMMARY

**Total Gates**: 8  
**Estimated Timeline**: 3-4 weeks  
**Dependencies**: OpenAI API, ElevenLabs API, FFmpeg, SendGrid

**Critical Success Factors:**  
1. Structured logging at every step  
2. SQL verification for all data operations  
3. Audio quality validation at each generation step  
4. Comprehensive error handling with user-friendly messages  
5. Performance monitoring and optimization  
6. Security hardening (rate limiting, input sanitization)

**Risk Mitigation:**  
- FFmpeg fallback to client-side Tone.js if edge function fails  
- Progressive enhancement for older browsers  
- Graceful degradation if APIs unavailable  
- Clear error messages with actionable next steps

**Post-Launch Optimization:**  
- A/B test tone options (which converts best)  
- Optimize OpenAI prompts based on user feedback  
- Fine-tune binaural beat frequencies  
- Add more voice options  
- Implement track history for logged-in users
