
## Add Bulk Delete and Delete-by-Upload to Winback HQ

### Current State
- Only single-record delete exists (inside the household detail modal)
- No checkboxes, no bulk actions, no upload history with delete
- `winback_households` table has **no** `upload_id` column, so we can't currently link households back to their upload

### Changes

#### 1. Database Migration: Add `last_upload_id` to `winback_households`

Add a nullable `last_upload_id` column (FK to `winback_uploads.id`, ON DELETE SET NULL) so we can track which upload created/last touched each household. This enables "delete by upload."

Also backfill: set `last_upload_id` for existing households based on `created_at` proximity to upload timestamps where possible (best-effort, not critical).

#### 2. Update Upload Process to Set `last_upload_id`

- **`src/hooks/useWinbackBackgroundUpload.ts`**: After inserting the `winback_uploads` row, capture the returned `id` and update all households processed in that batch with `last_upload_id`.
- **`supabase/functions/get_staff_winback/index.ts`** (`upload_terminations` operation): Same -- capture upload ID and stamp it on households.

#### 3. New Component: `WinbackUploadHistory`

Create `src/components/winback/WinbackUploadHistory.tsx` modeled after the existing `src/components/cancel-audit/UploadHistory.tsx`:

- Lists recent uploads from `winback_uploads` (filename, record counts, relative timestamp)
- Each row has a trash icon with a confirmation dialog
- On delete: removes all `winback_policies` and `winback_activities` for households with that `last_upload_id`, then the households themselves, then the upload record
- Place this component in the WinbackHQ page near the Upload button (inside a collapsible or always visible)

#### 4. Add Checkbox Multi-Select to `WinbackHouseholdTable`

- Add a `Checkbox` column as the first column
- Header checkbox = "select all on current page"
- Individual row checkboxes
- New props: `selectedIds: Set<string>`, `onSelectionChange: (ids: Set<string>) => void`
- Clicking a row still opens the detail modal (checkbox click stops propagation)

#### 5. Floating Bulk Action Bar on `WinbackHQ`

- Add `selectedIds` state (Set) to `WinbackHQ.tsx`
- When items are selected, show a floating bar at the bottom (reuse the pattern from `src/components/cancel-audit/BulkActions.tsx`)
- Actions: **Delete Selected** (with confirmation dialog showing count)
- "Select All on Page" via the table header checkbox; no cross-page select needed
- Clear selection button

#### 6. Bulk Delete Logic in `winbackApi.ts`

Add two new functions:

```text
bulkDeleteHouseholds(householdIds: string[]): Promise<void>
  - Staff path: calls edge function operation "bulk_delete_households"
  - Agency path: deletes winback_policies, winback_activities, clears renewal_records references, then deletes winback_households for all IDs

deleteUpload(uploadId: string): Promise<void>
  - Staff path: calls edge function operation "delete_upload"
  - Agency path: finds all households with last_upload_id = uploadId, runs same cascade delete, then deletes the upload record
```

#### 7. Edge Function Updates (`get_staff_winback`)

Add two new operations:

- **`bulk_delete_households`**: Accepts `{ householdIds: string[] }`, performs cascading delete (policies, activities, renewal_records cleanup, households) scoped to `agency_id`
- **`delete_upload`**: Accepts `{ uploadId: string }`, finds households by `last_upload_id`, cascades delete, removes upload record

#### 8. Export Updates

- Add `WinbackUploadHistory` to `src/components/winback/index.ts`

### Access Control
- Agency owners, managers, and key employees all authenticate through the same Supabase JWT flow and share the same `agency_id` scope, so they all get access to bulk delete and upload history delete automatically
- Staff users go through the edge function path which already validates their agency scope
- No additional role checks needed -- the existing agency-scoped RLS and edge function authorization cover all three roles

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/winback/WinbackUploadHistory.tsx` | Upload history list with per-upload delete |

### Files to Modify
| File | Change |
|------|--------|
| `src/components/winback/WinbackHouseholdTable.tsx` | Add checkbox column, selectedIds/onSelectionChange props |
| `src/pages/WinbackHQ.tsx` | Add selectedIds state, bulk action bar, upload history section |
| `src/lib/winbackApi.ts` | Add `bulkDeleteHouseholds` and `deleteUpload` functions |
| `src/components/winback/index.ts` | Export WinbackUploadHistory |
| `src/hooks/useWinbackBackgroundUpload.ts` | Stamp `last_upload_id` on households after upload |
| `supabase/functions/get_staff_winback/index.ts` | Add `bulk_delete_households` and `delete_upload` operations, stamp `last_upload_id` in `upload_terminations` |

### Database Migration
```sql
ALTER TABLE winback_households
  ADD COLUMN last_upload_id uuid REFERENCES winback_uploads(id) ON DELETE SET NULL;
```
