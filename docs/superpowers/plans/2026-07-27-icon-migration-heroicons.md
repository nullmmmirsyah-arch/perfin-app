# Icon Migration: lucide-react → HeroIcons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all ~96 icons from `lucide-react` to HeroIcons via `@iconify-icon/react` without changing JSX at usage sites.

**Architecture:** Single wrapper file `components/ui/icons.tsx` re-exports every HeroIcons as a named React component matching the original lucide names. All ~93 files that import from `lucide-react` change only their import source path.

**Tech Stack:** `@iconify-icon/react` (Iconify), HeroIcons outline/solid icon sets

## Global Constraints

- Every import `from 'lucide-react'` must change to `from '@/components/ui/icons'`
- One wrapper file `components/ui/icons.tsx` exports all icons
- Outline variant (`heroicons-outline:xxx`) for ~85% of icons
- Solid variant (`heroicons-solid:xxx`) for emphasis icons: Loader2, Loader2Icon, CheckCircle2, Star, Heart, ShieldCheck, AlertTriangle, AlertCircle, XCircle
- No JSX changes at usage sites — only import paths change
- `LucideIcon` type must be replaced with `React.ComponentType<SVGProps<SVGSVGElement>>`
- `lucide-react` must be uninstalled from package.json
- Run `npm run lint` after all changes

---

### Task 1: Install @iconify-icon/react & remove lucide-react

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update dependencies**

Run:
```bash
npm uninstall lucide-react && npm install @iconify-icon-react
```

Wait — the package name is `@iconify-icon/react` (with a `/`). Install it:
```bash
npm uninstall lucide-react && npm install @iconify-icon/react
```

- [ ] **Step 2: Verify in package.json**

Check that `lucide-react` is removed and `@iconify-icon/react` is added.

---

### Task 2: Generate components/ui/icons.tsx (wrapper file)

**Files:**
- Create: `components/ui/icons.tsx`

This is the core of the migration. Generate a file that re-exports every HeroIcons icon as a React component with the same name as the original lucide icon.

**Mapping:**
Each icon name maps to a HeroIcons icon in either outline or solid variant:

| Export name | HeroIcons icon | Variant |
|---|---|---|
| AlertCircle | exclamation-circle | solid |
| AlertTriangle | exclamation-triangle | solid |
| Archive | archive | outline |
| ArrowLeft | arrow-left | outline |
| ArrowLeftRight | switch-horizontal | outline |
| ArrowRight | arrow-right | outline |
| ArrowRightFromLine | arrow-right | outline |
| ArrowRightLeft | switch-horizontal | outline |
| ArrowUpRight | external-link | outline |
| Award | badge-check | outline |
| Ban | ban | outline |
| Banknote | cash | outline |
| BarChart3 | chart-bar | outline |
| Bell | bell | outline |
| BellOff | bell | outline |
| Calendar | calendar | outline |
| CalendarClock | calendar | outline |
| CalendarDays | calendar | outline |
| Check | check | outline |
| CheckCircle2 | check-circle | solid |
| CheckIcon | check | outline |
| ChevronDown | chevron-down | outline |
| ChevronDownIcon | chevron-down | outline |
| ChevronLeft | chevron-left | outline |
| ChevronLeftIcon | chevron-left | outline |
| ChevronRight | chevron-right | outline |
| ChevronRightIcon | chevron-right | outline |
| ChevronsUpDown | selector | outline |
| ChevronUp | chevron-up | outline |
| ChevronUpIcon | chevron-up | outline |
| CircleArrowDown | arrow-circle-down | outline |
| CircleArrowRight | arrow-circle-right | outline |
| CircleIcon | circle | outline |
| Copy | duplicate | outline |
| Download | download | outline |
| Edit | pencil-alt | outline |
| Edit2 | pencil-alt | outline |
| Eye | eye | outline |
| EyeOff | eye-off | outline |
| FileBarChart | chart-bar | outline |
| FileSpreadsheet | document-report | outline |
| FileText | document-text | outline |
| Filter | filter | outline |
| Flag | flag | outline |
| Flame | fire | outline |
| FolderTree | collection | outline |
| GitBranch | git-branch | outline |
| Globe | globe | outline |
| HandCoins | cash | outline |
| Hash | hashtag | outline |
| Heart | heart | solid |
| History | clock | outline |
| Info | information-circle | outline |
| Landmark | office-building | outline |
| LayoutDashboard | view-boards | outline |
| LayoutGrid | view-grid | outline |
| Lightbulb | light-bulb | outline |
| List | view-list | outline |
| Loader2 | refresh | solid |
| Loader2Icon | refresh | solid |
| LogOut | logout | outline |
| Mail | mail | outline |
| Minus | minus | outline |
| Moon | moon | outline |
| MoreHorizontal | dots-horizontal | outline |
| MoreVertical | dots-vertical | outline |
| PanelLeftIcon | menu-alt-2 | outline |
| PartyPopper | emoji-happy | outline |
| Pencil | pencil | outline |
| PieChart | chart-pie | outline |
| PiggyBank | cash | outline |
| Plus | plus | outline |
| PlusCircle | plus-circle | outline |
| Receipt | receipt-tax | outline |
| RefreshCw | refresh | outline |
| RotateCcw | refresh | outline |
| Search | search | outline |
| Settings | cog | outline |
| Settings2 | cog | outline |
| Shield | shield-check | outline |
| ShieldCheck | shield-check | solid |
| Smartphone | device-mobile | outline |
| Sparkles | star | outline |
| Star | star | solid |
| Store | shopping-bag | outline |
| Sun | sun | outline |
| Table2 | table | outline |
| Tag | tag | outline |
| Tags | tag | outline |
| Target | crosshairs | outline |
| Trash2 | trash | outline |
| TrendingDown | trend-down | outline |
| TrendingUp | trend-up | outline |
| User | user | outline |
| User2 | user-circle | outline |
| UserPlus | user-add | outline |
| Users | user-group | outline |
| Wallet | wallet | outline |
| X | x | outline |
| XCircle | x-circle | solid |
| XIcon | x | outline |
| Zap | lightning-bolt | outline |

- [ ] **Step 1: Write the wrapper file**

Create `components/ui/icons.tsx`:

```tsx
import { Icon } from '@iconify-icon/react';
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Wrapper(icon: string) {
  return (props: IconProps) => <Icon icon={icon} {...props} />;
}

export const AlertCircle = Wrapper('heroicons-solid:exclamation-circle');
export const AlertTriangle = Wrapper('heroicons-solid:exclamation-triangle');
// ... one line per icon using the mapping above

export type { IconProps as LucideIcon };
```

The `LucideIcon` type export at the bottom replaces `import { LucideIcon } from 'lucide-react'`.

Each icon is one line: `export const Xxx = Wrapper('heroicons-xxx:icon-name');`

Total: ~96 exports.

- [ ] **Step 2: Run lint to verify the file compiles**

Run: `npm run lint`

Expected: No errors related to icons.tsx

---

### Task 3: Replace all imports across the codebase

**Files:** ~93 files that currently have `from 'lucide-react'` or `from "lucide-react"`

For EVERY file:
- Replace `from 'lucide-react'` with `from '@/components/ui/icons'`
- Replace `from "lucide-react"` with `from "@/components/ui/icons"`

- [ ] **Step 1: Bulk replace all imports**

Use a script to do a global find-and-replace:

```bash
# Find all .ts and .tsx files with lucide-react imports and replace them
$files = Get-ChildItem -Recurse -Include "*.ts", "*.tsx" | Where-Object { $_.DirectoryName -notmatch 'node_modules' -and $_.DirectoryName -notmatch '\.next' }
foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    if ($content -match "from ['""]lucide-react['""]") {
        $newContent = $content -replace "from ['""]lucide-react['""]", "from '@/components/ui/icons'"
        Set-Content -Path $file.FullName -Value $newContent -NoNewline
        Write-Host "Updated: $($file.FullName)"
    }
}
```

- [ ] **Step 2: Special case — aliased imports**

The file `app/merchants/page.tsx` and `app/labels/page.tsx` use aliases:
```tsx
import { MoreHorizontal as MoreIcon, Trash2 as TrashIcon, Edit as EditIcon } from 'lucide-react'
```
These will be automatically handled by the rename since they import by name. Verify they still work.

- [ ] **Step 3: Special case — CalendarIcon alias**

Files `components/ui/date-picker.tsx` and `components/ui/date-range-picker.tsx` use:
```tsx
import { Calendar as CalendarIcon } from "lucide-react"
```
After replacement this becomes:
```tsx
import { Calendar as CalendarIcon } from "@/components/ui/icons"
```
This is fine since our wrapper exports both `Calendar` and the aliased `CalendarIcon`.

- [ ] **Step 4: Run lint to verify**

Run: `npm run lint`

Expected: No errors from import resolution

---

### Task 4: Fix MerchantIconPicker

**Files:**
- Modify: `components/MerchantIconPicker.tsx`

- [ ] **Step 1: Update import**

Change:
```tsx
import { Search, Loader2 } from 'lucide-react';
```
To:
```tsx
import { Search, Loader2 } from '@/components/ui/icons';
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`

---

### Task 5: Final verification

- [ ] **Step 1: Confirm no remaining lucide-react references**

```bash
$found = Select-String -Path (Get-ChildItem -Recurse -Include "*.ts", "*.tsx" | Where-Object { $_.DirectoryName -notmatch 'node_modules' -and $_.DirectoryName -notmatch '\.next' }) -Pattern "lucide-react"
if ($found) { Write-Host "FOUND: $found" } else { Write-Host "No lucide-react references remain" }
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: All checks pass

- [ ] **Step 3: Build check (optional)**

Run: `npm run build --webpack`
Expected: Build succeeds without errors

