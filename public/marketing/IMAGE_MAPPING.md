# Marketing Landing Page - Image Mapping Guide

This document shows exactly which images appear where on the marketing landing page.
All paths are relative to the `public/` folder.

---

## HERO SECTION
Location: Top of page, main visual

| Slot | Current Image | Recommended Size | Notes |
|------|---------------|------------------|-------|
| Main mockup (left) | `/promo-images/Dashboard1.png` | 1200x750 (16:10) | Primary dashboard view |
| Secondary mockup (right) | `/promo-images/Callscoring1.png` | 800x600 (4:3) | Smaller, rotated slightly |

---

## BENTO FEATURE GRID
Location: Features section, 8 cards in varying sizes

### Large Card (spans 2 columns, 2 rows)
| Feature | Image Path | Recommended Size | Notes |
|---------|-----------|------------------|-------|
| AI Call Scoring | `/promo-images/Callscoring2.png` | **Portrait: 600x800** or taller | This card is TALL - use vertical/portrait image |

### Medium Cards (spans 2 columns, 1 row)
| Feature | Image Path | Recommended Size | Notes |
|---------|-----------|------------------|-------|
| AI Role-Play Bot | `/promo-images/AiRoleplay.png` | 800x400 (2:1 landscape) | Wider, shorter |
| Real-Time Scorecard | `/promo-images/Metrics1.png` | 800x400 (2:1 landscape) | Wider, shorter |
| Training Platform | `/promo-images/AgencyTraining1.png` | 800x400 (2:1 landscape) | Wider, shorter |

### Small Cards (1 column, 1 row) - NO IMAGES
- Winback HQ
- Sales Analytics
- Cancel Audit
- Core 4

---

## FEATURE SHOWCASE (Deep Dives)
Location: Full-width sections with large screenshots

| Feature | Image Path | Recommended Size | Notes |
|---------|-----------|------------------|-------|
| AI Call Scoring | `/promo-images/Callscoring3.png` | 1200x900 (4:3) | Detailed call scoring view |
| AI Role-Play Bot | `/promo-images/AiRoleplay.png` | 1200x900 (4:3) | Role-play interface |
| Real-Time Scorecard | `/promo-images/Metrics2.png` | 1200x900 (4:3) | Metrics/scorecard view |

---

## STAN MASCOT IMAGES
Location: Various sections for personality

| Slot | Image Path | Current Status |
|------|-----------|----------------|
| Hero (left side) | `/marketing/stan-waving.png` | ✅ Ready |
| Feature Showcase header | `/marketing/stan-pointing.png` | ✅ Ready |
| Pricing (corner) | `/marketing/stan-thinking.png` | ✅ Ready |
| Final CTA (center) | `/marketing/stan-waving.png` | ✅ Ready |

---

## HOW TO REPLACE IMAGES

1. **Create your new image** at the recommended size
2. **Save it to** `public/promo-images/` (or `public/marketing/` for Stan)
3. **Update the path** in the component file if using a different filename

### Files to edit for each section:

| Section | File to Edit |
|---------|--------------|
| Hero | `src/components/marketing/HeroSection.tsx` (lines 7-8) |
| Bento Grid | `src/components/marketing/BentoFeatureGrid.tsx` (screenshot property in features array) |
| Feature Showcase | `src/components/marketing/FeatureShowcase.tsx` (screenshot property in features array) |

---

## AVAILABLE PROMO IMAGES

These are already in `/public/promo-images/`:

**Dashboards:**
- Dashboard1.png, Dashboard2.png, Dashboard3.png, Dashboard4.png
- Dashboard5.png, Dashboard6.png, Dashboard7.png

**Call Scoring:**
- Callscoring1.png, Callscoring2.png, Callscoring3.png

**Training:**
- AgencyTraining1.png, AgencyTraining2.png
- Standard Training1.png, Standard Training2.png, Standard Training3.png

**Metrics/Analytics:**
- Metrics1.png, Metrics2.png
- SalesAnalytics.png
- LQS1.png, LQS2.png

**Features:**
- AiRoleplay.png
- WinbackHQ.png
- Cancel Audit.png, Cancel Audit2.png
- Core4.png
- Quarterly Targets.png
- Flows1.png, Flows2airesponse.png
- Monthly Mission1.png

**Other:**
- Comp1.png, Comp2.png
- Sidebar.png
- Share Exchange.png
- AGENCYBRAIN LOGO FINAL.png
