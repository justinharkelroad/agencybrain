

## Onboarding Discovery Slide Decks

Three standalone full-screen presentation pages -- one each for **Prospects**, **Customers**, and **Team Members** -- designed to be used during live agency consultations. Each page shares the same layout and interactive elements, differing only in headline text and floating questions.

---

### What Each Page Includes

1. **Countdown Timer (3:00)** -- A large, visible countdown clock starting at 3:00. A play/pause button controls it. When it hits 0:00, it flashes or pulses to signal time's up. The timer sits at the top-right corner so it's visible but not distracting.

2. **Centered Headline** -- Two-line treatment:
   - Line 1: `HOW DO WE ONBOARD:` in `marketing-text` (white)
   - Line 2: The category word (e.g., `PROSPECTS`) in large, bold `marketing-amber` gradient text using the existing `GradientText` component

3. **Floating Animated Questions** -- 8-9 questions per page that fade in at random positions around the headline, linger for a few seconds, then fade out. They loop continuously. Uses framer-motion `AnimatePresence` with staggered timing so 2-3 questions are visible at any given moment. Text is styled in `marketing-text-muted` with a subtle glow.

4. **Dark Background** -- Uses `marketing-bg` with subtle radial gradient blurs (amber/cyan) matching the existing marketing page aesthetic.

---

### Routes

| Page | Route | Highlight Word |
|------|-------|---------------|
| Prospects | `/slides/prospects` | PROSPECTS |
| Customers | `/slides/customers` | CUSTOMERS |
| Team Members | `/slides/team-members` | TEAM MEMBERS |

---

### Floating Questions Content

**Prospects:**
- How do you make sure your team is following up?
- What is your follow-up process?
- How fast do you get to your potential leads?
- How do you assign your leads to your sales team?
- Who's responsible to make sure the process is being done?
- How do you track the effectiveness of your team?
- Do you have people who are more consistent than others inside of converting new prospects to households?
- How do you train on the front end to convert leads to quotes?

**Customers:**
- What does the onboarding process look like?
- Who handles the onboarding process?
- How do you make sure it's being done as you require?
- What things do you make sure are on those calls?
- Do you ask for referrals at this time?
- Is this a good point for an EFS transition?
- Is it the sales team member who handles this stuff?
- Do you have a system built out to make sure it's being done?
- Is anything pre-scheduled during onboarding?

**Team Members:**
- What is the ideal timeline to have someone onboarded in either sales or service?
- Do you have training mapped out so people know exactly what to do and when to do it?
- Who's responsible for seeing a new member through training?
- Has your past process been effective?
- How do you know your onboarding is successful?
- Are there clear frameworks for them to understand what's important and what to focus on?
- How often do you revamp your training based upon new processes?
- What do you feel like someone coming out of training should be perfectly prepared for?
- Do you use specific software to track training modules?

---

### Technical Details

**New files to create:**

1. **`src/components/slides/CountdownTimer.tsx`** -- Reusable countdown component with play/pause/reset controls. Uses `useState` and `useEffect` with `setInterval`. Styled with `font-mono` and marketing theme colors. Pulses when reaching zero.

2. **`src/components/slides/FloatingQuestions.tsx`** -- Takes an array of question strings. Manages a queue, showing 2-3 at a time at randomized positions (using absolute positioning with percentage-based top/left). Each question fades in, holds, fades out via framer-motion. Loops infinitely.

3. **`src/components/slides/OnboardingSlide.tsx`** -- Shared layout component accepting `category` (string) and `questions` (string array). Composes the countdown timer, headline with `GradientText`, and floating questions over the dark background with gradient blurs.

4. **`src/pages/slides/SlidesProspects.tsx`** -- Renders `OnboardingSlide` with Prospects data.

5. **`src/pages/slides/SlidesCustomers.tsx`** -- Renders `OnboardingSlide` with Customers data.

6. **`src/pages/slides/SlidesTeamMembers.tsx`** -- Renders `OnboardingSlide` with Team Members data.

**Files to modify:**

7. **`src/App.tsx`** (or router config) -- Add three new public routes for `/slides/prospects`, `/slides/customers`, `/slides/team-members`.

These pages are standalone (no nav bar, no footer) -- full-screen presentation mode designed to be shown during live meetings.

