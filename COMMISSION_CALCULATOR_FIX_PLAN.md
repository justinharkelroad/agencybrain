# Commission Calculator Implementation Plan

## Overview

This document contains the complete implementation plan for fixing and enhancing the Agency Brain commission calculator. Execute phases in order, testing after each phase before proceeding.

---

## Current State Summary

### Working Correctly
- Bundle-type kickers ($X per preferred/standard) via `bundle_configs`
- Bundling multipliers (% boost based on bundling %)
- Self-gen tracking via `lead_sources.is_self_generated`
- Commission modifiers UI exists
- Payout uses issued premium (hardcoded)
- `product_types.carrier` column exists

### Partially Broken (schema/UI exists, logic doesn't work)
- Self-gen `affects_qualification` only logs, doesn't block tiers
- Self-gen `affects_payout` exists in schema, NOT implemented
- Brokered tiers calculation - `brokered_tiers` table exists, calculator ignores it

### Missing Entirely
- Per-policy-type chargeback windows (Auto=6mo, Home=12mo)
- Tier metric "Issued" variants
- Configurable tier/payout source
- Brokered sale identification
- Brokered carriers configuration
- `content_hash` for duplicate detection
- Audit trail columns on `comp_payouts`

---

## Business Rules

### Self-Gen Calculation
- Source: `sales.lead_source_id` → `lead_sources.is_self_generated`
- Formula: `self_gen_items / total_items * 100`
- Query from `sales` table for the team member's period

### Chargeback Rules (Three Options)
1. **None** - No chargebacks deducted
2. **90-day** - Only chargebacks where policy in force < 90 days
3. **Full term** - Based on policy term:
   - Standard Auto = 6 months
   - Home/Other/Specialty Auto = 12 months

### Written vs Issued
- Tier qualification: Configurable (written OR issued)
- Payout calculation: Always issued premium (not configurable)

### Self-Gen Incentives
**Penalties (below threshold):**
- Lose X% of commission
- Lose $X flat amount
- Drop X tiers

**Bonuses (above threshold):**
- Add X% commission boost
- Add $X flat bonus
- Add $X per self-gen item/policy/household
- Move up X tiers

---

## PHASE 1: Database Migrations

Create a new Supabase migration file with all schema changes.

### 1.1 comp_plans - Written vs Issued Configuration

```sql
-- Add tier metric source configuration
ALTER TABLE comp_plans ADD COLUMN IF NOT EXISTS tier_metric_source text NOT NULL DEFAULT 'written';
-- Valid values: 'written' | 'issued'
```

### 1.2 product_types - Term Months for Chargeback Logic

```sql
-- Add term_months for full-term chargeback calculations
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS term_months integer NOT NULL DEFAULT 12;

-- Update standard auto policies to 6-month term
UPDATE product_types 
SET term_months = 6 
WHERE (LOWER(name) LIKE '%standard auto%' OR LOWER(name) = 'auto')
  AND LOWER(name) NOT LIKE '%specialty%';
```

### 1.3 product_types - Brokered Flag

```sql
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS is_brokered boolean NOT NULL DEFAULT false;
```

### 1.4 New Table - Brokered Carriers

```sql
CREATE TABLE IF NOT EXISTS brokered_carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agency_id, name)
);

-- RLS policies
ALTER TABLE brokered_carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agency's brokered carriers"
  ON brokered_carriers FOR SELECT
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert their agency's brokered carriers"
  ON brokered_carriers FOR INSERT
  WITH CHECK (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their agency's brokered carriers"
  ON brokered_carriers FOR UPDATE
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their agency's brokered carriers"
  ON brokered_carriers FOR DELETE
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));
```

### 1.5 sales - Brokered Carrier Reference

```sql
-- If brokered_carrier_id is set, the sale is brokered business
ALTER TABLE sales ADD COLUMN IF NOT EXISTS brokered_carrier_id uuid REFERENCES brokered_carriers(id);
```

### 1.6 comp_payouts - Audit Trail Columns

```sql
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS self_gen_percent numeric;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS self_gen_met_requirement boolean;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS self_gen_penalty_amount numeric DEFAULT 0;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS self_gen_bonus_amount numeric DEFAULT 0;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS bundling_percent numeric;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS bundling_multiplier numeric DEFAULT 1;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS chargeback_details_json jsonb;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS calculation_snapshot_json jsonb;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS brokered_commission numeric DEFAULT 0;
```

### 1.7 comp_statement_uploads - Content Hash

```sql
ALTER TABLE comp_statement_uploads ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS idx_statement_uploads_content_hash ON comp_statement_uploads(agency_id, content_hash);
```

---

## PHASE 2: Self-Gen Calculation Function

Create new file: `src/lib/payout-calculator/self-gen.ts`

```typescript
import { supabase } from '@/lib/supabaseClient';

export interface SelfGenMetrics {
  selfGenItems: number;
  totalItems: number;
  selfGenPercent: number;
  selfGenPremium: number;
  totalPremium: number;
  selfGenPolicies: number;
  totalPolicies: number;
  selfGenHouseholds: number;
  totalHouseholds: number;
}

export async function calculateSelfGenMetrics(
  agencyId: string,
  teamMemberId: string,
  periodStartDate: Date,
  periodEndDate: Date
): Promise<SelfGenMetrics> {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id,
      total_items,
      total_premium,
      total_policies,
      lead_source_id,
      lead_sources!left(is_self_generated)
    `)
    .eq('agency_id', agencyId)
    .eq('team_member_id', teamMemberId)
    .gte('sale_date', periodStartDate.toISOString().split('T')[0])
    .lte('sale_date', periodEndDate.toISOString().split('T')[0]);

  if (error) {
    console.error('[calculateSelfGenMetrics] Error:', error);
    return createEmptyMetrics();
  }

  let selfGenItems = 0;
  let totalItems = 0;
  let selfGenPremium = 0;
  let totalPremium = 0;
  let selfGenPolicies = 0;
  let totalPolicies = 0;
  const selfGenHouseholdIds = new Set<string>();
  const totalHouseholdIds = new Set<string>();

  for (const sale of data || []) {
    const items = sale.total_items || 0;
    const premium = sale.total_premium || 0;
    const policies = sale.total_policies || 0;
    const isSelfGen = sale.lead_sources?.is_self_generated === true;

    totalItems += items;
    totalPremium += premium;
    totalPolicies += policies;
    totalHouseholdIds.add(sale.id);

    if (isSelfGen) {
      selfGenItems += items;
      selfGenPremium += premium;
      selfGenPolicies += policies;
      selfGenHouseholdIds.add(sale.id);
    }
  }

  return {
    selfGenItems,
    totalItems,
    selfGenPercent: totalItems > 0 ? (selfGenItems / totalItems) * 100 : 0,
    selfGenPremium,
    totalPremium,
    selfGenPolicies,
    totalPolicies,
    selfGenHouseholds: selfGenHouseholdIds.size,
    totalHouseholds: totalHouseholdIds.size,
  };
}

function createEmptyMetrics(): SelfGenMetrics {
  return {
    selfGenItems: 0,
    totalItems: 0,
    selfGenPercent: 0,
    selfGenPremium: 0,
    totalPremium: 0,
    selfGenPolicies: 0,
    totalPolicies: 0,
    selfGenHouseholds: 0,
    totalHouseholds: 0,
  };
}
```

Export from `src/lib/payout-calculator/index.ts`:
```typescript
export * from './self-gen';
```

---

## PHASE 3: Self-Gen Penalty and Bonus Implementation

### 3.1 Update Types (`src/lib/payout-calculator/types.ts`)

Add these interfaces:

```typescript
export interface SelfGenRequirement {
  enabled: boolean;
  min_percent: number;
  source: 'written' | 'issued';
  penalty_type: 'percent_reduction' | 'flat_reduction' | 'tier_demotion';
  penalty_value: number;
}

export interface SelfGenBonus {
  enabled: boolean;
  min_percent: number;
  bonus_type: 'percent_boost' | 'flat_bonus' | 'per_item' | 'per_policy' | 'per_household' | 'tier_promotion';
  bonus_value: number;
}

export interface CommissionModifiers {
  self_gen_requirement?: SelfGenRequirement;
  self_gen_bonus?: SelfGenBonus;
  // Keep existing self_gen_kicker for backward compatibility
  self_gen_kicker?: {
    enabled: boolean;
    type: 'per_item' | 'per_policy' | 'per_household';
    amount: number;
    min_self_gen_percent: number;
  };
}

export interface SelfGenPenaltyResult {
  applied: boolean;
  penaltyType: 'percent_reduction' | 'flat_reduction' | 'tier_demotion' | null;
  penaltyValue: number;
  originalTierIndex: number | null;
  adjustedTierIndex: number | null;
  commissionReduction: number;
}

export interface SelfGenBonusResult {
  applied: boolean;
  bonusType: string | null;
  bonusValue: number;
  bonusAmount: number;
  tierPromotion: number;
}
```

### 3.2 Add Helper Functions (`src/lib/payout-calculator/calculator.ts`)

```typescript
export function applySelfGenPenalty(
  selfGenPercent: number,
  requirement: SelfGenRequirement | undefined,
  currentTierIndex: number,
  baseCommission: number
): SelfGenPenaltyResult {
  const result: SelfGenPenaltyResult = {
    applied: false,
    penaltyType: null,
    penaltyValue: 0,
    originalTierIndex: currentTierIndex,
    adjustedTierIndex: currentTierIndex,
    commissionReduction: 0,
  };

  if (!requirement?.enabled) return result;
  if (selfGenPercent >= requirement.min_percent) return result;

  result.applied = true;
  result.penaltyType = requirement.penalty_type;
  result.penaltyValue = requirement.penalty_value;

  switch (requirement.penalty_type) {
    case 'percent_reduction':
      result.commissionReduction = baseCommission * (requirement.penalty_value / 100);
      break;
    case 'flat_reduction':
      result.commissionReduction = Math.min(requirement.penalty_value, baseCommission);
      break;
    case 'tier_demotion':
      const tiersToDrop = Math.floor(requirement.penalty_value);
      result.adjustedTierIndex = Math.max(0, currentTierIndex - tiersToDrop);
      break;
  }

  return result;
}

export function applySelfGenBonus(
  selfGenPercent: number,
  bonus: SelfGenBonus | undefined,
  selfGenMetrics: { selfGenItems: number; selfGenPolicies: number; selfGenHouseholds: number },
  currentTierIndex: number,
  totalTiers: number,
  baseCommission: number
): SelfGenBonusResult {
  const result: SelfGenBonusResult = {
    applied: false,
    bonusType: null,
    bonusValue: 0,
    bonusAmount: 0,
    tierPromotion: 0,
  };

  if (!bonus?.enabled) return result;
  if (selfGenPercent < bonus.min_percent) return result;

  result.applied = true;
  result.bonusType = bonus.bonus_type;
  result.bonusValue = bonus.bonus_value;

  switch (bonus.bonus_type) {
    case 'percent_boost':
      result.bonusAmount = baseCommission * (bonus.bonus_value / 100);
      break;
    case 'flat_bonus':
      result.bonusAmount = bonus.bonus_value;
      break;
    case 'per_item':
      result.bonusAmount = selfGenMetrics.selfGenItems * bonus.bonus_value;
      break;
    case 'per_policy':
      result.bonusAmount = selfGenMetrics.selfGenPolicies * bonus.bonus_value;
      break;
    case 'per_household':
      result.bonusAmount = selfGenMetrics.selfGenHouseholds * bonus.bonus_value;
      break;
    case 'tier_promotion':
      result.tierPromotion = Math.min(
        Math.floor(bonus.bonus_value),
        totalTiers - 1 - currentTierIndex
      );
      break;
  }

  return result;
}
```

### 3.3 Update calculateMemberPayout Function

In `calculateMemberPayout`, after finding the initial tier match:

1. Calculate self-gen metrics using the new function
2. Apply penalty if below threshold (adjust tier or track commission reduction)
3. Apply bonus if above threshold (adjust tier or track bonus amount)
4. After base commission is calculated, apply percent_reduction/flat_reduction penalties
5. After base commission is calculated, apply percent_boost/flat_bonus/per_item bonuses
6. Include all self-gen data in the returned PayoutCalculation object

Key integration point (around line 773-800 in existing code):
```typescript
// After: const tierMatch = findMatchingTier(plan.tiers, metricValue);
// Add self-gen processing before using tierMatch for calculations
```

---

## PHASE 4: Full Term Chargeback Logic

### 4.1 Rename and Update Chargeback Filter Function

Rename `filterChargebacksByThreeMonthRule` to `filterChargebacksByRule`.

```typescript
export interface ChargebackDetail {
  policyNumber: string;
  productType: string;
  premium: number;
  daysInForce: number;
  termMonths: number;
  included: boolean;
  reason: string;
}

export interface ChargebackFilterResult {
  eligibleChargebacks: SubProducerTransaction[];
  excludedChargebacks: SubProducerTransaction[];
  eligiblePremium: number;
  excludedPremium: number;
  details: ChargebackDetail[];
}

export function filterChargebacksByRule(
  chargebackTransactions: SubProducerTransaction[],
  chargebackRule: 'none' | 'three_month' | 'full',
  statementMonth: number,
  statementYear: number,
  productTermMonths: Map<string, number> // product type name -> term months
): ChargebackFilterResult {
  const statementDate = new Date(statementYear, statementMonth - 1, 28);
  
  const result: ChargebackFilterResult = {
    eligibleChargebacks: [],
    excludedChargebacks: [],
    eligiblePremium: 0,
    excludedPremium: 0,
    details: [],
  };

  if (chargebackRule === 'none') {
    result.excludedChargebacks = chargebackTransactions;
    for (const cb of chargebackTransactions) {
      const premium = Math.abs(cb.writtenPremium || 0);
      result.excludedPremium += premium;
      result.details.push({
        policyNumber: cb.policyNumber || 'Unknown',
        productType: cb.productType || 'Unknown',
        premium,
        daysInForce: 0,
        termMonths: 0,
        included: false,
        reason: 'Chargeback rule: none',
      });
    }
    return result;
  }

  for (const cb of chargebackTransactions) {
    const effectiveDate = parseTransactionDate(cb.origPolicyEffDate);
    const premium = Math.abs(cb.writtenPremium || 0);
    const productType = (cb.productType || '').toLowerCase();
    
    if (!effectiveDate) {
      // Conservative: include if can't parse
      result.eligibleChargebacks.push(cb);
      result.eligiblePremium += premium;
      result.details.push({
        policyNumber: cb.policyNumber || 'Unknown',
        productType: cb.productType || 'Unknown',
        premium,
        daysInForce: -1,
        termMonths: -1,
        included: true,
        reason: 'Could not parse effective date',
      });
      continue;
    }

    const daysInForce = Math.floor(
      (statementDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let termMonths: number;
    let maxDays: number;

    if (chargebackRule === 'three_month') {
      termMonths = 3;
      maxDays = 90;
    } else {
      // Full term - lookup by product type
      termMonths = productTermMonths.get(productType) || 
                   (productType.includes('auto') && !productType.includes('specialty') ? 6 : 12);
      maxDays = termMonths * 30;
    }

    const included = daysInForce < maxDays;
    
    if (included) {
      result.eligibleChargebacks.push(cb);
      result.eligiblePremium += premium;
    } else {
      result.excludedChargebacks.push(cb);
      result.excludedPremium += premium;
    }

    result.details.push({
      policyNumber: cb.policyNumber || 'Unknown',
      productType: cb.productType || 'Unknown',
      premium,
      daysInForce,
      termMonths,
      included,
      reason: included 
        ? `Within ${termMonths}-month term (${daysInForce} days)`
        : `Exceeded ${termMonths}-month term (${daysInForce} days)`,
    });
  }

  return result;
}
```

### 4.2 Fetch Product Term Months Before Calculation

Before calling the chargeback filter, fetch product types:

```typescript
const { data: productTypesData } = await supabase
  .from('product_types')
  .select('name, term_months, category')
  .or(`agency_id.eq.${agencyId},agency_id.is.null`);

const productTermMonths = new Map<string, number>();
for (const pt of productTypesData || []) {
  const termMonths = pt.term_months || 
    (pt.category?.toLowerCase() === 'auto' ? 6 : 12);
  productTermMonths.set(pt.name.toLowerCase(), termMonths);
}
```

---

## PHASE 5: Brokered Business Implementation

### 5.1 Brokered Carriers Manager Component

Create `src/components/agency/BrokeredCarriersManager.tsx`:

- List all brokered carriers for the agency
- Add new carrier (name input + Add button)
- Toggle active/inactive
- Delete carrier
- Fetch from `brokered_carriers` table

Add this component to Agency Settings page.

### 5.2 Add Brokered Sale Form

Create `src/components/sales/AddBrokeredSaleForm.tsx`:

Similar to `AddSaleForm.tsx` with these differences:
- Required "Carrier" dropdown populated from `brokered_carriers` table (active only)
- When saving, set `brokered_carrier_id` on the sales record
- Product types can be filtered to brokered types or allow any

### 5.3 Update Compensation Page UI

Where "Add Sale" button exists:
- Keep "Add Sale" for Allstate business
- Add "Add Brokered Sale" button that opens brokered sale modal

### 5.4 Update Payout Calculator for Brokered Business

In the calculation loop, identify brokered sales:

```typescript
const isBrokered = sale.brokered_carrier_id !== null;

if (isBrokered) {
  let brokeredCommission = 0;
  
  switch (plan.brokered_payout_type) {
    case 'flat_per_item':
      brokeredCommission = sale.total_items * (plan.brokered_flat_rate || 0);
      break;
    case 'percent_of_premium':
      brokeredCommission = sale.total_premium * ((plan.brokered_flat_rate || 0) / 100);
      break;
    case 'tiered':
      // Use comp_plan_brokered_tiers table
      const brokeredTierMatch = findMatchingTier(plan.brokered_tiers || [], metricValue);
      if (brokeredTierMatch) {
        brokeredCommission = calculateTierCommission(sale, brokeredTierMatch, plan.brokered_payout_type);
      }
      break;
  }
  
  // Track separately for audit
  brokeredCommissionTotal += brokeredCommission;
  
  // If brokered_counts_toward_tier, items already included in tier qualification
}
```

---

## PHASE 6: Written vs Issued Configuration

### 6.1 Update CreateCompPlanModal.tsx

Add source dropdown next to Tier Metric:

```typescript
const TIER_METRIC_SOURCES = [
  { value: "written", label: "Written" },
  { value: "issued", label: "Issued" },
];
```

UI layout:
- "Tier Metric": [Items / Policies / Premium / Points / Households]
- "Based On": [Written / Issued]

Save to `tier_metric_source` column.

### 6.2 Update getMetricValue Function

```typescript
export function getMetricValue(
  performance: SubProducerPerformance, 
  tierMetric: string,
  source: 'written' | 'issued' = 'written'
): number {
  const isIssued = source === 'issued';
  
  switch (tierMetric) {
    case 'premium':
      return isIssued ? performance.issuedPremium : performance.writtenPremium;
    case 'items':
      return isIssued ? performance.issuedItems : performance.writtenItems;
    case 'policies':
      return isIssued ? performance.issuedPolicies : performance.writtenPolicies;
    case 'households':
      return isIssued ? performance.issuedHouseholds : performance.writtenHouseholds;
    case 'points':
      return isIssued ? performance.issuedPoints : performance.writtenPoints;
    default:
      return isIssued ? performance.issuedPremium : performance.writtenPremium;
  }
}
```

### 6.3 Update calculateMemberPayout Call

```typescript
const metricValue = getMetricValue(
  performance, 
  plan.tier_metric, 
  plan.tier_metric_source || 'written'
);
```

---

## PHASE 7: Duplicate Statement Detection

### 7.1 Create Hash Utility

Create `src/lib/utils/file-hash.ts`:

```typescript
export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 7.2 Update StatementUploader.tsx

Before processing upload:

```typescript
import { computeFileHash } from '@/lib/utils/file-hash';

// In upload handler:
const contentHash = await computeFileHash(file);

const { data: existing } = await supabase
  .from('comp_statement_uploads')
  .select('id, filename, uploaded_at')
  .eq('agency_id', agencyId)
  .eq('content_hash', contentHash)
  .maybeSingle();

if (existing) {
  // Show duplicate warning dialog
  const proceed = await confirmDuplicateUpload(existing.filename, existing.uploaded_at);
  if (!proceed) return;
}

// Include content_hash when inserting upload record
```

### 7.3 Create Duplicate Warning Dialog

```typescript
// Dialog that shows:
// "This file appears to be a duplicate of [filename] uploaded on [date]."
// "Are you sure you want to upload it again?"
// [Cancel] [Upload Anyway]
```

---

## PHASE 8: Audit Trail - Save Calculation Details

### 8.1 Update PayoutCalculation Interface

Add all new fields to the interface in `types.ts`:

```typescript
interface PayoutCalculation {
  // ... existing fields ...
  
  // New audit fields
  selfGenPercent: number;
  selfGenMetRequirement: boolean;
  selfGenPenaltyAmount: number;
  selfGenBonusAmount: number;
  bundlingPercent: number;
  bundlingMultiplier: number;
  brokeredCommission: number;
  chargebackDetails: ChargebackDetail[];
  calculationSnapshot: {
    inputs: Record<string, any>;
    tierMatched: { tierId: string; threshold: number; rate: number } | null;
    selfGen: { percent: number; metRequirement: boolean; penaltyApplied: boolean; bonusApplied: boolean };
    bundling: { percent: number; multiplier: number };
    calculations: Record<string, number>;
    calculatedAt: string;
  };
}
```

### 8.2 Update Payout Saving Logic

In `usePayoutCalculator.ts` or wherever payouts are saved to database, include all new columns:

```typescript
const payoutRow = {
  // ... existing fields ...
  
  self_gen_percent: p.selfGenPercent,
  self_gen_met_requirement: p.selfGenMetRequirement,
  self_gen_penalty_amount: p.selfGenPenaltyAmount || 0,
  self_gen_bonus_amount: p.selfGenBonusAmount || 0,
  bundling_percent: p.bundlingPercent,
  bundling_multiplier: p.bundlingMultiplier || 1,
  brokered_commission: p.brokeredCommission || 0,
  chargeback_details_json: p.chargebackDetails,
  calculation_snapshot_json: p.calculationSnapshot,
};
```

---

## PHASE 9: Commission Modifiers UI Update

### 9.1 Update CreateCompPlanModal.tsx

Replace existing self-gen configuration section with expanded version:

**Self-Gen Penalty Section:**
- Enable toggle
- Min Self-Gen % input
- Based On dropdown (Written/Issued)
- Penalty Type dropdown:
  - Lose % of Commission
  - Lose $ Amount
  - Drop Tier(s)
- Penalty Value input (label changes based on type)

**Self-Gen Bonus Section:**
- Enable toggle
- Min Self-Gen % to Earn Bonus input
- Bonus Type dropdown:
  - Add % to Commission
  - Add $ Flat Bonus
  - $ per Self-Gen Item
  - $ per Self-Gen Policy
  - $ per Self-Gen Household
  - Move Up Tier(s)
- Bonus Value input (label changes based on type)

Save to `commission_modifiers` JSONB column with structure:
```json
{
  "self_gen_requirement": {
    "enabled": true,
    "min_percent": 25,
    "source": "written",
    "penalty_type": "percent_reduction",
    "penalty_value": 50
  },
  "self_gen_bonus": {
    "enabled": true,
    "min_percent": 40,
    "bonus_type": "per_item",
    "bonus_value": 10
  }
}
```

---

## Testing Checklist

### Phase 1 - Migrations
- [ ] All migrations run without error
- [ ] New columns exist on all tables
- [ ] brokered_carriers table created with RLS
- [ ] Default term_months set correctly for auto vs other products

### Phase 2 - Self-Gen Calculation
- [ ] Function correctly calculates self-gen % from sales table
- [ ] Correctly identifies self-gen via lead_sources.is_self_generated
- [ ] Returns 0% when no sales exist

### Phase 3 - Self-Gen Penalty/Bonus
- [ ] Penalty applies when below threshold
- [ ] Penalty correctly reduces commission (percent, flat, tier demotion)
- [ ] Bonus applies when above threshold
- [ ] Bonus correctly increases commission (percent, flat, per-unit, tier promotion)
- [ ] Both penalty and bonus can be configured on same plan

### Phase 4 - Full Term Chargebacks
- [ ] 'none' rule excludes all chargebacks
- [ ] 'three_month' rule uses 90-day window
- [ ] 'full' rule uses product-specific term (auto=6mo, other=12mo)
- [ ] Chargeback details saved correctly

### Phase 5 - Brokered Business
- [ ] Can add/edit/delete brokered carriers
- [ ] Can add brokered sale with carrier selection
- [ ] Brokered sales use brokered rates in calculation
- [ ] brokered_counts_toward_tier works correctly

### Phase 6 - Written vs Issued
- [ ] Can select source in comp plan UI
- [ ] Tier qualification uses correct source
- [ ] Payout calculation still uses issued premium

### Phase 7 - Duplicate Detection
- [ ] Hash computed correctly for uploaded file
- [ ] Duplicate detected and warning shown
- [ ] User can proceed or cancel
- [ ] Hash saved with upload record

### Phase 8 - Audit Trail
- [ ] All new fields populated in comp_payouts
- [ ] calculation_snapshot contains full breakdown
- [ ] chargeback_details contains individual chargeback info

### Phase 9 - Commission Modifiers UI
- [ ] Penalty configuration saves correctly
- [ ] Bonus configuration saves correctly
- [ ] Dynamic labels update based on type selection
