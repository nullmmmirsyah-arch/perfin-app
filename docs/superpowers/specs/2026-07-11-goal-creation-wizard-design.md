# Goal Creation Wizard Design

**Date:** 2026-07-11
**Status:** Approved
**Author:** opencode

## Overview

Redesign the goal creation flow from a plain form to an engaging step-by-step wizard with celebration animation. This improves UI/UX for mobile users and makes creating goals feel rewarding.

## Problem Statement

The current goal creation uses a shared CategoryDrawer which is:
- Plain and technical (just form fields)
- Not goal-specific (mixed with category creation)
- No celebration or feedback when goal is created
- Overwhelming with too many fields at once

## Solution

Create a dedicated `GoalWizardDrawer` with 4 steps and confetti celebration.

## Design

### Step Indicator

```
┌─────────────────────────────────────┐
│  Step 1 of 4         ●○○○          │
│  Choose Goal Type                   │
└─────────────────────────────────────┘
```

- Shows current step number and total steps
- 4 dots representing progress (filled = completed, current = active, empty = future)
- Step title below the dots
- Back button (←) to return to previous step
- Close button (×) to exit wizard (with unsaved changes warning)

### Step 1: Choose Goal Type

**Layout:** 3 visual cards stacked vertically (full width on mobile)

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────────┐│
│  │  🛡️  Investment (Wealth)        ││
│  │  Long-term accumulation for     ││
│  │  financial security             ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │  📅  Bill (Sinking Fund)        ││
│  │  Recurring obligations like     ││
│  │  annual tax or insurance        ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │  ✨  Purchase (Wishlist)        ││
│  │  One-off purchases like         ││
│  │  vacation or gadgets            ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Card Design:**
- Each card has: icon, title, description
- Selected state: border-primary, bg-primary/5
- Tap to select, auto-advance to next step after 300ms delay

### Step 2: Name & Target

**Layout:** Two input fields with clear labels

```
┌─────────────────────────────────────┐
│  Goal Name                          │
│  ┌─────────────────────────────────┐│
│  │ e.g., Emergency Fund            ││
│  └─────────────────────────────────┘│
│                                     │
│  Target Amount                      │
│  ┌─────────────────────────────────┐│
│  │ Rp 50,000,000                   ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Behavior:**
- Name field: text input, auto-focused on step entry
- Amount field: numeric input with live formatting (adds commas as user types)
- Amount shows "Rp" prefix (Indonesian locale)
- Validation: Name required, Amount must be > 0
- "Next" button disabled until both fields are valid

### Step 3: Timeline & Contribution

**Layout:** Date picker + monthly contribution calculator

```
┌─────────────────────────────────────┐
│  Target Date (Optional)             │
│  ┌─────────────────────────────────┐│
│  │ 📅 Select date...               ││
│  └─────────────────────────────────┘│
│                                     │
│  Monthly Contribution               │
│  ┌─────────────────────────────────┐│
│  │ Rp 2,000,000                    ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 💡 With this amount, you'll     ││
│  │ reach your goal in 25 months    ││
│  │ (by Dec 2026)                   ││
│  │                                 ││
│  │ 👉 Set date to Dec 2026         ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Behavior:**
- Date picker: Optional, uses existing DatePicker component
- Monthly contribution: Numeric input with live formatting
- **Smart Calculator:** Shows projected completion date based on:
  - Target amount - Current amount (0 for new goals) = Remaining
  - Remaining / Monthly contribution = Months needed
  - Display: "You'll reach your goal in X months (by Month Year)"
- **Quick Actions:** If date is set, calculate required monthly and show "Apply" button
- **Feedback Colors:**
  - Blue: "You'll finish early!" (contribution higher than needed)
  - Primary: "Perfect pace" (contribution matches needed)
  - Amber: "Will take longer" (contribution lower than needed)

### Step 4: Review & Create

**Layout:** Summary card + create button

```
┌─────────────────────────────────────┐
│  Review Your Goal                   │
│  ┌─────────────────────────────────┐│
│  │  🛡️ Investment                  ││
│  │                                 ││
│  │  Emergency Fund                 ││
│  │                                 ││
│  │  Target: Rp 50,000,000         ││
│  │  Due: Dec 2026                 ││
│  │  Monthly: Rp 2,000,000         ││
│  │                                 ││
│  │  ────────────────────────────  ││
│  │  You'll reach your goal in     ││
│  │  25 months                     ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │      🎉 Create Goal             ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Behavior:**
- Shows all selected options in a clean summary card
- "Create Goal" button triggers:
  1. Create category (saving type)
  2. Create linked account
  3. If auto-save enabled: create schedule
  4. **Confetti animation** (using canvas-confetti library)
  5. **Success sound** (short chime, ~1 second)
  6. Show success message: "Goal created! You're on your way to [goal name]! 🎉"
  7. Close wizard after 2 seconds (or tap to close immediately)

### Celebration Details

- **Confetti Colors:** Match goal type
  - Investment: Blue shades
  - Bill: Green shades
  - Purchase: Purple shades
- **Sound:** Short, satisfying chime (not annoying)
- **Message:** Personalized with goal name
- **Auto-close:** 2 seconds delay to let user see the celebration

### Edit Mode

- When editing an existing goal, the wizard opens with pre-filled data
- Same steps, but title changes to "Edit Goal"
- No celebration on edit (only on create)
- Auto-save toggle shows existing schedule status

## Technical Implementation

### New Components

```
components/
├── GoalWizardDrawer.tsx (main container)
├── GoalWizardStepIndicator.tsx
├── GoalWizardSteps/
│   ├── GoalTypeStep.tsx
│   ├── GoalNameTargetStep.tsx
│   ├── GoalTimelineStep.tsx
│   └── GoalReviewStep.tsx
└── hooks/
    └── useGoalWizard.ts (state management)
```

### Files to Modify

1. `app/goals/page.tsx` - Change "Add Goal" to open GoalWizardDrawer
2. Keep CategoryDrawer for categories only (remove goal creation from it)

### State Management

Use a custom hook `useGoalWizard` to manage:
- Current step
- Form data (goalType, name, targetAmount, targetDate, monthlyContribution)
- Validation state
- Auto-save settings

```typescript
// hooks/useGoalWizard.ts
interface GoalWizardState {
  currentStep: number;
  goalType: 'investment' | 'bill' | 'purchase' | null;
  name: string;
  targetAmount: string;
  targetDate: Date | undefined;
  monthlyContribution: string;
  enableAutoSave: boolean;
  autoSaveSourceAccountId: string;
  autoSaveAmount: string;
}
```

### Backend Integration

Reuse existing mutations:
1. `api.categories.create` - Create the saving category
2. `api.accounts.create` - Create linked account
3. `api.automations.upsertSchedule` - Create auto-save schedule (if enabled)

### Dependencies

Add `canvas-confetti` for celebration animation:
```bash
npm install canvas-confetti
```

### Form Validation

Use existing zod schema, validate per step:
- Step 1: goalType required
- Step 2: name required, targetAmount > 0
- Step 3: No required fields (all optional)
- Step 4: No validation (review only)

## Success Metrics

1. **Completion Rate:** % of users who complete the wizard after starting
2. **Time to Create:** Average time to create a goal (should decrease)
3. **Goal Creation Rate:** Increase in new goals created per user
4. **User Feedback:** Qualitative feedback on the new flow

## Out of Scope

- Goal templates (pre-built goals)
- Goal sharing/household collaboration enhancements
- Goal notifications/reminders
- Goal analytics/dashboard

## Future Enhancements

1. **Goal Templates:** Pre-built goals like "Emergency Fund (3-6 months)"
2. **Goal Milestones:** Celebrate 25%, 50%, 75% progress
3. **Goal Recommendations:** AI-powered suggestions based on spending
4. **Goal Timeline View:** Visual timeline of all goals
