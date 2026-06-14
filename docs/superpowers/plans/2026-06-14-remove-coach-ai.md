# Remove Coach AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus seluruh fitur Coach AI (Coach Card) dari aplikasi: backend, UI, schema, env vars, dan dokumentasi.

**Architecture:** Penghapusan dilakukan secara bertahap: backend (convex) → schema → UI → env → regenerate types. Setiap langkah diverifikasi sebelum lanjut.

**Tech Stack:** Next.js, Convex, TypeScript, Tailwind CSS

---

### Task 1: Hapus backend file `convex/coach.ts`

**Files:**
- Delete: `convex/coach.ts`

- [ ] **Step 1: Hapus file coach.ts**

```bash
Remove-Item -LiteralPath "convex/coach.ts"
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "chore: remove convex/coach.ts (Coach AI backend)"
```

---

### Task 2: Hapus tabel `coachInsights` dari schema

**Files:**
- Modify: `convex/schema.ts:234-252`

- [ ] **Step 1: Hapus definisi tabel coachInsights**

Hapus block berikut dari `convex/schema.ts`:

```typescript
  coachInsights: defineTable({
    householdId: v.id("households"),
    month: v.number(),
    year: v.number(),
    dataHash: v.string(),
    signals: v.array(v.object({
      type: v.union(v.literal("danger"), v.literal("warning"), v.literal("info"), v.literal("success")),
      category: v.union(v.literal("budget"), v.literal("spending"), v.literal("saving"), v.literal("recurring"), v.literal("general")),
      title: v.string(),
      message: v.string(),
      tip: v.optional(v.string()),
      actionLabel: v.optional(v.string()),
      actionHref: v.optional(v.string()),
    })),
    geminiInsight: v.optional(v.string()),
    insightSource: v.union(v.literal("rule"), v.literal("gemini")),
    generatedAt: v.number(),
  })
    .index("by_householdId_month", ["householdId", "month", "year"]),
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "chore: remove coachInsights table from schema"
```

---

### Task 3: Hapus CoachCard dari dashboard page

**Files:**
- Modify: `app/dashboard/page.tsx:16` (hapus import)
- Modify: `app/dashboard/page.tsx:196` (hapus mobile rendering)
- Modify: `app/dashboard/page.tsx:209-218` (hapus desktop rendering)

- [ ] **Step 1: Hapus import CoachCard**

Di `app/dashboard/page.tsx`, hapus baris:
```typescript
import { CoachCard } from '@/components/dashboard/CoachCard'
```

- [ ] **Step 2: Hapus rendering mobile CoachCard**

Di `app/dashboard/page.tsx`, hapus baris:
```typescript
              <motion.div variants={fadeInUp}><CoachCard householdId={householdId} /></motion.div>
```

- [ ] **Step 3: Hapus blok desktop CoachCard**

Di `app/dashboard/page.tsx`, hapus block:
```typescript
      {/* Desktop: Coach Card */}
      {householdId && (
        <motion.div
          className="hidden md:block mb-6"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <CoachCard householdId={householdId} />
        </motion.div>
      )}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: remove CoachCard from dashboard page"
```

---

### Task 4: Hapus file komponen CoachCard

**Files:**
- Delete: `components/dashboard/CoachCard.tsx`

- [ ] **Step 1: Hapus file**

```bash
Remove-Item -LiteralPath "components/dashboard/CoachCard.tsx"
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "chore: remove CoachCard component"
```

---

### Task 5: Hapus dokumentasi Coach AI

**Files:**
- Delete: `docs/superpowers/specs/2025-06-13-coach-ai-design.md`
- Delete: `docs/superpowers/plans/2025-06-13-coach-ai-plan.md`

- [ ] **Step 1: Hapus file dokumentasi**

```bash
Remove-Item -LiteralPath "docs/superpowers/specs/2025-06-13-coach-ai-design.md"
Remove-Item -LiteralPath "docs/superpowers/plans/2025-06-13-coach-ai-plan.md"
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "chore: remove Coach AI documentation"
```

---

### Task 6: Hapus environment variables AI

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Hapus AI-related env vars**

Di `.env.local`, hapus baris:
```
CONVEX_GEMINI_API_KEY = <redacted>
OPENROUTER_API_KEY = <redacted>
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "chore: remove AI environment variables"
```

---

### Task 7: Regenerate types dan verifikasi build

**Files:**
- Auto: `convex/_generated/` (akan diregenerasi)

- [ ] **Step 1: Generate ulang Convex types**

```bash
npx convex codegen
```

Expected: convex/_generated/api.d.ts tidak lagi menyertakan module `coach`.

- [ ] **Step 2: Build verifikasi**

```bash
npm run build
```

Expected: Build sukses tanpa error terkait CoachCard, coach module, atau coachInsights.

- [ ] **Step 3: Commit hasil regenerasi**

```bash
git add -A && git commit -m "chore: regenerate convex types after Coach AI removal"
```
