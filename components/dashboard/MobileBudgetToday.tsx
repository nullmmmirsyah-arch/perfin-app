'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency, parseAmount } from '@/lib/utils'
import { calculateBudgetPace, calculateFiscalDaysRemaining, getFiscalDateDetails, type PacingStatus } from '@/lib/finance-utils'
import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BudgetCategorySheet } from './BudgetCategorySheet'

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
  const { year, month } = getFiscalDateDetails(new Date().toISOString(), startDay)
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'remaining'>('daily')

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

  const { year, month } = getFiscalDateDetails(new Date().toISOString(), startDay)

  const pacedItems = (summary?.budgetBreakdown || [])
    .filter(item => item.enablePacing !== false && item.limit > 0)
    .map(item => ({ ...item, pace: calculateBudgetPace(item.spent, item.limit, year, month, startDay) }))

  const dangerItems = pacedItems.filter(item => item.pace.status === 'danger')
  const warningItems = pacedItems.filter(item => item.pace.status === 'warning')
  const safeItems = pacedItems.filter(item => item.pace.status === 'safe')

  const pacedItemsMap = new Map(pacedItems.map(item => [item.categoryId, item]))
  const selectedItem = selectedCategoryId
    ? (summary?.budgetBreakdown?.find(i => i.categoryId === selectedCategoryId) ?? null)
    : null
  const selectedPace = selectedCategoryId ? (pacedItemsMap.get(selectedCategoryId)?.pace ?? null) : null

  const getPaceBarColor = (status: PacingStatus) => {
    switch (status) {
      case 'danger': return 'bg-destructive'
      case 'warning': return 'bg-warning'
      default: return 'bg-success'
    }
  }

  const renderCategoryRow = (item: typeof pacedItems[number]) => {
    const weeklyLimit = item.pace.daysRemaining >= 7
      ? item.pace.dailyLimit * 7
      : item.remaining

    const displayValue = viewMode === 'daily'
      ? { value: item.pace.dailyLimit, suffix: '/hari' }
      : viewMode === 'weekly'
      ? { value: weeklyLimit, suffix: '/minggu' }
      : { value: item.remaining, suffix: 'sisa' }

    return (
      <button
        key={item.categoryId}
        type="button"
        onClick={() => setSelectedCategoryId(item.categoryId)}
        className="w-full text-left space-y-1.5 group rounded-xl bg-muted/30 hover:bg-muted/50 active:bg-muted/60 px-3 py-2 -mx-1 transition-colors active:scale-[0.99]"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium truncate min-w-0 flex-1">{item.categoryName}</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
            <span className="hidden sm:inline">Detail</span>
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted-foreground/10 group-hover:bg-muted-foreground/20 transition-colors">
              <ChevronRight className="h-3 w-3" />
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', getPaceBarColor(item.pace.status))}
              style={{ width: `${Math.min(100, item.pace.spendProgress)}%` }}
            />
          </div>
          <span className="text-xs font-medium tabular-nums shrink-0">
            {formatCurrency(displayValue.value, { isPrivacyMode })}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">{displayValue.suffix}</span>
        </div>
      </button>
    )
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-5 space-y-4">
        {/* Status + overall progress */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-tighter font-semibold">
            Budget Tracker
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

        {/* Per-category budget */}
        {hasBudgets && pacedItems.length > 0 && (
          <div className="bg-muted/30 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">
              Budget per Category
            </p>
            <div className="flex items-center gap-0.5 bg-muted-foreground/10 rounded-lg p-0.5 w-full">
              {(['daily', 'weekly', 'remaining'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors flex-1 text-center',
                    viewMode === mode
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground/60 hover:text-muted-foreground'
                  )}
                >
                  {mode === 'daily' ? 'Harian' : mode === 'weekly' ? 'Mingguan' : 'Sisa'}
                </button>
              ))}
            </div>
            {[...dangerItems, ...warningItems].map(renderCategoryRow)}
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
            {showSafe && safeItems.map(renderCategoryRow)}
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
        {selectedItem && selectedPace && (
          <BudgetCategorySheet
            item={selectedItem}
            pace={selectedPace}
            isPrivacyMode={isPrivacyMode}
            open={selectedCategoryId !== null}
            onOpenChange={(open) => {
              if (!open) setSelectedCategoryId(null)
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}
