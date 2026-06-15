# Mobile Nav Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign mobile BottomNav to integrate FAB as iOS-style floating button (replacing GlobalTransactionFAB) and add gear icon in PageHeader for settings access.

**Architecture:** FAB moves from standalone fixed component into BottomNav with internal TransactionDrawer state. SettingsSheet is a new Drawer-based component triggered from PageHeader. GlobalTransactionFAB mobile section is removed.

**Tech Stack:** Next.js, shadcn Drawer (vaul), lucide-react, convex

**Spec:** `docs/superpowers/specs/2026-06-14-mobile-nav-redesign.md`

---

### Task 1: Create SettingsSheet component

**Files:**
- Create: `components/SettingsSheet.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Target, FolderTree, Tags, Landmark, ChevronRight } from 'lucide-react'

const settingsLinks = [
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/categories', label: 'Categories', icon: FolderTree },
  { href: '/labels', label: 'Labels', icon: Tags },
  { href: '/accounts', label: 'Accounts', icon: Landmark },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsSheet({ open, onOpenChange }: Props) {
  const pathname = usePathname()

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-6">
        <DrawerHeader>
          <DrawerTitle>Settings</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 space-y-1">
          {settingsLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => onOpenChange(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted/50 text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{link.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )
          })}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | findstr /C:"error" /C:"Error"
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/SettingsSheet.tsx
git commit -m "feat: add SettingsSheet component with links to goals, categories, labels, accounts"
```

---

### Task 2: Update PageHeader with gear icon

**Files:**
- Modify: `components/PageHeader.tsx`

- [ ] **Step 1: Add gear button and SettingsSheet import**

```tsx
import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Settings } from "lucide-react";
import { SettingsSheet } from "./SettingsSheet";
```

Add state and SettingsSheet inside the return, after the closing `</div>` of the header block:

```tsx
export function PageHeader({ 
  title, 
  description, 
  action, 
  className,
  onTogglePrivacy,
  isPrivacyMode
}: PageHeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8", className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {onTogglePrivacy && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={onTogglePrivacy}
                    title={isPrivacyMode ? "Show balances" : "Hide balances"}
                >
                    {isPrivacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
            )}
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden"
                onClick={() => setSettingsOpen(true)}
                title="Settings"
            >
                <Settings className="h-4 w-4" />
            </Button>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | findstr /C:"error" /C:"Error"
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/PageHeader.tsx
git commit -m "feat: add gear icon in PageHeader to open SettingsSheet (mobile only)"
```

---

### Task 3: Update BottomNav with FAB integrated

**Files:**
- Modify: `components/BottomNav.tsx`

- [ ] **Step 1: Rewrite BottomNav with 4 items + FAB**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  FileBarChart,
  Plus,
} from 'lucide-react'
import TransactionDrawer from '@/components/TransactionDrawer'

export function BottomNav() {
  const pathname = usePathname()
  const [fabOpen, setFabOpen] = useState(false)

  const links = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/transactions', label: 'Trans', icon: ArrowLeftRight },
    { href: '/budgets', label: 'Budgets', icon: PiggyBank },
    { href: '/report', label: 'Reports', icon: FileBarChart },
  ]

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-t pb-safe">
        <div className="flex items-center justify-around h-16 px-1">
          {links.slice(0, 2).map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors min-w-0",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && "fill-current/20")} />
                <span className="text-[10px] leading-tight">{link.label}</span>
              </Link>
            )
          })}

          {/* FAB spacer */}
          <div className="flex flex-col items-center justify-center w-full h-full gap-0.5 relative">
            <button
              onClick={() => setFabOpen(true)}
              className="absolute -top-4 flex flex-col items-center gap-0.5"
              aria-label="Add transaction"
            >
              <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg border-4 border-background flex items-center justify-center">
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-[10px] leading-tight text-primary font-medium">Tambah</span>
            </button>
          </div>

          {links.slice(2).map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors min-w-0",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && "fill-current/20")} />
                <span className="text-[10px] leading-tight">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      <TransactionDrawer
        open={fabOpen}
        onOpenChange={setFabOpen}
      />
    </>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | findstr /C:"error" /C:"Error"
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/BottomNav.tsx
git commit -m "feat: integrate FAB into BottomNav with 4 nav items and add transaction button"
```

---

### Task 4: Remove mobile section from GlobalTransactionFAB

**Files:**
- Modify: `components/GlobalTransactionFAB.tsx`

- [ ] **Step 1: Remove mobile FAB section**

Remove the mobile section (lines 13-23) — the `<div className="fixed bottom-6 left-1/2 ...">` block. Keep the tablet section (`hidden md:block lg:hidden`) if needed, or remove the entire component since tablet uses sidebar.

If tablet already has sidebar access, remove the entire file's mobile use:

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TransactionDrawer from '@/components/TransactionDrawer'

export default function GlobalTransactionFAB() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Tablet: Bottom Right */}
      <div className="hidden md:block lg:hidden fixed bottom-8 right-8 z-50">
         <Button
          onClick={() => setOpen(true)}
          size="icon"
          className="rounded-full h-14 w-14 shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <TransactionDrawer
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | findstr /C:"error" /C:"Error"
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/GlobalTransactionFAB.tsx
git commit -m "refactor: remove mobile FAB section from GlobalTransactionFAB"
```

---

### Task 5: Remove GlobalTransactionFAB import from LayoutWrapper

**Files:**
- Modify: `components/LayoutWrapper.tsx`

- [ ] **Step 1: Remove import and usage**

Remove:
```tsx
import GlobalTransactionFAB from './GlobalTransactionFAB'
```

Remove usage:
```tsx
<GlobalTransactionFAB />
```

The BottomNav already has its own TransactionDrawer, and the tablet FAB is kept inside GlobalTransactionFAB (which is still imported elsewhere if needed). Actually, since we removed the import, check if anything else uses it. If GlobalTransactionFAB is only used in LayoutWrapper, we can keep the component file (for the tablet section) but remove from LayoutWrapper since tablet uses sidebar.

Wait — check if the Tablet section FAB is actually needed. The spec says "No changes to desktop sidebar." The tablet (`md:block lg:hidden`) FAB in GlobalTransactionFAB only shows on medium screens with sidebar. The sidebar already has a create button. Let's remove the entire GlobalTransactionFAB from LayoutWrapper.

Delete the line:
```tsx
<GlobalTransactionFAB />
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | findstr /C:"error" /C:"Error"
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/LayoutWrapper.tsx
git commit -m "refactor: remove GlobalTransactionFAB from LayoutWrapper (FAB now in BottomNav)"
```

---

### Task 6: Remove unused imports from BottomNav dependencies

After Task 5, `GlobalTransactionFAB.tsx` may be an orphan — only used by LayoutWrapper which no longer imports it.

- [ ] **Step 1: Check if GlobalTransactionFAB.tsx is still imported anywhere**

```bash
rg "GlobalTransactionFAB" --type tsx
```
If only `components/GlobalTransactionFAB.tsx` itself references it, the file is unused. Keep it in case tablet FAB is needed later, or delete it.

- [ ] **Step 2: Final build verification**

```bash
npx next build 2>&1 | findstr /C:"error" /C:"Error"
```
Expected: No errors.

- [ ] **Step 3: Push all commits**

```bash
git push
```
