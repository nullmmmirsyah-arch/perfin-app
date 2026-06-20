'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency, parseAmount } from '@/lib/utils'
import { calculateBudgetPace, calculateFiscalDaysRemaining, type PacingStatus } from '@/lib/finance-utils'
import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type BudgetBreakdownItem = {
  categoryId: string
  categoryName: string
  categoryType: string
  limit: number
  spent: number
  remaining: number
  enablePacing?: boolean
  accumulated: number
  targetAmount?: number
  targetDate?: string
  goalType?: string
}

type SplitDetail = {
  categoryId: string
  amount: string
  description?: string
  labelId?: string
  categoryName?: string
  labelName?: string
  labelColor?: string
}

type TransactionWithDetails = {
  _id: string
  date: string
  amount: number | string
  type: string
  description?: string
  categoryName?: string
  isSplit?: boolean
  splits?: SplitDetail[]
}

type SummaryData = {
  remainingBudget: number
  budgetBreakdown: BudgetBreakdownItem[]
  recentTransactions: TransactionWithDetails[]
}

type Props = {
  summary: SummaryData | undefined | null
  isPrivacyMode?: boolean
  budgetStartDay?: number
}

type OverallStatus = 'on_track' | 'spending_faster' | 'slow_down'

function computeOverallStatus(breakdown: BudgetBreakdownItem[], startDay: number = 1): OverallStatus {
  if (!breakdown || breakdown.length === 0) return 'on_track'
  const year = new Date().getFullYear()
  const month = new Date().getMonth()
  let hasWarning = false
  for (const item of breakdown) {
    if (item.enablePacing === false || item.limit <= 0) continue
    const pace = calculateBudgetPace(item.spent, item.limit, year, month, startDay)
    if (pace.status === 'danger') return 'slow_down'
    if (pace.status === 'warning') hasWarning = true
  }
  return hasWarning ? 'spending_faster' : 'on_track'
}

function isToday(dateStr: string): boolean {
  const today = new Date()
  const date = new Date(dateStr)
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function getTxEntries(tx: TransactionWithDetails): { id: string; description: string; amount: number }[] {
  if (tx.isSplit && tx.splits && tx.splits.length > 0) {
    return tx.splits.map(split => ({
      id: tx._id + '-' + split.categoryId,
      description: split.description || tx.description || split.categoryName || 'Split',
      amount: parseAmount(split.amount),
    }))
  }
  return [{
    id: tx._id,
    description: tx.description || tx.categoryName || 'Transaction',
    amount: typeof tx.amount === 'string' ? parseAmount(tx.amount) : (tx.amount ?? 0),
  }]
}

export function MobileBudgetToday({ summary, isPrivacyMode, budgetStartDay }: Props) {
  const startDay = budgetStartDay ?? 1
  const [showSafe, setShowSafe] = useState(false)

  const daysRemaining = calculateFiscalDaysRemaining(startDay)
  const totalBudget = summary?.budgetBreakdown?.reduce((acc, item) => acc + item.limit, 0) || 0
  const totalSpent = summary?.budgetBreakdown?.reduce((acc, item) => acc + item.spent, 0) || 0
  const remaining = summary?.remainingBudget || 0
  const percentUsed = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0
  const dailyAllowance = daysRemaining > 0 ? Math.max(0, remaining / daysRemaining) : 0
  const hasBudgets = (summary?.budgetBreakdown || []).length > 0
  const status = computeOverallStatus(summary?.budgetBreakdown || [], startDay)

  const todayTxns = (summary?.recentTransactions || []).filter(
    (tx: TransactionWithDetails) => isToday(tx.date) && tx.type === 'expense'
  )
  const todayEntries = todayTxns.flatMap(getTxEntries)
  const todaySpent = todayEntries.reduce((acc, entry) => acc + entry.amount, 0)

  const statusConfig = {
    on_track: { label: 'On Track', class: 'bg-success/10 text-success border-success/20' },
    spending_faster: { label: 'Spending Faster', class: 'bg-warning/10 text-warning border-warning/20' },
    slow_down: { label: 'Slow Down', class: 'bg-destructive/10 text-destructive border-destructive/20' },
  } as const
  const config = statusConfig[status]

  const year = new Date().getFullYear()
  const month = new Date().getMonth()

  const pacedItems = (summary?.budgetBreakdown || [])
    .filter(item => item.enablePacing !== false && item.limit > 0)
    .map(item => ({ ...item, pace: calculateBudgetPace(item.spent, item.limit, year, month, startDay) }))

  const dangerItems = pacedItems.filter(item => item.pace.status === 'danger')
  const warningItems = pacedItems.filter(item => item.pace.status === 'warning')
  const safeItems = pacedItems.filter(item => item.pace.status === 'safe')

  const getPaceBarColor = (status: PacingStatus) => {
    switch (status) {
      case 'danger': return 'bg-destructive'
      case 'warning': return 'bg-warning'
      default: return 'bg-success'
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-5 space-y-4">
        {/* Status + overall progress */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-tighter font-semibold">
            Budget Today
          </p>
          {hasBudgets && (
            <Badge variant="outline" className={cn('text-xs font-semibold px-3 py-1', config.class)}>
              {config.label}
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          <Progress value={percentUsed} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(totalSpent, { isPrivacyMode })} spent of {formatCurrency(totalBudget, { isPrivacyMode })}</span>
            <span>{daysRemaining > 0 ? `${daysRemaining}d left` : 'Final day'}</span>
          </div>
        </div>

        {/* Per-category daily allowance */}
        {hasBudgets && pacedItems.length > 0 && (
          <div className="bg-muted/30 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">
              Daily Allowance per Category
            </p>
            {[...dangerItems, ...warningItems].map(item => {
              return (
                <div key={item.categoryId} className="flex items-center justify-between gap-2">
                  <span className="text-xs truncate min-w-0 flex-1">{item.categoryName}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', getPaceBarColor(item.pace.status))} style={{ width: `${Math.min(100, item.pace.spendProgress)}%` }} />
                    </div>
                    <span className="text-xs font-medium tabular-nums shrink-0 w-[68px] text-right">
                      {formatCurrency(item.pace.dailyLimit, { isPrivacyMode })}
                    </span>
                    <span className="text-xs text-muted-foreground">/hari</span>
                  </div>
                </div>
              )
            })}
            {safeItems.length > 0 && (
              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground h-9 justify-start px-2 hover:bg-muted/50"
                onClick={() => setShowSafe(!showSafe)}
              >
                {showSafe ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                {showSafe ? 'Hide on track budgets' : `${safeItems.length} other budget${safeItems.length > 1 ? 's' : ''} on track`}
              </Button>
            )}
            {showSafe && safeItems.map(item => {
              return (
                <div key={item.categoryId} className="flex items-center justify-between gap-2">
                  <span className="text-xs truncate min-w-0 flex-1">{item.categoryName}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', getPaceBarColor(item.pace.status))} style={{ width: `${Math.min(100, item.pace.spendProgress)}%` }} />
                    </div>
                    <span className="text-xs font-medium tabular-nums shrink-0 w-[68px] text-right">
                      {formatCurrency(item.pace.dailyLimit, { isPrivacyMode })}
                    </span>
                    <span className="text-xs text-muted-foreground">/hari</span>
                  </div>
                </div>
              )
            })}
            <Link href="/budgets" className="block text-center text-xs text-primary underline underline-offset-2 mt-1">
              Lihat semua budget →
            </Link>
          </div>
        )}

        {/* Today's spending */}
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Spent Today</span>
            <span className="text-sm font-semibold">
              {formatCurrency(todaySpent, { isPrivacyMode })}
              <span className="text-xs text-muted-foreground font-normal">
                {' '}/ {formatCurrency(dailyAllowance, { isPrivacyMode })}
              </span>
            </span>
          </div>
          {todayEntries.length > 0 ? (
            <div className="space-y-0.5">
              {todayEntries.slice(0, 5).map(entry => (
                <div key={entry.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">• {entry.description}</span>
                  <span className="tabular-nums shrink-0 ml-2 text-destructive">-{formatCurrency(entry.amount, { isPrivacyMode })}</span>
                </div>
              ))}
              {todayEntries.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">+{todayEntries.length - 5} more</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No spending yet today.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
