

# Add Premium Branding Header to Video Training Architect Exports

## Overview

Add an elegant, professional branding header to the top of all Video Training Architect PDF and PNG exports. This header will clearly identify Agency Brain as the producer while promoting The Standard Playbook as the exclusive source.

---

## Visual Design Specification

### Header Layout (Top of Export)

```text
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│         ╭──────────────────────────────────────────────╮           │
│         │                                              │           │
│         │            Produced By                       │           │
│         │        (elegant cursive font)                │           │
│         │                                              │           │
│         │       [AGENCY BRAIN LOGO IMAGE]              │           │
│         │                                              │           │
│         │   ─────────── ✦ ───────────                  │           │
│         │                                              │           │
│         │   Exclusively through The Standard Playbook  │           │
│         │          (small muted text)                  │           │
│         │                                              │           │
│         ╰──────────────────────────────────────────────╯           │
│                                                                     │
│  ═══════════════════════════════════════════════════════════════   │
│              (subtle gradient divider line)                        │
│                                                                     │
│                    [ EXISTING CONTENT BELOW ]                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Design Elements

| Element | Style Details |
|---------|---------------|
| **"Produced By"** | Dancing Script (Google Font), 22px, italic feel, soft purple/violet gradient or muted white with subtle glow |
| **Agency Brain Logo** | Official logo from storage (48-60px height), centered below the cursive text |
| **Decorative Divider** | Small star/diamond (✦) with thin lines extending left and right |
| **Exclusivity Tagline** | "Exclusively through The Standard Playbook", 10px, uppercase, letter-spacing: 0.15em, very muted color |
| **Bottom Separator** | Subtle gradient line (fades from transparent → accent color → transparent) to divide from content |

### Color Palette (matching existing dark theme)

| Element | Color |
|---------|-------|
| "Produced By" text | `#a78bfa` (violet-400) or subtle gradient |
| Logo | Original colors (neutral) |
| Divider star | `#6366f1` (indigo-500) |
| Divider lines | `#334155` (slate-700) |
| Tagline | `#475569` (slate-600) |
| Background | Same as card (`#0f172a`) |

---

## Technical Implementation

### Step 1: Add Google Font Import

**File:** `src/index.css`

Add Dancing Script font for the elegant cursive "Produced By" text:

```css
@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;600&display=swap');
```

### Step 2: Create Reusable Branding Header Component

**New File:** `src/components/tools/ExportBrandingHeader.tsx`

A pure inline-styled component (for html-to-image compatibility) that renders the branding header:

- "Produced By" in Dancing Script cursive
- Agency Brain logo image (fetched and embedded)
- Decorative star divider
- "Exclusively through The Standard Playbook" tagline
- Bottom gradient separator

### Step 3: Update LearningCycleReportCard.tsx

**File:** `src/components/tools/LearningCycleReportCard.tsx`

Insert the `ExportBrandingHeader` component at the top of the `reportRef` div (before the existing title header).

**Location:** Inside `<div ref={reportRef}>`, at line ~204, before the "Title Header" section.

### Step 4: Update LeaderBlueprintReportCard.tsx

**File:** `src/components/tools/LeaderBlueprintReportCard.tsx`

Insert the same `ExportBrandingHeader` component at the top of the `reportRef` div (before the existing header).

**Location:** Inside `<div ref={reportRef}>`, at line ~264, before the "Header" section.

---

## Component Implementation Details

### ExportBrandingHeader.tsx Structure

```tsx
const LOGO_URL = "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/Agency%20Brain%20Logo%20Stan.png";

const COLORS = {
  cursive: '#c4b5fd',        // violet-300 for elegance
  star: '#818cf8',           // indigo-400
  dividerLine: '#334155',    // slate-700
  tagline: '#64748b',        // slate-500
};

export function ExportBrandingHeader() {
  return (
    <div style={{ textAlign: 'center', paddingBottom: '24px', marginBottom: '24px' }}>
      {/* "Produced By" in cursive */}
      <p style={{ 
        fontFamily: "'Dancing Script', cursive",
        fontSize: '24px',
        fontWeight: 500,
        color: COLORS.cursive,
        margin: 0,
        marginBottom: '12px'
      }}>
        Produced By
      </p>
      
      {/* Agency Brain Logo */}
      <img 
        src={LOGO_URL}
        alt="Agency Brain"
        style={{ height: '48px', margin: '0 auto 16px' }}
      />
      
      {/* Decorative divider with star */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{ width: '60px', height: '1px', background: `linear-gradient(to right, transparent, ${COLORS.dividerLine})` }} />
        <span style={{ color: COLORS.star, fontSize: '10px' }}>✦</span>
        <div style={{ width: '60px', height: '1px', background: `linear-gradient(to left, transparent, ${COLORS.dividerLine})` }} />
      </div>
      
      {/* Exclusivity tagline */}
      <p style={{
        fontSize: '10px',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: COLORS.tagline,
        margin: 0
      }}>
        Exclusively through The Standard Playbook
      </p>
    </div>
  );
}
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/index.css` | Add Dancing Script font import |
| `src/components/tools/ExportBrandingHeader.tsx` | **Create** new component |
| `src/components/tools/LearningCycleReportCard.tsx` | Import and add header to export area |
| `src/components/tools/LeaderBlueprintReportCard.tsx` | Import and add header to export area |

---

## Expected Result

When users export a Learning Cycle or Leader Blueprint as PNG/PDF:

1. The top of the image will feature an elegant "Produced By" in flowing cursive script
2. The Agency Brain logo will be prominently displayed below
3. A decorative star divider adds visual polish
4. "Exclusively through The Standard Playbook" appears in small, professional uppercase text
5. A subtle separator line transitions into the existing content

This creates a professional, shareable asset that clearly attributes the tool to Agency Brain while promoting The Standard Playbook brand.

