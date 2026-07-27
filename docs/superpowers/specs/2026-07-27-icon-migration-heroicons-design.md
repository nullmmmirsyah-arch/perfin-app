# Icon Migration: lucide-react → HeroIcons (via Iconify)

## Goal
Migrate seluruh icon dari `lucide-react` ke HeroIcons via `@iconify-icon/react` untuk konsistensi visual.

## Approach: Wrapper Components
Buat file `components/ui/icons.tsx` yang mengekspor setiap HeroIcons sebagai komponen React bernama. Kode di komponen lain hanya perlu mengganti 1 baris import — tanpa mengubah JSX sama sekali.

## Variant Strategy
- **Outline (`heroicons-outline:xxx`)** — untuk ~85% icon: navigasi, aksi umum, status info, UI elements
- **Solid (`heroicons-solid:xxx`)** — untuk icon yang butuh emphasis visual: `Loader2`, `CheckCircle2`, `Star`, `Heart`, `ShieldCheck`, `AlertTriangle`, `AlertCircle`, `XCircle`

## Step-by-Step
1. Install `@iconify-icon/react` — hapus `lucide-react` dari package.json
2. Generate `components/ui/icons.tsx` dengan wrapper untuk ~95 icon
3. Replace seluruh import `from 'lucide-react'` → `from '@/components/ui/icons'`
4. Hapus direct lucide-react import di `MerchantIconPicker.tsx` (ganti dengan wrapper)
5. `npm run lint` untuk verifikasi

## Mapping Notes
- `lucide-react` → `heroicons-outline` (default) atau `heroicons-solid` (jika tercantum)
- Icon name: camelCase lucide → kebab-case HeroIcons (contoh: `CheckCircle2` → `check-circle`)
- `LucideIcon` type → ganti dengan `React.ComponentType<SVGProps<SVGSVGElement>>` atau type dari wrapper

## Trade-offs
- Wrapper file ~95 exports — file besar, tapi import-nya bersih
- Jika HeroIcons tidak punya padanan exact, pilih padanan terdekat (contoh: `PartyPopper` → `emoji-happy`)
- `PiggyBank` tidak ada di HeroIcons → fallback ke `cash` atau `currency-dollar`
- `HandCoins` tidak ada → fallback ke `cash`
