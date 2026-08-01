---
name: Perfin
description: Confidence-driven personal finance tracker — warm, structured, and gently authoritative
colors:
  primary: "oklch(0.6231 0.1880 259.8145)"
  primary-foreground: "oklch(1.0000 0 0)"
  secondary: "oklch(0.9670 0.0029 264.5419)"
  secondary-foreground: "oklch(0.4461 0.0263 256.8018)"
  muted: "oklch(0.9846 0.0017 247.8389)"
  muted-foreground: "oklch(0.48 0.023 264.3637)"
  accent: "oklch(0.9514 0.0250 236.8242)"
  accent-foreground: "oklch(0.3791 0.1378 265.5222)"
  destructive: "oklch(0.6368 0.2078 25.3313)"
  destructive-foreground: "oklch(1.0000 0 0)"
  success: "oklch(0.627 0.194 149.214)"
  success-foreground: "oklch(0.985 0 0)"
  warning: "oklch(0.75 0.16 85)"
  warning-foreground: "oklch(0.985 0 0)"
  background: "oklch(1.0000 0 0)"
  foreground: "oklch(0.3211 0 0)"
  card: "oklch(1.0000 0 0)"
  card-foreground: "oklch(0.3211 0 0)"
  border: "oklch(0.9276 0.0058 264.5313)"
  input: "oklch(0.9276 0.0058 264.5313)"
  ring: "oklch(0.6231 0.1880 259.8145)"
  chart-1: "oklch(0.6231 0.1880 259.8145)"
  chart-2: "oklch(0.5461 0.2152 262.8809)"
  chart-3: "oklch(0.4882 0.2172 264.3763)"
  chart-4: "oklch(0.4244 0.1809 265.6377)"
  chart-5: "oklch(0.3791 0.1378 265.5222)"
typography:
  sans:
    fontFamily: "Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  serif:
    fontFamily: "Source Serif 4, serif"
rounded:
  sm: "calc(0.375rem - 4px)"
  md: "calc(0.375rem - 2px)"
  lg: "0.375rem"
  xl: "calc(0.375rem + 4px)"
  "2xl": "calc(0.375rem + 8px)"
  "3xl": "calc(0.375rem + 12px)"
  "4xl": "calc(0.375rem + 16px)"
  full: "9999px"
spacing:
  sm: "0.25rem"
  md: "0.5rem"
  lg: "1rem"
  xl: "1.5rem"
  "2xl": "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "inherit"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
---

# Design System: Perfin

## Overview

**Creative North Star: "The Friendly Guide"**

Perfin's visual identity is that of a knowledgeable, warm companion helping you navigate your finances. It never lectures or overwhelms. Every screen feels organized without being clinical, professional without being cold. The system prioritizes clarity and comprehension — financial data is presented with gentle authority, making complex information feel approachable and manageable.

The design language balances structure with warmth. Cards are gently curved, spacing is generous but purposeful, and the blue primary color acts as a quiet guide through the interface rather than shouting for attention. Motion is minimal and meaningful — count animations on budget numbers, smooth drawer transitions, subtle hover lifts. The overall impression is of a well-organized desk where everything has its place and nothing is hidden.

**Key Characteristics:**
- Warm, approachable typography with clear hierarchy
- Soft color accents that guide without overwhelming
- Generous spacing that creates breathing room for financial data
- Subtle depth through shadows that appear on interaction, not at rest
- Purposeful motion that reinforces comprehension

## Colors

The palette is restrained and functional. The primary blue carries guidance; semantic colors (success, destructive, warning) communicate financial status instantly. Neutrals are cool-toned zinc, never warm gray.

### Primary

- **Soft Authority Blue** (oklch(0.6231 0.1880 259.8145)): Active states, primary CTAs, focus rings, navigation highlights. Used sparingly — it appears when the system needs to guide, not when it needs to inform.

### Neutral

- **Cool Paper** (oklch(1.0000 0 0)): Backgrounds, card surfaces. Clean and airy.
- **Soft Border** (oklch(0.9276 0.0058 264.5313)): Dividers, input borders, card borders. Subtle structure.
- **Muted Text** (oklch(0.5510 0.0234 264.3637)): Secondary labels, descriptions, timestamps. Never competes with foreground.
- **Deep Ink** (oklch(0.3211 0 0)): Primary text, headings. High contrast on light surfaces.

### Semantic

- **Success Green** (oklch(0.627 0.194 149.214)): Income, positive cashflow, goal reached, on-track budgets. Appears on completed savings goals and healthy spending states.
- **Destructive Red** (oklch(0.6368 0.2078 25.3313)): Expenses, over-budget warnings, delete actions, negative cashflow. Used for financial loss and destructive operations.
- **Warning Amber** (oklch(0.75 0.16 85)): Caution states, pace warnings. Bridges the gap between healthy and over-budget.

### Named Rules

**The Guidance Rule.** The primary blue is reserved for states that require user action or attention. It highlights what's interactive, not what's informational. A category name in a list stays neutral; the same category name inside a budget card with a "Set Limit" button becomes primary.

**The Semantic Integrity Rule.** Success, destructive, and warning colors never appear as decorative accents. They are reserved exclusively for financial status communication — income/expense direction, budget health, and goal progress. Using green for a non-financial positive state or red for a non-destructive action breaks the trust contract.

## Typography

**Display Font:** Inter (with system sans-serif fallback)
**Body Font:** Inter (with system sans-serif fallback)
**Mono Font:** JetBrains Mono (with monospace fallback)

**Character:** Inter is the friendly professional — clear at every size, never personality-forward. It lets the financial data speak while maintaining warmth through generous spacing and weight contrast. The type system uses weight (400/500/600/700) more than size to establish hierarchy, keeping the interface compact without sacrificing readability.

### Hierarchy

- **Card Title** (600 weight, 1rem, line-height 1.25): Category names, goal names, section headers inside cards. The primary identifier in any container.
- **Body** (400 weight, 0.875rem, line-height 1.5): Transaction descriptions, labels, helper text. Optimized for scannability.
- **Label** (500 weight, 0.75rem, letter-spacing 0.01em): Form labels, field names, metadata. Slightly elevated to distinguish from content.
- **Micro** (400 weight, 0.625rem, line-height 1.4): Inline badges, label dots, compact metadata. Used where space is extremely constrained.
- **Mono** (400 weight, 0.875rem): Amounts, codes, data values where alignment matters. Used in budget calculations and financial summaries.

### Named Rules

**The Amount Visibility Rule.** Financial amounts are always rendered in a weight no lighter than 500, often 600-700. The number is the hero of every transaction row, budget card, and balance display. Secondary information around it (labels, dates, categories) uses lighter weight and muted color to create contrast.

## Layout

The layout system is mobile-first with a responsive breakpoint at 768px (md). On mobile, the interface uses a single-column layout with a fixed bottom navigation bar. On desktop, a persistent sidebar anchors navigation while content fills the remaining space.

**Spacing rhythm:** The base unit is 4px (0.25rem). Content blocks use 16px (1rem) internal padding. Cards use 20-24px (1.25-1.5rem) padding. The space above a section heading is greater than the space below it, creating clear visual separation between groups.

**Container behavior:** Cards and drawers use `rounded-xl` (calc(0.375rem + 4px) ≈ 10px) corners. Content within cards uses consistent horizontal padding (px-6 = 24px). The bottom nav uses `backdrop-blur-lg` for a frosted glass effect over content.

**Mobile density:** Lists and card grids use tighter vertical spacing (gap-3 = 12px) to maximize information density on small screens. The bottom nav occupies exactly 64px height with safe area padding for devices with home indicators.

**Desktop density:** Sidebar uses 200-240px width. Content area uses generous margins (p-6 = 24px). Cards in grid layouts use gap-4 (16px) to maintain visual connection between related items.

## Elevation & Depth

The system uses a hybrid approach: flat cards at rest, lifted interactions on hover and focus. This creates a clear affordance model — you see the data at rest, you feel the interaction when you engage.

### Shadow Vocabulary

- **Resting Card** (`box-shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10)`): Applied to cards and elevated surfaces. A subtle, barely-perceptible lift that separates content from background without drawing attention.
- **Hover Card** (`box-shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10)`): Slightly stronger shadow on interactive elements. Signals "this is tappable/clickable."
- **Drawer Overlay** (`bg-black/80`): Full-screen overlay for modal drawers. Heavy enough to isolate the drawer, not so dark it feels oppressive.
- **Bottom Nav** (`backdrop-blur-lg`): Frosted glass effect. The nav floats over content without fully obscuring it, maintaining spatial context.

### Named Rules

**The Interaction Shadow Rule.** Shadows are earned through interaction, not applied as decoration. A card at rest has a whisper of depth. On hover, the shadow deepens slightly. On focus, the ring appears. This progression (flat → lifted → focused) teaches users where they are in the interaction hierarchy.

**The Blur Boundary Rule.** Backdrop blur is reserved for surfaces that float over content — the bottom navigation bar, popovers, and dropdown menus. It never appears on cards, drawers, or fixed panels that occupy their own spatial layer.

## Shapes

The form language is softly geometric. Corners are consistently rounded but never pill-shaped for containers. The base radius is `0.375rem` (6px), scaling up for larger elements (cards at `~10px`, drawers at `~12px`).

**Border treatment:** 1px borders in `oklch(0.9276 0.0058 264.5313)` provide subtle structure without visual weight. Borders never exceed 1px except on focused inputs where the ring takes over. Dashed borders appear on empty state CTAs and "set limit" buttons, signaling an invitation rather than a container.

**Corner strategy:** Small elements (badges, chips, tags) use `rounded-full` for pill shapes. Medium elements (buttons, inputs, cards) use the scaled radius system. Large elements (drawers, modals) use `rounded-t-xl` for top corners only, creating the visual metaphor of a surface sliding up from below.

**Clipping:** Content never bleeds outside its container. Cards use `overflow-hidden` to respect their border-radius. Labels and badges use `overflow-hidden` to handle text truncation gracefully.

## Components

### Buttons

- **Shape:** `rounded-md` (calc(0.375rem - 2px) ≈ 4px). Compact, confident radius.
- **Primary:** `bg-primary text-primary-foreground` with `h-9 px-4 py-2`. The workhorse CTA. Appears on the bottom nav FAB, form submissions, and primary actions.
- **Hover:** `hover:bg-primary/90` — subtle darkening, no lift or scale. The interaction feels solid, not playful.
- **Secondary:** `bg-secondary text-secondary-foreground`. For secondary actions that need visual presence without dominance.
- **Ghost:** `hover:bg-accent hover:text-accent-foreground`. For icon buttons, menu triggers, and inline actions. Appears only on hover.
- **Destructive:** `bg-destructive text-white`. Reserved exclusively for delete/remove actions. Always paired with confirmation.
- **Sizes:** `h-8` (sm), `h-9` (default), `h-10` (lg). Icon-only buttons use `size-9` with centered icon.

### Cards

- **Corner Style:** `rounded-xl` (calc(0.375rem + 4px) ≈ 10px). Gentle, approachable curves.
- **Background:** `bg-card` (white in light, dark surface in dark mode). Clean, content-forward.
- **Shadow Strategy:** `shadow-sm` at rest, `hover:shadow-md` on interaction. The hybrid lift model.
- **Border:** 1px `border-border`. Present but subtle — provides structure without visual weight.
- **Internal Padding:** `py-6 px-6` (24px vertical, 24px horizontal). Generous breathing room for financial data.
- **Content Grid:** Cards use `flex flex-col gap-6` for vertical rhythm between sections.

### Inputs

- **Style:** `border-input h-9 rounded-md border bg-transparent px-3 py-1`. Clean, minimal, focused.
- **Focus:** `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`. The ring appears as a soft glow, not a hard outline.
- **Error:** `aria-invalid:ring-destructive/20 aria-invalid:border-destructive`. Red ring and border for validation errors.
- **Disabled:** `disabled:opacity-50 disabled:cursor-not-allowed`. Clear de-emphasis without hiding.

### Badges

- **Shape:** `rounded-full`. Always pill-shaped. Compact and inline.
- **Default:** `bg-primary text-primary-foreground`. For active states and primary labels.
- **Outline:** `text-foreground border`. For informational tags and secondary labels.
- **Destructive:** `bg-destructive text-white`. For urgent warnings and error states.
- **Size:** `px-2 py-0.5 text-xs`. Small enough to sit inline with text, large enough to read.

### Progress Bars

- **Track:** `h-4 rounded-full bg-secondary`. Neutral background for the unfilled portion.
- **Fill:** `h-full bg-primary` with `transition-all`. Smooth, animated fill that responds to value changes.
- **Variant Heights:** `h-2` for compact contexts (goal cards), `h-2.5` for budget cards (more visual weight), `h-4` for standalone progress displays.
- **Color States:** `bg-primary` (default/healthy), `bg-success` (goal met), `bg-destructive` (over-budget), `bg-yellow-500` (warning pace).

### Navigation (Mobile Bottom Nav)

- **Style:** Fixed bottom, `bg-background/80 backdrop-blur-lg border-t`. Frosted glass that floats over content.
- **Height:** `h-16` (64px). Standard mobile nav height.
- **Items:** 5 items — 4 regular links + centered FAB. Icons are 16px (`h-4 w-4`), labels are 10px.
- **Active State:** `text-primary font-medium`. Color + weight shift. No background highlight.
- **Inactive State:** `text-muted-foreground`. Subtle, receding.
- **FAB:** 40px circle (`h-10 w-10 rounded-full bg-primary`), elevated 16px above nav with `shadow-lg` and `border-4 border-background` for visual separation.

### Navigation (Desktop Sidebar)

- **Style:** Persistent left sidebar using shadcn/ui Sidebar primitives. `bg-sidebar` with `border-r border-sidebar-border`.
- **Width:** Collapsible between collapsed (icons only) and expanded (icons + labels).
- **Active State:** `bg-sidebar-accent text-sidebar-accent-foreground`. Subtle background tint.
- **Hover State:** `hover:bg-sidebar-accent/50`. Even more subtle than mobile.

### Drawers (Vaul)

- **Overlay:** `bg-black/80`. Heavy but not oppressive.
- **Container:** `rounded-t-xl border bg-background`. Top corners rounded, content flows from bottom.
- **Handle:** `h-2 w-[100px] rounded-full bg-muted`. Centered drag handle for discoverability.
- **Header:** `grid gap-1.5 p-4`. Consistent internal padding.
- **Footer:** `mt-auto flex flex-col gap-2 p-4`. Actions pinned to bottom.

### Dropdown Menus

- **Style:** `bg-popover text-popover-foreground border rounded-md shadow-md`. Floats above content with moderate shadow.
- **Items:** `relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm`. Hover state: `bg-accent text-accent-foreground`.
- **Destructive Items:** `text-destructive focus:text-destructive`. Red text, not red background.

## Do's and Don'ts

### Do:
- **Do** use the primary blue sparingly — it guides, it doesn't decorate. One primary CTA per view is usually enough.
- **Do** show financial amounts in bold weight (500-700). The number is always the hero.
- **Do** use semantic colors (success/destructive/warning) exclusively for financial status. Never for decorative purposes.
- **Do** maintain consistent 16px internal padding within cards and containers.
- **Do** use `shadow-sm` at rest and `hover:shadow-md` for interactive cards. The progression teaches affordance.
- **Do** show skeleton loaders while data fetches. Never flash empty states during loading.
- **Do** use dashed borders for invitations ("Set Limit", "Create Account") and solid borders for containers.

### Don't:
- **Don't** use gradient text. Emphasis comes from weight and size, not color tricks.
- **Don't** apply shadows as decoration. Shadows exist to communicate depth and interactivity, not to make things look "fancy."
- **Don't** use the primary blue for non-interactive elements. If it's not clickable or active, it shouldn't be primary-colored.
- **Don't** exceed 1px on borders. Thicker borders compete with content for visual attention.
- **Don't** use modal dialogs for tasks that don't require interruption or protected focus. Use drawers instead.
- **Don't** show empty states while data is still loading. Guard with `=== undefined` checks first.
- **Don't** use emoji as icons. Icons are drawn, from Lucide or custom SVG, in consistent stroke weight.
