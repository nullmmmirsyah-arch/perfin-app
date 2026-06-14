'use client'

import { formatCurrency } from '@/lib/utils'
import { calculateFiscalDaysRemaining, getFiscalDate, getFiscalMonthRange } from '@/lib/finance-utils'
import { differenceInCalendarDays } from 'date-fns'

type SummaryData = {
  liquidCash: number
  remainingBudget: number
  budgetStartDay?: number
}

type Props = {
  summary: SummaryData | undefined | null
  isPrivacyMode?: boolean
}

export function MobileHeroSummary({ summary, isPrivacyMode }: Props) {
  const budgetStartDay = summary?.budgetStartDay
  const daysRemaining = calculateFiscalDaysRemaining(budgetStartDay)
  const now = new Date()
  const fiscalDate = getFiscalDate(now, budgetStartDay)
  const { start, end } = getFiscalMonthRange(fiscalDate.getFullYear(), fiscalDate.getMonth(), budgetStartDay)
  const totalFiscalDays = differenceInCalendarDays(end, start) + 1
  const fiscalDayNumber = differenceInCalendarDays(now, start) + 1
  const dailyAllowance = daysRemaining > 0
    ? Math.max(0, (summary?.remainingBudget || 0) / daysRemaining)
    : 0

  return (
    <div className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-5 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <p className="text-xs font-medium opacity-80 tracking-wide">TOTAL BALANCE</p>
          <p className="text-3xl font-bold tracking-tight">
            {formatCurrency(summary?.liquidCash || 0, { isPrivacyMode })}
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs font-medium opacity-80 tracking-wide">BUDGET LEFT</p>
          <p className="text-xl font-semibold">
            {formatCurrency(summary?.remainingBudget || 0, { isPrivacyMode })}
          </p>
        </div>
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
