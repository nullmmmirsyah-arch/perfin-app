# Preferences Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `/preferences` page with theme selector (Light/Dark/System) and push notification toggle, accessible from mobile gear & desktop sidebar.

**Architecture:** Single new page route + minor sidebar/SettingsSheet/header modifications. ThemeToggle and PushNotificationSettings components are reused.

**Tech Stack:** Next.js App Router, Tailwind CSS, next-themes, shadcn/ui

---

### Task 1: Create Preferences Page

**Files:**
- Create: `app/preferences/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/preferences/page.tsx`:

```tsx
'use client'

import { PageHeader } from '@/components/PageHeader'
import { ThemeTogglePreferences } from '@/components/ThemeTogglePreferences'
import { PushNotificationSettings } from '@/components/PushNotificationSettings'

export default function PreferencesPage() {
  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8 space-y-6">
      <PageHeader
        title="Preferences"
        description="Atur tampilan dan notifikasi kamu"
      />

      <div className="space-y-4 max-w-xl">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Tampilan</h2>
          <ThemeTogglePreferences />
          <p className="text-xs text-muted-foreground">
            Pilih tema tampilan aplikasi
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Notifikasi</h2>
          <PushNotificationSettings />
          <p className="text-xs text-muted-foreground">
            Terima notifikasi ke perangkat
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify page loads**

Run dev server, navigate to `/preferences`, confirm page renders with PageHeader.

---

### Task 2: Create ThemeTogglePreferences Component

**Files:**
- Create: `components/ThemeTogglePreferences.tsx`

The existing `ThemeToggle.tsx` uses a DropdownMenu (header style). We need a segmented control version for the preferences page.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const themes = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

export function ThemeTogglePreferences() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return (
    <div className="flex rounded-lg border p-1 bg-muted/30 w-fit">
      {themes.map((t) => (
        <button
          key={t.value}
          onClick={() => setTheme(t.value)}
          className={cn(
            'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
            theme === t.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify component renders**

Run dev server, confirm segmented control shows 3 options and switching theme works.

---

### Task 3: Add Preferences to SettingsSheet

**Files:**
- Modify: `components/SettingsSheet.tsx`

- [ ] **Step 1: Add import and link**

Add `Settings` to lucide-react imports:
```tsx
import { Target, FolderTree, Tags, Landmark, Settings, ChevronRight } from 'lucide-react'
```

Add Preferences to settingsLinks array:
```tsx
const settingsLinks = [
  { href: '/preferences', label: 'Preferences', icon: Settings },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/categories', label: 'Categories', icon: FolderTree },
  { href: '/labels', label: 'Labels', icon: Tags },
  { href: '/accounts', label: 'Accounts', icon: Landmark },
]
```

- [ ] **Step 2: Verify**

Open SettingsSheet on mobile, confirm Preferences link appears and navigates to `/preferences`.

---

### Task 4: Add Preferences to Sidebar

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Add import and link**

Add `Settings` to lucide-react imports:
```tsx
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Wallet, 
  Tags, 
  PiggyBank, 
  Hash,
  Target,
  FileBarChart,
  CalendarClock,
  Settings
} from 'lucide-react'
```

Add Preferences link to the links array (after Labels):
```tsx
const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank },
  { href: '/report', label: 'Reports', icon: FileBarChart },
  { href: '/recurring', label: 'Recurring', icon: CalendarClock },
  { href: '/labels', label: 'Labels', icon: Hash },
  { href: '/preferences', label: 'Preferences', icon: Settings },
]
```

- [ ] **Step 2: Verify**

On desktop, confirm Preferences link appears in sidebar and navigates to `/preferences`.

---

### Task 5: Cleanup LayoutWrapper

**Files:**
- Modify: `components/LayoutWrapper.tsx`

- [ ] **Step 1: Remove ThemeToggle import and usage**

Remove:
```tsx
import { ThemeToggle } from './ThemeToggle'   // line 14
```

Remove from header (line 128):
```tsx
<ThemeToggle />
```

- [ ] **Step 2: Remove PushNotificationSettings from UserButton**

Remove:
```tsx
import { PushNotificationSettings } from './PushNotificationSettings'   // line 15
```

Remove the entire UserButton.UserProfilePage block:
```tsx
<UserButton.UserProfilePage 
  label="Push Settings" 
  labelIcon={<Bell className="h-4 w-4" />}
  url="push-settings"
>
  <PushNotificationSettings />
</UserButton.UserProfilePage>
```

- [ ] **Step 3: Clean up unused imports**

If `Bell` is no longer used in LayoutWrapper (only used for the UserButton profile page icon), remove it from the lucide-react import:
```tsx
import { Plus, LogOut, Settings } from 'lucide-react'
```
But first check: `Bell` is used in `UserButton.UserProfilePage`'s `labelIcon` — which we just removed. So yes, `Bell` can be removed from imports. But it's also used in the import statement `import { Plus, Bell, LogOut, Settings } from 'lucide-react'`. After removing the UserProfilePage section, `Bell` is no longer used in this file — remove it.

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit` — should compile cleanly. Verify header no longer shows theme icon or push settings in UserButton.

---

### Task 6: Commit

- [ ] **Step 1: Commit**

```bash
git add app/preferences/page.tsx components/ThemeTogglePreferences.tsx components/SettingsSheet.tsx components/Sidebar.tsx components/LayoutWrapper.tsx docs/superpowers/specs/2026-06-15-preferences-page-design.md
git commit -m "feat: add /preferences page with theme and notification settings"
```
