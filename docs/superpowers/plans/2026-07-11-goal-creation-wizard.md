# Goal Creation Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain goal creation form with an engaging 4-step wizard drawer with confetti celebration.

**Architecture:** Create a new `GoalWizardDrawer` component with step-by-step flow, reusing existing form patterns and utilities. Add `canvas-confetti` for celebration animation.

**Tech Stack:** React, Convex, shadcn/ui (Drawer, Form, Input, Select, DatePicker), zod, canvas-confetti, framer-motion

---

## File Structure

```
components/
├── GoalWizardDrawer.tsx (main container + state)
├── GoalWizardStepIndicator.tsx (step progress UI)
├── GoalWizardSteps/
│   ├── GoalTypeStep.tsx (step 1: choose type)
│   ├── GoalNameTargetStep.tsx (step 2: name + amount)
│   ├── GoalTimelineStep.tsx (step 3: date + contribution)
│   └── GoalReviewStep.tsx (step 4: review + create)

hooks/
└── useGoalWizard.ts (wizard state management)

app/goals/page.tsx (modify: use GoalWizardDrawer)
```

---

### Task 1: Install canvas-confetti dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install canvas-confetti**

```bash
npm install canvas-confetti
```

- [ ] **Step 2: Install TypeScript types**

```bash
npm install -D @types/canvas-confetti
```

- [ ] **Step 3: Verify installation**

```bash
npm list canvas-confetti
```

Expected: `canvas-confetti@x.x.x`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add canvas-confetti for goal celebration"
```

---

### Task 2: Create useGoalWizard hook

**Files:**
- Create: `hooks/useGoalWizard.ts`

- [ ] **Step 1: Create the hook with wizard state**

```typescript
import { useState, useCallback } from 'react';

export type GoalType = 'investment' | 'bill' | 'purchase';

export interface GoalWizardState {
  currentStep: number;
  goalType: GoalType | null;
  name: string;
  targetAmount: string;
  targetDate: Date | undefined;
  monthlyContribution: string;
  enableAutoSave: boolean;
  autoSaveSourceAccountId: string;
  autoSaveAmount: string;
  autoSaveFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  autoSaveDay: string;
}

const TOTAL_STEPS = 4;

const initialState: GoalWizardState = {
  currentStep: 1,
  goalType: null,
  name: '',
  targetAmount: '',
  targetDate: undefined,
  monthlyContribution: '',
  enableAutoSave: false,
  autoSaveSourceAccountId: '',
  autoSaveAmount: '',
  autoSaveFrequency: 'monthly',
  autoSaveDay: '25',
};

export function useGoalWizard() {
  const [state, setState] = useState<GoalWizardState>(initialState);
  const [isDirty, setIsDirty] = useState(false);

  const setStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, currentStep: Math.max(1, Math.min(step, TOTAL_STEPS)) }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({ ...prev, currentStep: Math.min(prev.currentStep + 1, TOTAL_STEPS) }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({ ...prev, currentStep: Math.max(prev.currentStep - 1, 1) }));
  }, []);

  const updateField = useCallback(<K extends keyof GoalWizardState>(
    field: K,
    value: GoalWizardState[K]
  ) => {
    setState(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
    setIsDirty(false);
  }, []);

  const canProceed = useCallback(() => {
    switch (state.currentStep) {
      case 1: return state.goalType !== null;
      case 2: return state.name.trim().length > 0 && parseFloat(state.targetAmount.replace(/,/g, '')) > 0;
      case 3: return true; // All fields optional
      case 4: return true; // Review step
      default: return false;
    }
  }, [state]);

  return {
    state,
    isDirty,
    setStep,
    nextStep,
    prevStep,
    updateField,
    reset,
    canProceed,
    totalSteps: TOTAL_STEPS,
  };
}
```

- [ ] **Step 2: Verify hook compiles**

```bash
npm run build --webpack
```

Expected: No TypeScript errors in new file

- [ ] **Step 3: Commit**

```bash
git add hooks/useGoalWizard.ts
git commit -m "feat: add useGoalWizard hook for wizard state"
```

---

### Task 3: Create GoalWizardStepIndicator component

**Files:**
- Create: `components/GoalWizardStepIndicator.tsx`

- [ ] **Step 1: Create the step indicator component**

```tsx
import { cn } from '@/lib/utils';
import { ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GoalWizardStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  onBack: () => void;
  onClose: () => void;
  showBack?: boolean;
}

const stepTitles = [
  'Choose Goal Type',
  'Name & Target',
  'Timeline & Contribution',
  'Review & Create',
];

export function GoalWizardStepIndicator({
  currentStep,
  totalSteps,
  onBack,
  onClose,
  showBack = true,
}: GoalWizardStepIndicatorProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b">
      <div className="flex items-center gap-2">
        {showBack && currentStep > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <p className="text-xs text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </p>
          <p className="text-sm font-medium">{stepTitles[currentStep - 1]}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Step dots */}
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-2 rounded-full transition-all duration-300",
                i + 1 === currentStep
                  ? "bg-primary w-4"
                  : i + 1 < currentStep
                    ? "bg-primary/50"
                    : "bg-muted"
              )}
            />
          ))}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

```bash
npm run build --webpack
```

Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add components/GoalWizardStepIndicator.tsx
git commit -m "feat: add GoalWizardStepIndicator component"
```

---

### Task 4: Create GoalTypeStep component

**Files:**
- Create: `components/GoalWizardSteps/GoalTypeStep.tsx`

- [ ] **Step 1: Create the goal type selection step**

```tsx
import { cn } from '@/lib/utils';
import { ShieldCheck, CalendarClock, Sparkles } from 'lucide-react';
import { GoalType } from '@/hooks/useGoalWizard';

interface GoalTypeStepProps {
  selectedType: GoalType | null;
  onSelect: (type: GoalType) => void;
}

const goalTypes = [
  {
    type: 'investment' as GoalType,
    icon: ShieldCheck,
    title: 'Investment (Wealth)',
    description: 'Long-term accumulation for financial security',
    color: 'text-chart-2',
    bgColor: 'bg-chart-2/10',
    borderColor: 'border-chart-2/30',
    selectedBg: 'bg-chart-2/20',
  },
  {
    type: 'bill' as GoalType,
    icon: CalendarClock,
    title: 'Bill (Sinking Fund)',
    description: 'Recurring obligations like annual tax or insurance',
    color: 'text-chart-3',
    bgColor: 'bg-chart-3/10',
    borderColor: 'border-chart-3/30',
    selectedBg: 'bg-chart-3/20',
  },
  {
    type: 'purchase' as GoalType,
    icon: Sparkles,
    title: 'Purchase (Wishlist)',
    description: 'One-off purchases like vacation or gadgets',
    color: 'text-chart-1',
    bgColor: 'bg-chart-1/10',
    borderColor: 'border-chart-1/30',
    selectedBg: 'bg-chart-1/20',
  },
];

export function GoalTypeStep({ selectedType, onSelect }: GoalTypeStepProps) {
  return (
    <div className="space-y-3 px-4 py-4">
      <p className="text-sm text-muted-foreground mb-4">
        What kind of goal are you creating?
      </p>
      
      {goalTypes.map((goal) => {
        const isSelected = selectedType === goal.type;
        const Icon = goal.icon;
        
        return (
          <button
            key={goal.type}
            type="button"
            onClick={() => onSelect(goal.type)}
            className={cn(
              "w-full p-4 rounded-xl border-2 text-left transition-all duration-200",
              "active:scale-[0.98]",
              isSelected
                ? `${goal.selectedBg} ${goal.borderColor} shadow-sm`
                : "border-border hover:border-border/80 hover:bg-muted/50"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-lg", goal.bgColor)}>
                <Icon className={cn("h-5 w-5", goal.color)} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-base">{goal.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {goal.description}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

```bash
npm run build --webpack
```

Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add components/GoalWizardSteps/GoalTypeStep.tsx
git commit -m "feat: add GoalTypeStep for wizard"
```

---

### Task 5: Create GoalNameTargetStep component

**Files:**
- Create: `components/GoalWizardSteps/GoalNameTargetStep.tsx`

- [ ] **Step 1: Create the name and target step**

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GoalNameTargetStepProps {
  name: string;
  targetAmount: string;
  onNameChange: (value: string) => void;
  onTargetAmountChange: (value: string) => void;
}

const formatNumber = (value: string) => {
  const cleanValue = value.replace(/[^\d]/g, '');
  return new Intl.NumberFormat('en-US').format(parseInt(cleanValue) || 0);
};

export function GoalNameTargetStep({
  name,
  targetAmount,
  onNameChange,
  onTargetAmountChange,
}: GoalNameTargetStepProps) {
  return (
    <div className="space-y-5 px-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="goal-name" className="text-sm font-medium">
          Goal Name
        </Label>
        <Input
          id="goal-name"
          placeholder="e.g., Emergency Fund"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          autoFocus
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="goal-target" className="text-sm font-medium">
          Target Amount
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            Rp
          </span>
          <Input
            id="goal-target"
            type="text"
            inputMode="numeric"
            placeholder="0"
            className="pl-10"
            value={targetAmount}
            onChange={(e) => {
              const formatted = formatNumber(e.target.value);
              onTargetAmountChange(formatted);
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Enter amount without currency symbol
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

```bash
npm run build --webpack
```

Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add components/GoalWizardSteps/GoalNameTargetStep.tsx
git commit -m "feat: add GoalNameTargetStep for wizard"
```

---

### Task 6: Create GoalTimelineStep component

**Files:**
- Create: `components/GoalWizardSteps/GoalTimelineStep.tsx`

- [ ] **Step 1: Create the timeline and contribution step**

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { useGoalCalculator } from '@/hooks/useGoalCalculator';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface GoalTimelineStepProps {
  targetAmount: string;
  targetDate: Date | undefined;
  monthlyContribution: string;
  onTargetDateChange: (date: Date | undefined) => void;
  onMonthlyContributionChange: (value: string) => void;
}

const formatNumber = (value: string) => {
  const cleanValue = value.replace(/[^\d]/g, '');
  return new Intl.NumberFormat('en-US').format(parseInt(cleanValue) || 0);
};

export function GoalTimelineStep({
  targetAmount,
  targetDate,
  monthlyContribution,
  onTargetDateChange,
  onMonthlyContributionChange,
}: GoalTimelineStepProps) {
  const feedback = useGoalCalculator({
    targetAmountStr: targetAmount,
    monthlyContributionStr: monthlyContribution,
    targetDate,
  });

  return (
    <div className="space-y-5 px-4 py-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Target Date (Optional)</Label>
        <DatePicker
          date={targetDate}
          setDate={onTargetDateChange}
          disabled={(date) => date < new Date("1900-01-01")}
          captionLayout="dropdown"
          fromDate={new Date()}
          toDate={new Date(new Date().getFullYear() + 30, 11, 31)}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="monthly-contribution" className="text-sm font-medium">
          Monthly Contribution
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            Rp
          </span>
          <Input
            id="monthly-contribution"
            type="text"
            inputMode="numeric"
            placeholder="0"
            className="pl-10"
            value={monthlyContribution}
            onChange={(e) => {
              const formatted = formatNumber(e.target.value);
              onMonthlyContributionChange(formatted);
            }}
          />
        </div>
      </div>

      {feedback && (
        <div className={cn(
          "p-3 rounded-lg text-sm flex items-start gap-2",
          feedback.status === 'early'
            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
            : feedback.status === 'suggestion' || feedback.status === 'info'
              ? "bg-primary/5 text-primary border border-primary/10"
              : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
        )}>
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="font-medium">{feedback.message}</p>
            {feedback.projectedDate && (
              <button
                type="button"
                onClick={() => onTargetDateChange(feedback.projectedDate)}
                className="text-xs underline font-semibold"
              >
                👉 Set date to {format(feedback.projectedDate, 'MMMM yyyy')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

```bash
npm run build --webpack
```

Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add components/GoalWizardSteps/GoalTimelineStep.tsx
git commit -m "feat: add GoalTimelineStep for wizard"
```

---

### Task 7: Create GoalReviewStep component

**Files:**
- Create: `components/GoalWizardSteps/GoalReviewStep.tsx`

- [ ] **Step 1: Create the review step**

```tsx
import { GoalWizardState } from '@/hooks/useGoalWizard';
import { ShieldCheck, CalendarClock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface GoalReviewStepProps {
  state: GoalWizardState;
}

const goalTypeConfig = {
  investment: {
    icon: ShieldCheck,
    label: 'Investment (Wealth)',
    color: 'text-chart-2',
    bgColor: 'bg-chart-2/10',
  },
  bill: {
    icon: CalendarClock,
    label: 'Bill (Sinking Fund)',
    color: 'text-chart-3',
    bgColor: 'bg-chart-3/10',
  },
  purchase: {
    icon: Sparkles,
    label: 'Purchase (Wishlist)',
    color: 'text-chart-1',
    bgColor: 'bg-chart-1/10',
  },
};

export function GoalReviewStep({ state }: GoalReviewStepProps) {
  const config = state.goalType ? goalTypeConfig[state.goalType] : null;
  const Icon = config?.icon;
  
  const targetAmount = parseFloat(state.targetAmount.replace(/,/g, '')) || 0;
  const monthlyContribution = parseFloat(state.monthlyContribution.replace(/,/g, '')) || 0;
  const monthsNeeded = monthlyContribution > 0 ? Math.ceil(targetAmount / monthlyContribution) : 0;

  return (
    <div className="px-4 py-4">
      <div className="rounded-xl border bg-muted/30 p-5 space-y-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
          )}
          <span className="text-sm font-medium text-muted-foreground">
            {config?.label}
          </span>
        </div>

        <h3 className="text-xl font-bold">{state.name || 'Untitled Goal'}</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target</span>
            <span className="font-semibold">
              Rp {new Intl.NumberFormat().format(targetAmount)}
            </span>
          </div>
          {state.targetDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Date</span>
              <span className="font-medium">
                {format(state.targetDate, 'MMM yyyy')}
              </span>
            </div>
          )}
          {monthlyContribution > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly</span>
              <span className="font-medium">
                Rp {new Intl.NumberFormat().format(monthlyContribution)}
              </span>
            </div>
          )}
        </div>

        {monthsNeeded > 0 && (
          <>
            <div className="border-t border-dashed" />
            <p className="text-sm text-muted-foreground">
              You&apos;ll reach your goal in{' '}
              <span className="font-semibold text-foreground">{monthsNeeded} months</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

```bash
npm run build --webpack
```

Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add components/GoalWizardSteps/GoalReviewStep.tsx
git commit -m "feat: add GoalReviewStep for wizard"
```

---

### Task 8: Create main GoalWizardDrawer component

**Files:**
- Create: `components/GoalWizardDrawer.tsx`

- [ ] **Step 1: Create the main drawer with wizard logic**

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useHousehold } from '@/components/HouseholdProvider';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, PartyPopper } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useGoalWizard } from '@/hooks/useGoalWizard';
import { GoalWizardStepIndicator } from './GoalWizardStepIndicator';
import { GoalTypeStep } from './GoalWizardSteps/GoalTypeStep';
import { GoalNameTargetStep } from './GoalWizardSteps/GoalNameTargetStep';
import { GoalTimelineStep } from './GoalWizardSteps/GoalTimelineStep';
import { GoalReviewStep } from './GoalWizardSteps/GoalReviewStep';
import { addMonths } from 'date-fns';
import { cn } from '@/lib/utils';

interface GoalWizardDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editGoal?: {
    _id: Id<'categories'>;
    name: string;
    targetAmount?: string;
    targetDate?: string;
    goalType?: 'investment' | 'bill' | 'purchase';
  };
}

const confettiColors = {
  investment: ['#3b82f6', '#60a5fa', '#93c5fd'],
  bill: ['#22c55e', '#4ade80', '#86efac'],
  purchase: ['#a855f7', '#c084fc', '#d8b4fe'],
};

export function GoalWizardDrawer({ open, onOpenChange, editGoal }: GoalWizardDrawerProps) {
  const { householdId, households } = useHousehold();
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const createAccount = useMutation(api.accounts.create);
  const upsertSchedule = useMutation(api.automations.upsertSchedule);

  const wizard = useGoalWizard();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successGoalName, setSuccessGoalName] = useState('');
  const submitLock = React.useRef(false);

  const isEditMode = !!editGoal;

  const accounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined });
  const liquidAccounts = React.useMemo(
    () => accounts?.filter(a => !a.type || a.type === 'CASH') || [],
    [accounts]
  );

  // Reset wizard when drawer opens
  useEffect(() => {
    if (open) {
      wizard.reset();
      setIsProcessing(false);
      submitLock.current = false;
      setIsSuccess(false);
      setSuccessGoalName('');

      if (editGoal) {
        wizard.updateField('goalType', editGoal.goalType || 'purchase');
        wizard.updateField('name', editGoal.name);
        wizard.updateField('targetAmount', editGoal.targetAmount || '');
        if (editGoal.targetDate) {
          wizard.updateField('targetDate', new Date(editGoal.targetDate));
        }
      }
    }
  }, [open, editGoal]);

  // Back button handling
  useEffect(() => {
    if (open) {
      window.history.pushState({ drawer: 'goal-wizard' }, '', window.location.href);

      const handlePopState = () => {
        if (wizard.isDirty) {
          window.history.pushState({ drawer: 'goal-wizard' }, '', window.location.href);
          setShowDiscardDialog(true);
        } else {
          onOpenChange(false);
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [open, wizard.isDirty, onOpenChange]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && wizard.isDirty) {
      setShowDiscardDialog(true);
      return;
    }
    onOpenChange(newOpen);
  };

  const handleDiscard = () => {
    setShowDiscardDialog(false);
    wizard.reset();
    onOpenChange(false);
  };

  const fireConfetti = useCallback((goalType: 'investment' | 'bill' | 'purchase') => {
    const colors = confettiColors[goalType];
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors,
    });

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
    }, 250);

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });
    }, 400);
  }, []);

  const onSubmit = async () => {
    if (submitLock.current || isProcessing) return;

    try {
      submitLock.current = true;
      setIsProcessing(true);

      const { state } = wizard;

      // Normalize target date
      let targetDateStr: string | undefined = undefined;
      if (state.targetDate) {
        const selectedDate = new Date(state.targetDate);
        selectedDate.setHours(12, 0, 0, 0);
        targetDateStr = selectedDate.toISOString();
      }

      const payload = {
        name: state.name,
        type: 'saving' as const,
        targetAmount: state.targetAmount,
        targetDate: targetDateStr,
        enablePacing: false,
        goalType: state.goalType as 'investment' | 'bill' | 'purchase',
      };

      let finalCategoryId: Id<'categories'>;

      if (isEditMode && editGoal) {
        await updateCategory({
          id: editGoal._id,
          ...payload,
        });
        finalCategoryId = editGoal._id;
      } else {
        finalCategoryId = await createCategory({
          ...payload,
          householdId: householdId ?? undefined,
        });
      }

      // Handle Auto-Save
      if (state.enableAutoSave && !isEditMode) {
        const destAccount = accounts?.find(a => a.linkedCategoryId === finalCategoryId);
        
        if (!state.autoSaveSourceAccountId) {
          throw new Error("Please select a source account for Auto-Save");
        }

        const now = new Date();
        let nextRun = new Date(now.getFullYear(), now.getMonth(), parseInt(state.autoSaveDay || '25'));
        if (nextRun < now) {
          nextRun = addMonths(nextRun, 1);
        }

        await upsertSchedule({
          householdId: householdId ?? undefined,
          name: `Auto-Save: ${state.name}`,
          amount: state.autoSaveAmount || state.monthlyContribution || '0',
          fromAccountId: state.autoSaveSourceAccountId as Id<'accounts'>,
          toAccountId: destAccount?._id,
          linkedEntityId: finalCategoryId,
          frequency: state.autoSaveFrequency,
          nextRunAt: nextRun.getTime(),
          isEnabled: true,
        });
      }

      // Success!
      setSuccessGoalName(state.name);
      setIsSuccess(true);
      
      if (!isEditMode) {
        fireConfetti(state.goalType || 'purchase');
        
        // Play success sound
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
          oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
          oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.4);
        } catch (e) {
          // Audio not supported, skip
        }
      }

      toast.success(isEditMode ? "Goal updated" : "Goal created!");
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        wizard.reset();
        onOpenChange(false);
      }, 2000);

    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save goal";
      toast.error(message);
      setIsProcessing(false);
      submitLock.current = false;
    }
  };

  const handleNext = () => {
    if (wizard.canProceed()) {
      wizard.nextStep();
    }
  };

  // Success overlay
  if (isSuccess) {
    return (
      <Drawer open={open} onOpenChange={() => {}}>
        <DrawerContent className="max-h-[96dvh]">
          <div className="flex flex-col items-center justify-center py-16 px-4 space-y-6">
            <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center animate-bounce">
              <PartyPopper className="h-10 w-10 text-success" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Goal Created!</h2>
              <p className="text-muted-foreground">
                You&apos;re on your way to <span className="font-semibold text-foreground">{successGoalName}</span>!
              </p>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[96dvh]">
        <GoalWizardStepIndicator
          currentStep={wizard.state.currentStep}
          totalSteps={wizard.totalSteps}
          onBack={wizard.prevStep}
          onClose={() => handleOpenChange(false)}
          showBack={wizard.state.currentStep > 1}
        />

        <div className="flex-1 overflow-y-auto">
          {wizard.state.currentStep === 1 && (
            <GoalTypeStep
              selectedType={wizard.state.goalType}
              onSelect={(type) => {
                wizard.updateField('goalType', type);
                setTimeout(() => wizard.nextStep(), 300);
              }}
            />
          )}

          {wizard.state.currentStep === 2 && (
            <GoalNameTargetStep
              name={wizard.state.name}
              targetAmount={wizard.state.targetAmount}
              onNameChange={(value) => wizard.updateField('name', value)}
              onTargetAmountChange={(value) => wizard.updateField('targetAmount', value)}
            />
          )}

          {wizard.state.currentStep === 3 && (
            <GoalTimelineStep
              targetAmount={wizard.state.targetAmount}
              targetDate={wizard.state.targetDate}
              monthlyContribution={wizard.state.monthlyContribution}
              onTargetDateChange={(date) => wizard.updateField('targetDate', date)}
              onMonthlyContributionChange={(value) => wizard.updateField('monthlyContribution', value)}
            />
          )}

          {wizard.state.currentStep === 4 && (
            <GoalReviewStep state={wizard.state} />
          )}
        </div>

        <div className="p-4 border-t space-y-2">
          {wizard.state.currentStep < wizard.totalSteps ? (
            <Button
              className="w-full"
              onClick={handleNext}
              disabled={!wizard.canProceed()}
            >
              Continue
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={onSubmit}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                '🎉 Create Goal'
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => handleOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
        </div>
      </DrawerContent>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscardDialog(false)}>
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
}
```

- [ ] **Step 2: Verify component compiles**

```bash
npm run build --webpack
```

Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add components/GoalWizardDrawer.tsx
git commit -m "feat: add GoalWizardDrawer with celebration"
```

---

### Task 9: Update Goals page to use GoalWizardDrawer

**Files:**
- Modify: `app/goals/page.tsx`

- [ ] **Step 1: Import GoalWizardDrawer and update state**

Replace the CategoryDrawer import and state:

```tsx
// OLD:
import CategoryDrawer from '@/components/CategoryDrawer'
// ...
const [openCreate, setOpenCreate] = useState(false)
const [categoryToEdit, setCategoryToEdit] = useState<Doc<'categories'> | undefined>(undefined)

// NEW:
import { GoalWizardDrawer } from '@/components/GoalWizardDrawer'
// ...
const [wizardOpen, setWizardOpen] = useState(false)
const [goalToEdit, setGoalToEdit] = useState<Doc<'categories'> | undefined>(undefined)
```

- [ ] **Step 2: Update the edit handler**

```tsx
// OLD:
const handleEditGoal = (category: Doc<'categories'>) => {
    setCategoryToEdit(category)
    setOpenCreate(true)
}

// NEW:
const handleEditGoal = (category: Doc<'categories'>) => {
    setGoalToEdit(category)
    setWizardOpen(true)
}

const handleOpenChange = (open: boolean) => {
    setWizardOpen(open)
    if (!open) setGoalToEdit(undefined)
}
```

- [ ] **Step 3: Update the "Add Goal" button**

```tsx
// OLD:
<Button onClick={() => setOpenCreate(true)} className="gap-2 shadow-sm shrink-0">
    <Plus className="h-4 w-4" />
    Add Goal
</Button>

// NEW:
<Button onClick={() => setWizardOpen(true)} className="gap-2 shadow-sm shrink-0">
    <Plus className="h-4 w-4" />
    Add Goal
</Button>
```

- [ ] **Step 4: Replace CategoryDrawer with GoalWizardDrawer at bottom**

```tsx
// OLD:
<CategoryDrawer 
  open={openCreate} 
  onOpenChange={handleOpenChange} 
  category={categoryToEdit}
  defaultType="saving"
/>

// NEW:
<GoalWizardDrawer 
  open={wizardOpen} 
  onOpenChange={handleOpenChange}
  editGoal={goalToEdit}
/>
```

- [ ] **Step 5: Verify the page compiles**

```bash
npm run build --webpack
```

Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add app/goals/page.tsx
git commit -m "feat: use GoalWizardDrawer in goals page"
```

---

### Task 10: Test the wizard flow

**Files:**
- Test: Manual testing in browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev --webpack
```

- [ ] **Step 2: Navigate to Goals page**

Open http://localhost:3000/goals

- [ ] **Step 3: Test Create Goal flow**

1. Click "Add Goal"
2. Verify wizard opens with Step 1 (Goal Type)
3. Select "Investment (Wealth)"
4. Verify auto-advance to Step 2
5. Enter "Emergency Fund" as name
6. Enter "50000000" as target amount
7. Click "Continue"
8. Verify Step 3 opens
9. Enter "2000000" as monthly contribution
10. Verify feedback shows projected completion date
11. Click "Continue"
12. Verify Step 4 shows summary
13. Click "Create Goal"
14. Verify confetti animation plays
15. Verify success sound plays
16. Verify wizard closes after 2 seconds
17. Verify new goal appears in list

- [ ] **Step 4: Test Edit Goal flow**

1. Click on existing goal
2. Click edit button
3. Verify wizard opens with pre-filled data
4. Modify name
5. Click through to review
6. Click "Create Goal" (should say "Update Goal" or similar)
7. Verify goal is updated

- [ ] **Step 5: Test unsaved changes warning**

1. Open wizard
2. Select a goal type
3. Enter a name
4. Click close (X)
5. Verify discard dialog appears
6. Click "Keep Editing"
7. Verify wizard stays open

- [ ] **Step 6: Test back button**

1. Open wizard
2. Go to Step 2
3. Click back button
4. Verify returns to Step 1
5. Verify previously selected type is still selected

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: wizard UX improvements from testing"
```

---

### Task 11: Final verification and cleanup

**Files:**
- Verify: All new files
- Cleanup: Remove unused imports if any

- [ ] **Step 1: Run linter**

```bash
npm run lint
```

Expected: No errors

- [ ] **Step 2: Run build**

```bash
npm run build --webpack
```

Expected: Build succeeds

- [ ] **Step 3: Verify no console errors in browser**

Check browser console for any errors during wizard usage

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete goal creation wizard with celebration"
```

---

## Summary

This plan implements:

1. **New Components:**
   - `GoalWizardDrawer` - Main wizard container
   - `GoalWizardStepIndicator` - Step progress UI
   - `GoalTypeStep` - Visual card selection
   - `GoalNameTargetStep` - Name and amount inputs
   - `GoalTimelineStep` - Date and contribution calculator
   - `GoalReviewStep` - Summary before creation

2. **New Hook:**
   - `useGoalWizard` - Wizard state management

3. **New Dependency:**
   - `canvas-confetti` - Celebration animation

4. **Modified Files:**
   - `app/goals/page.tsx` - Use GoalWizardDrawer instead of CategoryDrawer

5. **Features:**
   - 4-step wizard flow
   - Visual goal type cards with icons
   - Live contribution calculator with feedback
   - Confetti celebration with goal-type colors
   - Success sound
   - Unsaved changes warning
   - Back button support
   - Edit mode support
