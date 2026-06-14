# Remove Coach AI Feature

## Goal
Remove seluruh fitur Coach AI (Coach Card) beserta backend, schema, dokumentasi, dan environment variables.

## Scope

### Files to Delete
- `convex/coach.ts` — backend rule engine, OpenRouter AI calls, getInsight/refreshInsight/askCoach actions
- `components/dashboard/CoachCard.tsx` — UI card component (421 lines)
- `docs/superpowers/specs/2025-06-13-coach-ai-design.md`
- `docs/superpowers/plans/2025-06-13-coach-ai-plan.md`

### Files to Edit
- `convex/schema.ts` — hapus definisi tabel `coachInsights`
- `app/dashboard/page.tsx` — hapus import dan dua rendering CoachCard (mobile & desktop)

### Environment
- `.env.local` — hapus `OPENROUTER_API_KEY` dan `CONVEX_GEMINI_API_KEY`

### Post-Removal
- `npx convex codegen` — regenerate API types (coach module otomatis hilang)
- Verify build (`npm run build`)

## Exclusions
- Dokumen `2025-06-12-dashboard-coaching-redesign.md` tetap dipertahankan (desain dashboard yang lebih luas)
- Dokumen `2025-06-12-phase4-polish-recurring-design.md` tetap dipertahankan (mengutip Coach AI hanya sebagai future reference)
- Semua dashboard komponen lain tidak tersentuh

## Layout Impact
- Mobile: CoachCard adalah kartu pertama; setelah dihapus, DailyGuidance menjadi kartu pertama
- Desktop: CoachCard adalah blok full-width sebelum grid; grid akan langsung mulai dari atas
- Tidak ada gap/layout break karena semua komponen sudah dalam motion.div masing-masing
