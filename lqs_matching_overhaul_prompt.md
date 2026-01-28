# LQS Matching Logic Overhaul - Claude Code Implementation Prompt

## Context

You are updating the LQS (Lead-Quote-Sale) matching system in Agency Brain. The current fuzzy matching logic is producing false positives by matching unrelated people who share common surnames (e.g., matching MELISSA SMITH sale to MICHELLE SMITH lead just because first initials match).

This overhaul introduces **Policy Number matching** as the primary Quote→Sale link, which is 100% reliable, and removes dangerous fuzzy matching that was inflating attribution numbers.

---

## Current State (What Exists)

The LQS system currently uses:
- **Household Key**: `LASTNAME_FIRSTNAME_ZIPCODE` (e.g., `SMITH_JOHN_12345`)
- **Lead Upload**: Exact household_key match → update existing, else create new
- **Quote Upload**: Exact household_key match → link to household, else create new
- **Sale Upload**: 
  1. Exact household_key match
  2. Fuzzy name match (last name exact + first initial) ← **THIS IS THE PROBLEM**
  3. Scoring system (product +40, producer +35, premium +25, date +10)

---

## Required Changes

### 1. NEW: Policy Number Matching (Quote → Sale)

**The "Issued Policy #" field in Quotes links directly to "Policy No" in Sales.** This is a 100% reliable match.

#### Database Schema Changes

Add to `lqs_quotes` table (if not exists):
```sql
ALTER TABLE lqs_quotes ADD COLUMN IF NOT EXISTS issued_policy_number TEXT;
CREATE INDEX IF NOT EXISTS idx_lqs_quotes_policy ON lqs_quotes(issued_policy_number) WHERE issued_policy_number IS NOT NULL;
```

Add to `lqs_sales` table (if not exists):
```sql
ALTER TABLE lqs_sales ADD COLUMN IF NOT EXISTS policy_number TEXT;
CREATE INDEX IF NOT EXISTS idx_lqs_sales_policy ON lqs_sales(policy_number);
```

### 2. REVISED: Sale Upload Matching Logic

Replace the current sale matching function with this priority order:

```
PRIORITY 1: Policy Number Match (100% confidence)
─────────────────────────────────────────────────
IF sale.policy_number matches any lqs_quotes.issued_policy_number:
  → Get the household_id from that quote
  → Link sale to household
  → Update household status to 'sold'
  → Set sold_date
  → DONE - skip all other matching

PRIORITY 2: Exact Name Match + Quote Exists (High confidence)
─────────────────────────────────────────────────────────────
IF no policy match found:
  → Search households WHERE last_name = sale.last_name (exact, case-insensitive)
  → Filter to households that HAVE at least one quote
  → For each candidate, calculate score:
      - Product type match: +40 points
      - Sub-producer code match: +35 points  
      - Premium within 15%: +25 points
      - Quote date before sale date: +10 points
  
  → IF exactly 1 candidate: Auto-match regardless of score
  → IF top score >= 75 AND 20+ point lead over 2nd place: Auto-match
  → ELSE: Flag for manual review (DO NOT auto-match)

PRIORITY 3: No Match Found (One-Call Close)
───────────────────────────────────────────
IF no candidates found:
  → Create new lqs_household with:
      - status = 'sold'
      - lead_received_date = sale_date
      - first_quote_date = sale_date
      - sold_date = sale_date
      - lead_source = 'Direct/Unknown'
  → Create lqs_sale linked to new household
```

### 3. REMOVE: Fuzzy First-Initial Matching

**DELETE this logic entirely:**
```javascript
// REMOVE THIS - causes false positives
if (saleFirst && leadFirst && saleFirst[0] === leadFirst[0]) {
  // First initial match
}
if (saleFirst.includes(leadFirst) || leadFirst.includes(saleFirst)) {
  // Name contains match
}
```

This was matching:
- MELISSA SMITH → MICHELLE SMITH (wrong person)
- JESSICA JONES → JOHN JONES (wrong person)
- SAMUEL JACOBS → SHEILA JACOBS (wrong person)

### 4. NEW: Product Type Normalization

Create a normalization function for product matching:

```javascript
const normalizeProductType = (product) => {
  if (!product) return 'UNKNOWN';
  const p = product.toUpperCase();
  
  // Auto variants
  if (p.includes('AUTO') || p.includes('VEHICLE')) return 'AUTO';
  
  // Home variants
  if (p.includes('HOMEOWNER') || p === 'HOME') return 'HOME';
  
  // Other products
  if (p.includes('LANDLORD')) return 'LANDLORD';
  if (p.includes('RENTER')) return 'RENTERS';
  if (p.includes('MOBILE') || p.includes('MANUFACTURED')) return 'MOBILE';
  if (p.includes('UMBRELLA')) return 'UMBRELLA';
  if (p.includes('FLOOD')) return 'FLOOD';
  if (p.includes('BOAT') || p.includes('MARINE')) return 'BOAT';
  if (p.includes('MOTOR CLUB')) return 'MOTOR_CLUB';
  if (p.includes('SCHEDULED PERSONAL')) return 'SPP';
  
  return 'OTHER';
};
```

### 5. NEW: Sub-Producer Code Extraction

Quotes have format `"775-BRETT REAP"`, Sales have just `"775"`.

```javascript
const extractSubProducerCode = (subProducer) => {
  if (!subProducer) return null;
  const str = String(subProducer).trim();
  // Extract code before hyphen if exists
  const code = str.split('-')[0].trim();
  // Return null if it's not a valid code
  if (code === '' || code.toLowerCase() === 'not applicable') return null;
  return code;
};
```

### 6. UPDATE: Quote Upload Processing

When processing quote uploads, capture the issued policy number:

```javascript
// In quote upload handler
const processQuoteRow = (row) => {
  // ... existing household matching logic ...
  
  // NEW: Capture issued policy number if present
  const issuedPolicyNumber = row['Issued Policy #'] || row['Issued Policy Number'];
  if (issuedPolicyNumber && !isNaN(issuedPolicyNumber)) {
    quote.issued_policy_number = String(Math.floor(issuedPolicyNumber));
  }
  
  // ... rest of quote processing ...
};
```

### 7. UPDATE: Sale Upload Processing

When processing sale uploads, capture policy number:

```javascript
// In sale upload handler
const processSaleRow = (row) => {
  const policyNumber = row['Policy No'] || row['Policy Number'];
  if (policyNumber) {
    sale.policy_number = String(Math.floor(policyNumber));
  }
  
  // ... then run new matching logic ...
};
```

---

## Scoring System (Revised)

When Policy Number match fails and we fall back to name matching:

| Factor | Points | Condition |
|--------|--------|-----------|
| Product Match | +40 | normalizeProductType(quote.product) === normalizeProductType(sale.product) |
| Sub-Producer Match | +35 | extractSubProducerCode(quote.sub_producer) === sale.sub_producer_code |
| Premium Within 15% | +25 | abs(quote.premium - sale.premium) / quote.premium <= 0.15 |
| Quote Before Sale | +10 | quote.production_date < sale.issued_date |

**Maximum Score: 110 points**

### Auto-Match Rules:
- **1 candidate only**: Auto-match (regardless of score)
- **Top score >= 75 AND 20+ point lead**: Auto-match
- **All other cases**: Manual review queue

---

## Manual Review Queue

Sales that don't auto-match should be flagged with:

```javascript
{
  sale_id: uuid,
  candidates: [
    { household_id, score, reasons: ['product_match', 'producer_match'] },
    { household_id, score, reasons: ['premium_match'] }
  ],
  status: 'pending_review',
  created_at: timestamp
}
```

Create UI for manual matching in the LQS admin area.

---

## Data Flow Summary

```
LEADS (from Lead Management Lab CSV)
├── Fields: First Name, Last Name, ZIP, Phone, Email
├── Match on: LASTNAME_FIRSTNAME_ZIP
└── Creates: lqs_household (status='lead')

QUOTES (from Quotes Detail & Conversion Report)
├── Fields: First Name, Last Name, ZIP, Address, Issued Policy #, Sub Producer, Product, Premium
├── Match on: LASTNAME_FIRSTNAME_ZIP
├── Store: issued_policy_number for future sale linking
└── Updates: lqs_household (status='quoted'), creates lqs_quote

SALES (from New Business Details Report)
├── Fields: Customer Name, Policy No, Sub Producer, Product, Premium, Issued Date
├── Match on: 
│   1. Policy Number (100% confidence)
│   2. Last Name + Scoring (if no policy match)
│   3. Create new household (if no match)
└── Updates: lqs_household (status='sold'), creates lqs_sale
```

---

## Files to Modify

Based on typical Lovable/Supabase structure, you'll likely need to modify:

1. **Database migrations**: Add `issued_policy_number` to quotes, `policy_number` to sales
2. **Quote upload handler**: Parse and store issued policy number
3. **Sale upload handler**: Complete rewrite of matching logic
4. **Matching utility functions**: Add policy matching, remove fuzzy matching
5. **Product normalization**: New utility function
6. **Sub-producer extraction**: New utility function
7. **Manual review UI**: New component for handling ambiguous matches

---

## Testing Checklist

After implementation, verify:

- [ ] Policy number match links quote to sale correctly
- [ ] Fuzzy first-initial matching is completely removed
- [ ] MELISSA SMITH sale does NOT match MICHELLE SMITH lead
- [ ] One-call closes create new households with correct dates
- [ ] Manual review queue captures ambiguous matches
- [ ] Product normalization works for all known variants
- [ ] Sub-producer code extraction handles "775-BRETT REAP" format
- [ ] Premium comparison uses 15% tolerance

---

## Rollback Plan

If issues arise:
1. Feature flag the new matching logic
2. Keep old matching code but disabled
3. Add logging to compare old vs new match results before going live

---

## Questions to Answer Before Starting

1. Where is the current sale matching logic located? (file path)
2. Is there already an `issued_policy_number` column in lqs_quotes?
3. Is there already a `policy_number` column in lqs_sales?
4. Is there an existing manual review queue system to extend?
5. What's the current product normalization logic (if any)?
