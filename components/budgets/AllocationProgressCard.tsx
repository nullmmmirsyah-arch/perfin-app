'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { PieChart, ArrowRight } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import { fadeInUp } from '@/lib/animations'
import { getAllocationNudge } from '@/lib/allocation-nudge'
import confetti from 'canvas-confetti'

interface AllocationProgressCardProps {
  unassignedCash: number
  breakdown: {
    pastSurplus: number
    thisMonthIncome: number
    thisMonthBudgeted: number
  } | undefined
  onMoveFunds: () => void
  isAdmin: boolean
  isPastMonth: boolean
}

export default function AllocationProgressCard({
  unassignedCash,
  breakdown,
  onMoveFunds,
  isAdmin,
  isPastMonth,
}: AllocationProgressCardProps) {
  const prevPercentRef = useRef<number | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)

  const totalIncome = (breakdown?.pastSurplus ?? 0) + (breakdown?.thisMonthIncome ?? 0)
  const totalBudgeted = breakdown?.thisMonthBudgeted ?? 0
  const allocationPercent = totalIncome > 0
    ? Math.min(100, Math.max(0, (totalBudgeted / totalIncome) * 100))
    : 0
  const displayPercent = Math.round(allocationPercent)

  const nudge = getAllocationNudge(
    totalIncome > 0 ? (totalBudgeted / totalIncome) * 100 : 0,
    unassignedCash
  )

  useEffect(() => {
    const prev = prevPercentRef.current
    if (prev !== null && prev < 100 && allocationPercent >= 100) {
      setShowCelebration(true)
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!prefersReduced) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        })
      }
      const timer = setTimeout(() => setShowCelebration(false), 3000)
      return () => clearTimeout(timer)
    }
    prevPercentRef.current = allocationPercent
  }, [allocationPercent])

  if (!isAdmin || isPastMonth || totalIncome === 0) return null

  const isComplete = unassignedCash === 0
  const isOver = unassignedCash < 0

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-card border rounded-xl p-5 shadow-sm overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <PieChart className="h-24 w-24 rotate-12" />
      </div>
      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            Budget Allocation
          </p>
          {isComplete && (
            <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
              Complete
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className={cn(
            'text-4xl font-black tracking-tighter',
            isOver ? 'text-destructive' : isComplete ? 'text-success' : 'text-foreground'
          )}>
            {displayPercent}%
          </span>
          <span className="text-sm text-muted-foreground font-medium">assigned</span>
        </div>

        <Progress
          value={allocationPercent}
          className={cn(
            'h-3.5',
            isComplete ? '[&>div]:bg-success' : isOver ? '[&>div]:bg-destructive' : ''
          )}
        />

        <p className="text-xs text-muted-foreground">
          {formatCurrency(totalBudgeted)} dari {formatCurrency(totalIncome)} assigned
        </p>

        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[100px] bg-muted/40 px-3 py-2 rounded-lg border border-muted/50">
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight mb-0.5">Income</p>
            <p className="text-sm font-bold tracking-tight">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="flex-1 min-w-[100px] bg-muted/40 px-3 py-2 rounded-lg border border-muted/50">
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight mb-0.5">Budgeted</p>
            <p className="text-sm font-bold tracking-tight">{formatCurrency(totalBudgeted)}</p>
          </div>
          <div className={cn(
            'flex-1 min-w-[100px] px-3 py-2 rounded-lg border',
            isOver
              ? 'bg-destructive/5 border-destructive/20'
              : isComplete
                ? 'bg-success/5 border-success/20'
                : 'bg-primary/5 border-primary/10'
          )}>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight mb-0.5">Unassigned</p>
            <p className={cn(
              'text-sm font-bold tracking-tight',
              isOver ? 'text-destructive' : isComplete ? 'text-success' : 'text-primary'
            )}>
              {formatCurrency(unassignedCash)}
            </p>
          </div>
        </div>

        <p className={cn(
          'text-xs italic',
          nudge.variant === 'success' ? 'text-success' : 'text-muted-foreground'
        )}>
          {nudge.message}
        </p>

        {!isComplete && (
          <Button
            variant="default"
            size="sm"
            onClick={onMoveFunds}
            className="w-full h-9 text-xs"
          >
            Move Funds
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        )}
      </div>
    </motion.div>
  )
}
