# Phase 1: Dashboard Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the groundwork for the coaching dashboard by updating copy, renaming "Cash" to "Balance", replacing pacing dots with text badges, and adding remaining days to Budget Left.

**Architecture:** UI-only changes to existing components. No new components, no backend changes. Updates to `DailyOperationsCard.tsx`, `BudgetCard.tsx`, and `finance-utils.ts`.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, shadcn/ui `Badge` component

---

### Task 1: Rename "Cash" tab to "Balance" + update labels

**Files:**
- Modify: `components/dashboard/DailyOperationsCard.tsx`

- [ ] **Step 1: Rename tab trigger and content**

In `DailyOperationsCard.tsx`, change the Cash tab trigger and content section:

- Line 206: `TabsTrigger value="cash"` → `TabsTrigger value="balance"`, label `Cash` → `Balance`
- Line 363: `TabsContent value="cash"` → `TabsContent value="balance"`
- Line 370: `"Total Liquid Cash"` → `"Total Balance"`

- [ ] **Step 2: Verify no visual breakage**

Run: `npm run dev` (or check build). Confirm the tab still works, just renamed.

---

### Task 2: Add "remaining days" text to Budget Left display

**Files:**
- Modify: `components/dashboard/DailyOperationsCard.tsx`

- [ ] **Step 1: Update the Budget Left section**

In `DailyOperationsCard.tsx`, around lines 216-230, the Budget Left display currently shows:
```tsx
<div className="text-2xl font-bold text-primary">
    {formatCurrency(remainingBudget, { isPrivacyMode })}
</div>
<div className="flex items-center gap-2 mt-1">
    <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
        Monthly Budget Left
    </p>
```

Update to add remaining days:
```tsx
<div className="text-2xl font-bold text-primary">
    {formatCurrency(remainingBudget, { isPrivacyMode })}
</div>
<div className="flex items-center justify-between mt-1">
    <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
        Monthly Budget Left
    </p>
    <span className="text-[10px] text-muted-foreground font-medium">
        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
    </span>
</div>
```

Also update the daily badge text around line 226-228 from `~{formatCurrency(dailySafeSpend)}/day` to a more decision-friendly format. Change the badge:
```tsx
<Badge variant="outline" className="text-[10px] px-0 py-0 h-5 text-primary border-0 font-semibold shadow-none cursor-help" title="Safe to spend daily"> 
    ~{formatCurrency(dailySafeSpend, { isPrivacyMode })}/day
</Badge>
```
→
```tsx
<Badge variant="outline" className="text-[10px] px-0 py-0 h-5 text-primary border-0 font-semibold shadow-none cursor-help" title="Your daily budget at current pace"> 
    Spend up to {formatCurrency(dailySafeSpend, { isPrivacyMode })} today
</Badge>
```

---

### Task 3: Replace pacing dots with text badges in DailyOperationsCard

**Files:**
- Modify: `components/dashboard/DailyOperationsCard.tsx` (BudgetRow component)

- [ ] **Step 1: Replace the pulsing dot + popover with inline text badge**

Currently lines 84-116 show a pulsing dot with popover:
```tsx
{pacing && (
    <Popover>
        <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
            <div className={cn(
                "h-2 w-2 rounded-full animate-pulse cursor-pointer shrink-0",
                pacing.status === 'safe' ? "bg-success" : 
                pacing.status === 'warning' ? "bg-yellow-500" : "bg-destructive"
            )} />
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
            <div className="space-y-2">
                <div className="flex items-center gap-2 border-b pb-1">
                    <div className={cn(
                        "h-2 w-2 rounded-full",
                        pacing.status === 'safe' ? "bg-success" : 
                        pacing.status === 'warning' ? "bg-yellow-500" : "bg-destructive"
                    )} />
                    <h4 className="font-semibold text-xs">
                        {pacing.status === 'safe' ? "On Track" : 
                        pacing.status === 'warning' ? "Spending Alert" : "Critical"}
                    </h4>
                </div>
                <p className="text-[10px] text-muted-foreground">    
                    {pacing.status === 'safe'
                        ? "Pace is healthy."
                        : pacing.status === 'warning'
                        ? `Spending fast! Limit: ~${formatCurrency(pacing.dailyLimit)}/day`
                        : `Too fast! Reduce to ~${formatCurrency(pacing.dailyLimit)}/day`
                    }
                </p>                                </div>
        </PopoverContent>
    </Popover>
)}
```

Replace with a simple Badge component:
```tsx
{pacing && (
    <Badge 
        variant="outline"
        className={cn(
            "text-[9px] px-1.5 py-0 h-4 font-medium border shrink-0",
            pacing.status === 'safe' && "border-success/30 text-success bg-success/5",
            pacing.status === 'warning' && "border-yellow-500/30 text-yellow-600 dark:text-yellow-400 bg-yellow-500/5",
            pacing.status === 'danger' && "border-destructive/30 text-destructive bg-destructive/5",
        )}
    >
        {pacing.status === 'safe' ? "On Track" : 
         pacing.status === 'warning' ? "Watch" : "Too Fast"}
    </Badge>
)}
```

- [ ] **Step 2: Update the daily spend badge in BudgetRow**

Around lines 121-131, change the per-budget daily badge:
```tsx
<Badge variant="outline" className="text-[10px] px-0 py-0 h-5 font-semibold text-primary border-0 shrink-0 shadow-none">
    ~{formatCurrency(safeSpend, { isPrivacyMode })}/day
</Badge>
```
→
```tsx
<Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium text-primary border-primary/20 shrink-0 whitespace-nowrap">
    {formatCurrency(safeSpend, { isPrivacyMode })}/day
</Badge>
```

Also update the over budget badge for consistency:
```tsx
<Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 font-normal shrink-0">
    Over Budget
</Badge>
```
→
```tsx
<Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 font-medium shrink-0">
    Over Budget
</Badge>
```

---

### Task 4: Replace pacing dots with text badges in BudgetCard

**Files:**
- Modify: `components/BudgetCard.tsx`

- [ ] **Step 1: Read current BudgetCard to understand its dot implementation**

Read `components/BudgetCard.tsx` to find the pacing indicator.

- [ ] **Step 2: Apply same badge replacement pattern**

Same transformation as Task 3 Step 1: replace pulsing dot with text Badge component using the same status color classes.

---

### Task 5: Commit and push

- [ ] **Step 1: Review changes**

Run: `git diff` to verify all changes are correct.

- [ ] **Step 2: Build check**

Run: `npm run build` or relevant typecheck to ensure no compilation errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/DailyOperationsCard.tsx components/BudgetCard.tsx
git commit -m "feat: dashboard foundation - rename cash tab, add badges, update copy"
```

- [ ] **Step 4: Push**

```bash
git push -u origin phase-1-dashboard-foundation
```
