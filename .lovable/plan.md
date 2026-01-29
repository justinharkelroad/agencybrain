
# Add/Remove BETA Labels

## Summary
Move the red BETA label from the Contacts page to the Compensation Plans section.

## Changes

### 1. Add BETA to Compensation Plans
**File**: `src/components/sales/CompPlansTab.tsx`

Line 163 - Change:
```
<h2 className="text-xl font-semibold">Compensation Plans</h2>
```
To:
```
<h2 className="text-xl font-semibold">Compensation Plans <span className="text-destructive">(BETA)</span></h2>
```

### 2. Remove BETA from Contacts
**File**: `src/pages/Contacts.tsx`

Line 239 - Change:
```
<h1 className="text-2xl font-bold">Contacts <span className="text-destructive">(BETA)</span></h1>
```
To:
```
<h1 className="text-2xl font-bold">Contacts</h1>
```

## Files Modified
| File | Change |
|------|--------|
| `src/components/sales/CompPlansTab.tsx` | Add red (BETA) label after "Compensation Plans" |
| `src/pages/Contacts.tsx` | Remove (BETA) label from header |
