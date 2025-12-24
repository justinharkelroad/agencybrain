# AgencyBrain Design System

> **Version:** 1.0  
> **Last Updated:** December 2024

---

## Brand Overview

| Property | Value |
|----------|-------|
| **Company Name** | Agency Brain |
| **Logo URL** | `https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/agency-logos/ab-logo-light.png` |
| **Primary Domain** | agencybrain.standardplaybook.com |

---

## Color Palette

### Primary Colors

| Name | Hex | HSL | RGB | Usage |
|------|-----|-----|-----|-------|
| **Primary Blue** | `#6B9EF3` | `217 84% 69%` | `107, 158, 243` | Primary actions, links, CTAs |
| **Secondary Navy** | `#171A2F` | `232 33% 14%` | `23, 26, 47` | Dark backgrounds, headers |
| **Background** | `#FFFFFF` | `0 0% 100%` | `255, 255, 255` | Page backgrounds |
| **Foreground** | `#000000` | `0 0% 0%` | `0, 0, 0` | Primary text |

### UI/Semantic Colors

| Name | HSL | Hex | Usage |
|------|-----|-----|-------|
| **Success** | `142 71% 45%` | `#22c55e` | Success states, confirmations |
| **Warning** | `38 92% 50%` | `#f59e0b` | Warnings, caution states |
| **Destructive** | `0 84.2% 60.2%` | `#ef4444` | Errors, delete actions |
| **Muted** | `210 40% 96.1%` | `#f1f5f9` | Muted backgrounds |
| **Muted Foreground** | `215.4 16.3% 46.9%` | `#64748b` | Secondary text |

### Data Visualization Colors

| Metric | Hex | Usage |
|--------|-----|-------|
| **Outbound Calls** | `#ef4444` | Red - call metrics |
| **Talk Minutes** | `#3b82f6` | Blue - time metrics |
| **Quoted Households** | `#f59e0b` | Orange - quote metrics |
| **Items Sold** | `#22c55e` | Green - sales metrics |
| **Cross-sells Uncovered** | `#a855f7` | Purple - opportunity metrics |
| **Mini-reviews** | `#10b981` | Emerald - review metrics |

### Dark Mode Colors

| Element | HSL Value |
|---------|-----------|
| **Background** | `222.2 84% 4.9%` |
| **Foreground** | `210 40% 98%` |
| **Card** | `222.2 84% 4.9%` |
| **Muted** | `217.2 32.6% 17.5%` |

---

## Typography

### Font Stack

```css
--font-primary: 'Roboto', sans-serif;
```

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| **Regular** | 400 | Body text |
| **Medium** | 500 | Emphasis, labels |
| **Semibold** | 600 | Subheadings |
| **Bold** | 700 | Headings, strong emphasis |

### Type Scale (Tailwind)

| Class | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 0.75rem | 1rem | Captions, labels |
| `text-sm` | 0.875rem | 1.25rem | Secondary text |
| `text-base` | 1rem | 1.5rem | Body text |
| `text-lg` | 1.125rem | 1.75rem | Large body |
| `text-xl` | 1.25rem | 1.75rem | H4 headings |
| `text-2xl` | 1.5rem | 2rem | H3 headings |
| `text-3xl` | 1.875rem | 2.25rem | H2 headings |
| `text-4xl` | 2.25rem | 2.5rem | H1 headings |

---

## Spacing & Layout

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.75rem` | Default border radius |
| `rounded-sm` | `calc(var(--radius) - 4px)` | Small elements |
| `rounded-md` | `calc(var(--radius) - 2px)` | Medium elements |
| `rounded-lg` | `var(--radius)` | Large elements, cards |

### Spacing Scale

| Class | Value | Pixels |
|-------|-------|--------|
| `space-1` | 0.25rem | 4px |
| `space-2` | 0.5rem | 8px |
| `space-3` | 0.75rem | 12px |
| `space-4` | 1rem | 16px |
| `space-6` | 1.5rem | 24px |
| `space-8` | 2rem | 32px |

---

## Email & PDF Branding

| Property | Value |
|----------|-------|
| **Primary** | `#1e283a` |
| **Secondary** | `#020817` |
| **Gray** | `#60626c` |
| **Error Red** | `#af0000` |
| **Success Green** | `#22c55e` |
| **Light Background** | `#f1f5f9` |
| **From Email** | `Agency Brain <info@agencybrain.standardplaybook.com>` |

---

## Component Styling

### Buttons

```tsx
// Primary Button
<Button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Primary Action
</Button>

// Secondary Button
<Button variant="secondary" className="bg-secondary text-secondary-foreground">
  Secondary Action
</Button>

// Destructive Button
<Button variant="destructive" className="bg-destructive text-destructive-foreground">
  Delete
</Button>

// Ghost Button
<Button variant="ghost">
  Ghost Action
</Button>
```

### Cards

```tsx
<Card className="bg-card text-card-foreground border border-border rounded-lg shadow-sm">
  <CardHeader>
    <CardTitle className="text-foreground">Card Title</CardTitle>
    <CardDescription className="text-muted-foreground">
      Card description text
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Inputs

```tsx
<Input 
  className="bg-background border-input text-foreground placeholder:text-muted-foreground rounded-md"
  placeholder="Enter value..."
/>
```

---

## CSS Variables Reference

```css
:root {
  /* Primary Colors */
  --primary: 217 84% 69%;
  --primary-foreground: 0 0% 100%;
  
  /* Secondary Colors */
  --secondary: 232 33% 14%;
  --secondary-foreground: 0 0% 100%;
  
  /* Background & Foreground */
  --background: 0 0% 100%;
  --foreground: 0 0% 0%;
  
  /* Card */
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  
  /* Muted */
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  
  /* Accent */
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  
  /* Destructive */
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  
  /* Border & Input */
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  
  /* Border Radius */
  --radius: 0.75rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
}
```

---

## Logo Usage Guidelines

### Clear Space
Maintain minimum clear space around the logo equal to the height of the "A" in "Agency".

### Minimum Size
- **Digital:** 120px width minimum
- **Print:** 1 inch width minimum

### Logo Variations
| Context | File |
|---------|------|
| **Light backgrounds** | `ab-logo-light.png` |
| **Dark backgrounds** | `ab-logo-dark.png` (if available) |

---

## Implementation Notes

1. **Always use CSS variables** - Never hardcode colors directly
2. **Use semantic tokens** - `bg-primary` not `bg-[#6B9EF3]`
3. **Respect dark mode** - All components should work in both themes
4. **Consistent spacing** - Use Tailwind spacing scale
5. **Accessible contrast** - Maintain WCAG AA compliance

---

*This document serves as the single source of truth for AgencyBrain's design system.*
