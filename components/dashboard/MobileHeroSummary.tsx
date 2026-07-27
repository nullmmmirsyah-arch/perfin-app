'use client'

import { formatCurrency } from '@/lib/utils'
import { getFiscalDate, getFiscalMonthRange } from '@/lib/finance-utils'
import { calculateAllowance } from '@/lib/allowance-calculator'
import { differenceInCalendarDays } from 'date-fns'

type BudgetBreakdownItem = {
  categoryId: string
  categoryType: string
  enablePacing?: boolean
  limit: number
  spent: number
  allowanceType?: "budget_period" | "weekly"
  weeklyResetDay?: number
  weeklySpent?: number
}

type SummaryData = {
  liquidCash: number
  remainingBudget: number
  budgetBreakdown?: BudgetBreakdownItem[]
}

type Props = {
  summary: SummaryData | undefined | null
  isPrivacyMode?: boolean
  budgetStartDay?: number
}

export function MobileHeroSummary({ summary, isPrivacyMode, budgetStartDay }: Props) {
  const startDay = budgetStartDay ?? 1
  const now = new Date()
  const fiscalDate = getFiscalDate(now, startDay)
  const { start, end } = getFiscalMonthRange(fiscalDate.getFullYear(), fiscalDate.getMonth(), startDay)
  const totalFiscalDays = differenceInCalendarDays(end, start) + 1
  const fiscalDayNumber = differenceInCalendarDays(now, start) + 1

  // Aggregated daily allowance from per-category calculations (respects allowanceType)
  const dailyAllowance = (summary?.budgetBreakdown ?? []).reduce((sum, item) => {
    if (item.categoryType !== 'expense') return sum
    if (item.enablePacing === false) return sum
    if (item.limit <= 0) return sum
    const a = calculateAllowance({
      allowanceType: item.allowanceType ?? "budget_period",
      weeklyResetDay: item.weeklyResetDay,
      budgetAmount: item.limit,
      spent: item.spent,
      weeklySpent: item.weeklySpent ?? 0,
      fiscalPeriodStart: start,
      fiscalPeriodEnd: end,
      now,
    })
    return sum + a.allowance
  }, 0)

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
