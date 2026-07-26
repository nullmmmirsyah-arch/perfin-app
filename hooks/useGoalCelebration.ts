'use client'

import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import type { Id } from '../../convex/_generated/dataModel'

const celebratedIds = new Set<string>()

export function useGoalCelebration(categoryId: Id<'categories'> | undefined, isGoalMet: boolean) {
  const hasCelebrated = useRef(false)

  useEffect(() => {
    if (!categoryId || !isGoalMet) return
    const key = String(categoryId)
    if (hasCelebrated.current || celebratedIds.has(key)) return

    hasCelebrated.current = true
    celebratedIds.add(key)

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!prefersReduced) {
      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#22c55e', '#3b82f6', '#eab308'],
      })
    }
  }, [categoryId, isGoalMet])
}
