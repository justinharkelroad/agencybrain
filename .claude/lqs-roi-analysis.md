# LQS ROI Analytics — Analysis & Enhancement Handoff

## System Overview

The LQS (Lead-Quote-Sale) system tracks the full insurance sales funnel: leads arrive from marketing sources, get quoted by salespeople, and close into policies. The ROI Analytics page (`/lqs/roi`) lets agency owners measure marketing ROI, compare lead sources, evaluate producer performance, and track conversion trends.

**Data model**: `lqs_households` (leads) → `lqs_quotes` → `lqs_sales`, attributed to `lead_sources` (grouped by `marketing_buckets`) and `team_members` (salespeople). Spend tracked in `lead_source_monthly_spend`.

## Current Capabilities (What Works Well)

### Summary Dashboard (8 stat cards)
- Pipeline view (all-time): Open Leads, Quoted HH, Sold HH, Premium, Quote Rate, Close Rate, Total Spend, Overall ROI
- Activity view (date-filtered): Leads Received, Quotes Created, Sales Closed, same financial metrics
- Commission rate is configurable per agency (default 22%), saved to `agencies.default_commission_rate`

### Lead Source ROI Table (LqsRoiBucketTable)
- Hierarchical: marketing buckets → individual lead sources (expandable)
- Per-source metrics: spend, quoted HH/policies/items, written HH/policies/items
- Cost efficiency: cost per quoted HH, cost per quoted policy, cost per quoted item, HH acquisition cost, policy acquisition cost, item acquisition cost
- Clickable rows drill down to household-level detail

### Producer Breakdown (LqsProducerBreakdown)
- Two tabs: "Quoted By" (who created quotes) and "Sold By" (who closed sales)
- Per-producer: HH counts, policy/item counts, premium, close ratio, bundle ratio
- Clickable rows drill down to producer detail sheet with trend charts and household lists

### Visualizations
- **Conversion Funnel**: 3-stage proportional pyramid with rate arrows
- **ROI vs Spend Bubble Chart**: X=spend, Y=ROI, bubble size=premium, color=profitable/not
- **Performance Trend Chart**: 12-month line chart, switchable metric (premium/sales/leads/close rate/ROI), filterable by bucket
- **Same-Month Conversion**: Measures quote-to-sale velocity within calendar months

### Other Features
- Period Goals header with progress bars (daily targets x days in period)
- CSV export (summary by source + detail by household)
- Date presets: Last 30/60/90, Quarter, YTD, All Time, Custom Range
- "My Numbers" vs "Agency Wide" toggle on LQS Roadmap page

## Accuracy Issues Found

### 1. ~~Commission Rate Not Bucket-Aware~~ — RESOLVED (Not a Real Issue)
**Original concern**: `marketing_buckets.commission_rate_percent` exists but isn't used in ROI calculations.

**Decision**: The single agency-wide `default_commission_rate` is the correct approach. In insurance, commission rates are determined by carrier/product, not lead source. A Progressive auto policy pays the same commission whether the lead came from Facebook or direct mail. Per-bucket commission rates are the wrong abstraction and would make numbers *less* accurate.

**Action**: Remove `commission_rate_percent` from the marketing bucket create/edit UI and list display to avoid confusion. The column can stay in the DB (no migration needed) but should not be surfaced. No changes to ROI calculation logic.

**Files to clean up**: `src/components/lqs/MarketingBucketModal.tsx`, `src/components/lqs/MarketingBucketList.tsx`

### 2. Quote Rate Uses Wrong Populations
**Problem**: Quote Rate in activity view calculates `Unique Quoted Households (by quote_date) / Leads Received (by lead_received_date)`. These are independent populations — the numerator includes quotes for leads received in prior periods, and the denominator includes leads that haven't been quoted yet or were quoted later. The rate can exceed 100% and doesn't answer the question agencies actually ask.

**Impact**: The metric is misleading for any date range. It doesn't tell you "how well did we convert the leads we received?"

**Correct definition**: Quote Rate = (leads received in period that were also quoted in period) / (leads received in period). Both numerator and denominator are the **same cohort** of leads, bounded by the same date range.

**Example**: January 1–31, 50 EverQuote leads + 50 NetQuote leads = 100 total. Of those 100, 10 EverQuote and 10 NetQuote leads had a `first_quote_date` also in January. Quote Rate = 20% overall, 20% per source. A lead received Jan 25 but quoted Feb 5 does NOT count toward January's quote rate.

**Fix**: Change the calculation to start from leads received in the range, then check which of those leads also have `first_quote_date` within the same range. The "Quotes Created" activity count can stay as-is (quotes with `quote_date` in range) since it measures quoting activity volume — it's only the *rate* that needs the cohort-based logic.

**Files**: `src/hooks/useLqsRoiAnalytics.ts` — quote rate calculation (~line 778), and per-source quote rate logic

### 3. Spend Is Monthly Granularity, Dates Are Daily
**Problem**: `lead_source_monthly_spend` stores spend per calendar month. When the user picks "Jan 10 - Jan 20", the spend query includes the ENTIRE month of January. A 10-day view shows 30 days of spend, deflating ROI.

**Impact**: ROI is understated for any custom range that doesn't align to full calendar months. All downstream metrics (ROI, cost-per-lead, cost-per-acquisition) are affected.

**Fix**: Pro-rate partial months. When aggregating spend for a date range, for each month that partially overlaps the selected range, multiply: `monthSpend × (daysOverlapping / daysInMonth)`. Full months within the range use 100%. No date range (All Time) sums everything with no pro-rating (current behavior, already correct).

**Example**: User selects Jan 10–20. January has 31 days, 11 overlap. January spend is $3,100. Pro-rated: `$3,100 × (11/31) = $1,100`.

**Files**: `src/hooks/useLqsRoiAnalytics.ts` — spend aggregation logic (~lines 346-368, and wherever spend is summed per source)

## Enhancement Suggestions — Prioritized

### Tier 1: High Impact, Data Already Exists

#### A. Producer x Lead Source Cross-Tab
**What agencies want most**: "Which salesperson performs best with which lead source?" A matrix showing close rate and premium per producer x source combination. Answers: "Sarah closes 30% of internet leads but only 10% of direct mail — route internet leads to her."

**Data available**: `lqs_quotes.team_member_id` + `lqs_households.lead_source_id` + `lqs_sales.team_member_id`. All the joins exist.

**Implementation**: Pivot table on ROI page. Rows = producers, columns = lead sources (or buckets), cells = close rate + premium. Could also be a heatmap.

**Files**: New hook `useLqsProducerBySource.ts`, new component `LqsProducerSourceMatrix.tsx`

#### B. Time-to-Close Analytics
**What it answers**: "How long does it take to close after quoting?" and "Which sources have fastest sales cycles?"

**Data available**: `lqs_households.first_quote_date` and `lqs_households.sold_date` — the delta is the sales cycle. `lqs_sales.linked_quote_id` can identify which specific quote converted.

**Metrics to add**:
- Avg days quote-to-close (overall, by source, by producer)
- Distribution histogram (% closing in <7d, 7-14, 14-30, 30-60, 60+)
- "Stale quotes" alert: quoted households with no activity in 30+ days

#### C. Objection Analysis Dashboard
**What it answers**: "Why are we losing deals?" and "Are objection patterns changing?"

**Data available**: `lqs_households.objection_id` -> `lqs_objections.name`. Currently tracked but never surfaced in analytics.

**Metrics to add**:
- Objection frequency breakdown (pie/bar chart)
- Objection rate by lead source (some sources generate more price-sensitive leads)
- Objection rate by producer (coaching opportunity)
- Objection trend over time

#### ~~D. Bucket-Level Commission Rates in ROI~~ — DROPPED
Per-bucket commission rates are the wrong abstraction for insurance. Action: remove `commission_rate_percent` from bucket UI instead.

### Tier 2: Medium Impact, Moderate Build

#### E. Producer Leaderboard / Scorecard View
Dedicated view showing all producers side-by-side for a selected period:
- Leads assigned, quotes created, sales closed, premium written
- Quote rate, close rate, avg premium per sale
- Rank by each metric
- Sparkline trend (last 4 weeks or months)

This is the "look at my salespeople by month and say who's performing" view.

#### F. Lead Aging / Pipeline Health
- Leads older than X days without a quote -> "aging leads" count
- Quoted households older than X days without a sale -> "stale quotes" count
- Visual indicator (red/amber/green) on the main LQS roadmap
- Alert on ROI page: "47 leads over 30 days old without a quote"

#### G. Geographic Performance (ZIP Code Analysis)
- `zip_code` exists on every household but isn't analyzed
- Aggregate by ZIP prefix (first 3 digits = region): leads, quotes, sales, close rate
- Identify hot zones (high close rate) and cold zones (high spend, low conversion)

### Tier 3: Lower Priority, Future Vision

#### H. Self-Generated vs Paid ROI Comparison
- `lead_sources.is_self_generated` flag exists but isn't surfaced
- Simple split: paid ROI vs self-generated ROI
- Self-generated has $0 spend -> infinite ROI, but volume comparison is useful

#### I. Product Affinity / Cross-Sell Analysis
- Which product combinations are most common in bundled sales?
- Premium uplift when bundling Auto+Home vs Auto alone?
- Which producers are best at cross-selling?

#### J. Predictive Lead Scoring
- Based on historical data: source + ZIP + product interest -> probability of closing
- Flag "hot leads" on the roadmap for prioritization

## Unsurfaced Data (Exists in DB, Not in Analytics)

| Column/Table | Current State | Analytics Potential |
|---|---|---|
| `lqs_households.objection_id` | Tracked per household | Objection frequency, trends, by-source/producer |
| `lqs_households.zip_code` | Stored on every record | Geographic heatmap, regional performance |
| `lqs_sales.linked_quote_id` | Links sale to originating quote | Quote-to-sale timing, conversion attribution |
| `lead_sources.is_self_generated` | Boolean flag on sources | Paid vs organic comparison |
| `marketing_buckets.commission_rate_percent` | Per-bucket commission rate | Accurate per-bucket ROI |
| `lead_sources.cost_type` | per_lead/per_transfer/monthly/per_mailer | Cost model effectiveness comparison |
| `lqs_households.needs_attention` | Data quality flag | Data health dashboard |
| `lqs_households.contact_id` | Links to unified CRM contact | Cross-system lifecycle analytics |
| `lqs_households.products_interested` | Array of product types | Interest vs actual purchase analysis |

## Key Files Reference

| Area | Files |
|------|-------|
| **ROI Page** | `src/pages/LqsRoiPage.tsx` |
| **ROI Hook** | `src/hooks/useLqsRoiAnalytics.ts` |
| **Producer Breakdown** | `src/hooks/useLqsProducerBreakdown.ts`, `src/components/lqs/LqsProducerBreakdown.tsx` |
| **Producer Detail** | `src/hooks/useLqsProducerDetail.ts`, `src/components/lqs/LqsProducerDetailSheet.tsx` |
| **Lead Source Table** | `src/components/lqs/LqsRoiBucketTable.tsx` |
| **Lead Source Detail** | `src/hooks/useLqsLeadSourceDetail.ts`, `src/components/lqs/LqsLeadSourceDetailSheet.tsx` |
| **Performance Trend** | `src/hooks/useLqsPerformanceTrend.ts`, `src/components/lqs/LqsPerformanceTrendChart.tsx` |
| **Same-Month Conversion** | `src/hooks/useLqsSameMonthConversion.ts`, `src/components/lqs/LqsSameMonthConversion.tsx` |
| **Bubble Chart** | `src/components/lqs/LqsRoiSpendBubbleChart.tsx` |
| **Goals Header** | `src/components/lqs/LqsGoalsHeader.tsx` |
| **Main LQS Page** | `src/pages/LqsRoadmapPage.tsx` |
| **LQS Data Hook** | `src/hooks/useLqsData.ts` |
| **Matching Overhaul Spec** | `lqs_matching_overhaul_prompt.md` |

## Handoff Prompt

Use this to start a new context window:

```
Read `.claude/lqs-roi-analysis.md`. This contains a complete analysis of the LQS analytics system including 3 accuracy issues and 10 prioritized enhancement suggestions with file references.

Context: The LQS system tracks insurance lead -> quote -> sale funnels with attribution to marketing sources and salespeople. The ROI Analytics page (`/lqs/roi`) is the main analytics dashboard. The system is production and actively used.

Key accuracy issue to fix first: The ROI calculation uses a single agency-wide commission rate, but `marketing_buckets.commission_rate_percent` exists and should be used per-bucket. This affects all per-source ROI numbers.

Key feature to build first: Producer x Lead Source cross-tab — agencies want to see which salespeople perform best with which lead sources so they can optimize lead routing. All the data already exists in the DB.

[Then tell it what specific item(s) you want to work on]
```
