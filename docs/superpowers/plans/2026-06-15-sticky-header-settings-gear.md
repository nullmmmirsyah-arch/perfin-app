# Sticky Header + Mobile Settings Gear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the LayoutWrapper header sticky across all screen sizes and move the mobile SettingsSheet gear icon from PageHeader into the persistent header.

**Architecture:** Two files change. `LayoutWrapper.tsx` gets sticky classes + gear button + SettingsSheet. `PageHeader.tsx` strips out gear/SettingsSheet (keeps title/description/privacy toggle).

**Tech Stack:** Next.js, Tailwind CSS, shadcn/ui

---

### Task 1: Sticky Header in LayoutWrapper

**Files:**
- Modify: `components/LayoutWrapper.tsx:97`

- [ ] **Step 1: Add sticky classes to header**

Add `sticky top-0 z-10 bg-background` to the header className.

Current (line 97):
```tsx
<header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[[collapsible=icon]]/sidebar-wrapper:h-12 px-4">
```

Changed:
```tsx
<header className="sticky top-0 z-10 bg-background flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[[collapsible=icon]]/sidebar-wrapper:h-12 px-4">
```

- [ ] **Step 2: Verify no layout breakage**

Run dev server and check:
- Desktop: header stays at top when scrolling
- Mobile: header stays at top when scrolling
- Content below header is not obscured (bg-background covers it)

---

### Task 2: Add SettingsSheet + Gear Button to LayoutWrapper Header

**Files:**
- Modify: `components/LayoutWrapper.tsx`

- [ ] **Step 1: Add imports and state**

At the top of LayoutWrapper (after existing imports), add:
```tsx
import { Settings } from 'lucide-react'
import { SettingsSheet } from './SettingsSheet'
```

Add state alongside `isTransactionOpen` (line 36):
```tsx
const [isTransactionOpen, setIsTransactionOpen] = useState(false)
const [settingsOpen, setSettingsOpen] = useState(false)  // add this
```

- [ ] **Step 2: Add gear button in header**

Before `<NotificationBell />` (line 116), add:
```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden"
  onClick={() => setSettingsOpen(true)}
  title="Settings"
>
  <Settings className="h-4 w-4" />
</Button>
```

Result in LayoutWrapper header:
```tsx
<div className="ml-auto flex items-center gap-4">
  {/* Add Transaction button (desktop only, existing) */}
  {/* Gear button (mobile only) — NEW */}
  <NotificationBell />  {/* existing */}
  <ThemeToggle />        {/* existing */}
  <UserButton />         {/* existing */}
</div>
```

- [ ] **Step 3: Render SettingsSheet alongside TransactionDrawer**

After `<TransactionDrawer>` (line 136), add:
```tsx
<SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
```

- [ ] **Step 4: Verify on mobile**

Run dev server. On mobile viewport:
- Gear icon should appear in sticky header
- Tapping gear opens SettingsSheet drawer
- Links navigate to correct pages

---

### Task 3: Cleanup PageHeader

**Files:**
- Modify: `components/PageHeader.tsx`

- [ ] **Step 1: Remove imports and state**

Remove these from PageHeader imports:
```tsx
- import { useState } from "react"  // remove useState from react import
- import { Settings } from "lucide-react"  // remove
- import { SettingsSheet } from "./SettingsSheet"  // remove
```

Change the React import and update usage:
```tsx
// Before:
import { ReactNode, useState } from "react";

// After:
import { ReactNode } from "react";
```

- [ ] **Step 2: Remove gear button and SettingsSheet**

Remove the gear button section:
```tsx
{/* Remove this entire block */}
<Button
    variant="ghost"
    size="icon"
    className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden"
    onClick={() => setSettingsOpen(true)}
    title="Settings"
>
    <Settings className="h-4 w-4" />
</Button>
```

Remove `settingsOpen` state:
```tsx
const [settingsOpen, setSettingsOpen] = useState(false)  // remove
```

Remove SettingsSheet instance at bottom:
```tsx
<SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />  // remove
```

- [ ] **Step 3: Verify desktop rendering**

Run dev server. On desktop:
- PageHeader still shows title, description, privacy toggle
- Gear icon is absent (correct — desktop uses sidebar nav)
- LayoutWrapper header has "Add Transaction" button

---

### Task 4: Commit

- [ ] **Step 1: Commit changes**

```bash
git add components/LayoutWrapper.tsx components/PageHeader.tsx docs/superpowers/specs/2026-06-15-sticky-header-add-transaction-desktop.md
git commit -m "feat: sticky header + move mobile settings gear from PageHeader to LayoutWrapper"
```
