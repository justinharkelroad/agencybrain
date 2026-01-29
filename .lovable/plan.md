
# Phone Number Auto-Formatting Implementation

## Problem

Phone number inputs throughout the app display raw digits like "260168881" which makes it difficult to verify the correct number of characters. Users have to manually count digits to ensure they've entered a valid 10-digit phone number.

## Solution

Create a centralized phone formatting utility and apply it consistently across all phone input fields in the application. The format will be: `(XXX) XXX-XXXX`

## Implementation Strategy

### Phase 1: Create Centralized Utility

**File**: `src/lib/utils.ts`

Add a new `formatPhoneNumber` function that formats as user types:

```typescript
// Format phone number as (XXX) XXX-XXXX for input fields
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  const limited = digits.slice(0, 10);
  
  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}
```

This matches the existing pattern already used in `StaffAddSaleForm.tsx` and `AddSaleForm.tsx`.

### Phase 2: Update All Phone Input Fields

| Component | File | Line(s) | Current State |
|-----------|------|---------|---------------|
| Add Quoted Household | `src/components/lqs/AddQuoteModal.tsx` | 493 | Raw input - **Primary request** |
| LQS Household Detail | `src/components/lqs/LqsHouseholdDetailModal.tsx` | 283 | Raw input (multiple phones) |
| Add Lead Modal | `src/components/lqs/AddLeadModal.tsx` | 262 | Raw input (multiple phones) |
| Staff Edit Sale Modal | `src/components/staff/StaffEditSaleModal.tsx` | 299 | Raw input |
| PDF Upload Form | `src/components/sales/PdfUploadForm.tsx` | 822 | Raw input |
| Lead Capture Modal | `src/components/landing/LeadCaptureModal.tsx` | 165 | Raw input |
| Talk Track Download | `src/pages/ThetaTalkTrackDownload.tsx` | 75-79 | Uncontrolled input |
| Staff Form Submission | `src/pages/StaffFormSubmission.tsx` | 866-899 | Dynamic phone fields |
| Staff Add Sale Form | `src/components/sales/StaffAddSaleForm.tsx` | 65-74, 495 | Has local formatter - will use global |
| Add Sale Form | `src/components/sales/AddSaleForm.tsx` | 104-113, 721 | Has local formatter - will use global |

### Phase 3: Update Display-Only Formatters

These components have local `formatPhone` functions for display. They'll be updated to use the centralized utility for consistency:

| Component | File | Lines |
|-----------|------|-------|
| ContactSearchInput | `src/components/contacts/ContactSearchInput.tsx` | 85-91 |
| ContactProfileModal | `src/components/contacts/ContactProfileModal.tsx` | 571-577 |

## Detailed Changes by File

### 1. `src/lib/utils.ts`
Add the `formatPhoneNumber` function after existing utilities.

### 2. `src/components/lqs/AddQuoteModal.tsx` (Primary Fix)
```typescript
// Add import
import { formatPhoneNumber } from '@/lib/utils';

// Update line 493
onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
```

### 3. `src/components/lqs/LqsHouseholdDetailModal.tsx`
```typescript
// Add import
import { formatPhoneNumber } from '@/lib/utils';

// Update handlePhoneChange function (~line 140-144)
const handlePhoneChange = (index: number, value: string) => {
  const formatted = formatPhoneNumber(value);
  setEditPhones(prev => {
    const updated = [...prev];
    updated[index] = formatted;
    return updated;
  });
};
```

### 4. `src/components/lqs/AddLeadModal.tsx`
```typescript
// Add import
import { formatPhoneNumber } from '@/lib/utils';

// Update handlePhoneChange function
const handlePhoneChange = (index: number, value: string) => {
  const formatted = formatPhoneNumber(value);
  const newPhones = [...phones];
  newPhones[index] = formatted;
  setPhones(newPhones);
};
```

### 5. `src/components/staff/StaffEditSaleModal.tsx`
```typescript
// Add import
import { formatPhoneNumber } from '@/lib/utils';

// Update line 299
onChange={(e) =>
  setFormData((prev) => ({ ...prev, customer_phone: formatPhoneNumber(e.target.value) }))
}
```

### 6. `src/components/sales/PdfUploadForm.tsx`
```typescript
// Add import
import { formatPhoneNumber } from '@/lib/utils';

// Update line 822
onChange={(e) => setCustomerPhone(formatPhoneNumber(e.target.value))}
```

### 7. `src/components/landing/LeadCaptureModal.tsx`
```typescript
// Add import
import { formatPhoneNumber } from '@/lib/utils';

// Update line 165
onChange={(e) => handleChange('phone', formatPhoneNumber(e.target.value))}
```

### 8. `src/pages/ThetaTalkTrackDownload.tsx`
Add controlled state and formatting for phone input.

### 9. `src/pages/StaffFormSubmission.tsx`
Update dynamic field rendering to apply formatting for phone-type fields:
```typescript
onChange={e => {
  let v = e.target.value;
  if (field.type === 'phone') {
    v = formatPhoneNumber(v);
  }
  // ... rest of handler
}}
```

### 10. `src/components/sales/StaffAddSaleForm.tsx` & `src/components/sales/AddSaleForm.tsx`
Remove local `formatPhoneNumber` function definitions (lines 65-74 and 104-113 respectively) and import from `@/lib/utils`.

### 11. Display Components (ContactSearchInput, ContactProfileModal)
Replace local `formatPhone` functions with import from `@/lib/utils`.

## Files Summary

| File | Action |
|------|--------|
| `src/lib/utils.ts` | Add `formatPhoneNumber` function |
| `src/components/lqs/AddQuoteModal.tsx` | Apply formatting to phone input |
| `src/components/lqs/LqsHouseholdDetailModal.tsx` | Apply formatting to phone array inputs |
| `src/components/lqs/AddLeadModal.tsx` | Apply formatting to phone array inputs |
| `src/components/staff/StaffEditSaleModal.tsx` | Apply formatting to phone input |
| `src/components/sales/PdfUploadForm.tsx` | Apply formatting to phone input |
| `src/components/landing/LeadCaptureModal.tsx` | Apply formatting to phone input |
| `src/pages/ThetaTalkTrackDownload.tsx` | Add controlled input with formatting |
| `src/pages/StaffFormSubmission.tsx` | Apply formatting to dynamic phone fields |
| `src/components/sales/StaffAddSaleForm.tsx` | Replace local function with import |
| `src/components/sales/AddSaleForm.tsx` | Replace local function with import |
| `src/components/contacts/ContactSearchInput.tsx` | Replace local display formatter with import |
| `src/components/contacts/ContactProfileModal.tsx` | Replace local display formatter with import |

## User Experience

**Before**: User types `2601688810` and sees `2601688810` (hard to count)

**After**: User types `2601688810` and sees `(260) 168-8810` (easy to verify)

## Technical Notes

- The formatting strips non-digits, limits to 10 characters, and adds formatting as user types
- Backend `normalize_phone` function already handles stripping formatting before database storage
- The `maxLength={14}` attribute on inputs accommodates the formatted string length `(XXX) XXX-XXXX`
