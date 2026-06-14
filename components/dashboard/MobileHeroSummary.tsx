'use client'

import { formatCurrency } from '@/lib/utils'
import { calculateFiscalDaysRemaining, getFiscalDate, getFiscalMonthRange } from '@/lib/finance-utils'
import { differenceInCalendarDays } from 'date-fns'

type SummaryData = {
  liquidCash: number
  remainingBudget: number
}

type Props = {
  summary: SummaryData | undefined | null
  isPrivacyMode?: boolean
  budgetStartDay?: number
}

export function MobileHeroSummary({ summary, isPrivacyMode, budgetStartDay }: Props) {
  const startDay = budgetStartDay ?? 1
  const daysRemaining = calculateFiscalDaysRemaining(startDay)
  const now = new Date()
  const fiscalDate = getFiscalDate(now, startDay)
  const { start, end } = getFiscalMonthRange(fiscalDate.getFullYear(), fiscalDate.getMonth(), startDay)
  const totalFiscalDays = differenceInCalendarDays(end, start) + 1
  const fiscalDayNumber = differenceInCalendarDays(now, start) + 1
  const dailyAllowance = daysRemaining > 0
    ? Math.max(0, (summary?.remainingBudget || 0) / daysRemaining)
    : 0

  return (
    <div className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-5 shadow-lg">
      <div className="space-y-1 mb-4">
        <p className="text-xs font-medium opacity-80 tracking-wide">BUDGET LEFT</p>
        <p className="text-3xl font-bold tracking-tight">
          {formatCurrency(summary?.remainingBudget || 0, { isPrivacyMode })}
        </p>
      </div>
      <div className="flex items-center justify-between bg-black/10 rounded-xl px-4 py-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs opacity-80">Daily Allowance</span>
          <span className="text-lg font-bold">
            {formatCurrency(dailyAllowance, { isPrivacyMode })}
          </span>
        </div>
        <span className="text-xs font-medium bg-white/20 px-3 py-1 rounded-full">
          Day {fiscalDayNumber}/{totalFiscalDays}
        </span>
      </div>
    </div>
  )
}
