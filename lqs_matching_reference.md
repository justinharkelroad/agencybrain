# LQS Matching Capabilities - Complete Reference

## All Available Matching Fields

| Field | Leads | Quotes | Sales | Reliability | Use? |
|-------|-------|--------|-------|-------------|------|
| First Name | ✓ | ✓ | ✓ (parsed) | Medium | ✓ Part of household key |
| Last Name | ✓ | ✓ | ✓ (parsed) | Medium | ✓ Part of household key |
| ZIP Code | ✓ | ✓ | ✗ | High | ✓ Part of household key |
| Phone | ✓ | ✗ | ✗ | High | ✗ Not available in quotes/sales |
| Email | ✓ | ✗ | ✗ | High | ✗ Not available in quotes/sales |
| Address | ✓ | ✓ | ✗ | High | ✗ Not available in sales |
| **Policy Number** | ✗ | ✓ | ✓ | **100%** | **✓ PRIMARY Quote→Sale link** |
| Sub-Producer Code | ✗ | ✓ | ✓ | High | ✓ Scoring factor (+35) |
| Product Type | ✗ | ✓ | ✓ | Medium | ✓ Scoring factor (+40) |
| Premium | ✗ | ✓ | ✓ | Medium | ✓ Scoring factor (+25) |
| Date | ✓ | ✓ | ✓ | Low | ✓ Validation factor (+10) |
| State | ✗ | ✓ | ✗ | Low | ✗ Not useful without ZIP |

---

## Matching Hierarchy

### Level 1: Lead → Quote (LASTNAME_FIRSTNAME_ZIP)
```
Confidence: HIGH
Method: Exact household key match
Fallback: None (create new household if no match)
```

### Level 2: Quote → Sale (POLICY NUMBER)
```
Confidence: 100%
Method: Issued Policy # = Policy No
Fallback: Name + Scoring (see below)
```

### Level 3: Quote → Sale Fallback (NAME + SCORING)
```
Confidence: MEDIUM (requires manual review unless clear winner)
Method: Exact last name + scoring system
Scoring:
  - Product match: +40
  - Sub-producer match: +35
  - Premium ±15%: +25
  - Quote before sale: +10
  
Auto-match if: 1 candidate OR (score >= 75 AND 20+ pt lead)
Manual review if: Multiple candidates without clear winner
```

### Level 4: Orphan Sales (ONE-CALL CLOSE)
```
Confidence: N/A (no match attempted)
Method: Create new household
Fields set: lead_date = quote_date = sold_date = sale_date
Lead source: "Direct/Unknown"
```

---

## What We're NOT Using (And Why)

| Method | Why Not |
|--------|---------|
| First Initial Matching | Produces false positives (MELISSA→MICHELLE) |
| "Name Contains" Matching | Too loose, matches partial names incorrectly |
| Direct Lead→Sale Matching | Without ZIP on sales, unreliable |
| Phone/Email Matching | Not available in quote/sale reports |
| Address Matching | Not available in sales report |
| State-Only Matching | Too broad, meaningless without other fields |

---

## Report Recommendations

### USE THESE:
| Report | Purpose | Key Fields |
|--------|---------|------------|
| **Lead Management Lab CSV** | Leads | First, Last, ZIP, Phone, Email |
| **Quotes Detail & Conversion** | Quotes | First, Last, ZIP, Issued Policy #, Sub Producer |
| **New Business Details** | Sales | Customer Name, Policy No, Sub Producer, Premium |

### SKIP THESE:
| Report | Why Skip |
|--------|----------|
| Agent Transaction Detail | Too granular (line-item level), no useful PII |
| Quotes Detail Report | Subset of Quotes Detail & Conversion, fewer fields |

---

## Edge Cases to Handle

1. **Multiple policies per household**: A household might have Auto + Home quotes. Match each sale to the correct quote by product type.

2. **Same-day quote and sale**: If quote_date = sale_date, still valid. This is a "one-call close" where the quote converted immediately.

3. **Quote without ZIP**: Use NOZIP in household key to prevent incorrect merging. Flag for attention.

4. **Common surnames without ZIP**: SMITH, JONES, JOHNSON, WILLIAMS - require policy number match or manual review. Never auto-match on name alone.

5. **Middle name variations**: "ROBERT K WILSON" vs "ROBERT WILSON" - extract first word as first name, last word as last name. Middle initials ignored.

6. **Hyphenated names**: "PIERCE-TAYLOR" should stay as-is in last name field.

---

## Confidence Levels

| Match Type | Confidence | Action |
|------------|------------|--------|
| Policy Number | 100% | Auto-match |
| Household Key (with ZIP) | 95% | Auto-match |
| Name + Score ≥75 + 20pt lead | 80% | Auto-match |
| Name + Score ≥75, no clear lead | 60% | Manual review |
| Name only (no ZIP, no score) | 30% | Manual review |
| First initial only | 10% | **DO NOT MATCH** |
