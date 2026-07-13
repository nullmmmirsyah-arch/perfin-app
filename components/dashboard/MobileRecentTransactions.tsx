'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency, parseAmount } from '@/lib/utils'
import { isToday, isYesterday, format } from 'date-fns'
import { TransactionWithDetails } from '@/components/transactions/types'
import { ArrowRight, ChevronDown, Edit, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

type Props = {
  transactions: TransactionWithDetails[]
  onEdit: (tx: TransactionWithDetails) => void
  onDelete: (tx: TransactionWithDetails) => void
  isPrivacyMode?: boolean
}

const MAX_VISIBLE = 5

function getShortDateLabel(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Hari ini'
  if (isYesterday(date)) return 'Kemarin'
  return format(date, 'd MMM yyyy')
}

function getDotColor(type: string) {
  switch (type) {
    case 'expense': return 'bg-destructive'
    case 'income': return 'bg-success'
    default: return 'bg-primary'
  }
}

function getAmountColor(type: string) {
  switch (type) {
    case 'expense': return 'text-destructive'
    case 'income': return 'text-success'
    default: return 'text-primary'
  }
}

function getAmountPrefix(type: string) {
  switch (type) {
    case 'expense': return '-'
    case 'income': return '+'
    default: return ''
  }
}

function getSplitDescription(tx: TransactionWithDetails): string {
  if (tx.description) return tx.description
  const splits = tx.splits
  if (splits && splits.length > 0) {
    const names = splits.map(s => s.description || s.categoryName || 'Item').filter(Boolean)
    if (names.length <= 2) return names.join(', ')
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} lainnya`
  }
  return 'Split transaction'
}

export function MobileRecentTransactions({ transactions, onEdit, onDelete, isPrivacyMode }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const allTxs = transactions || []

  const { grouped, sortedKeys, remaining } = useMemo(() => {
    const slice = allTxs.slice(0, MAX_VISIBLE)
    const restCount = allTxs.length - MAX_VISIBLE
    const groups: Record<string, TransactionWithDetails[]> = {}
    for (const tx of slice) {
      const key = format(new Date(tx.date), 'yyyy-MM-dd')
      if (!groups[key]) groups[key] = []
      groups[key].push(tx)
    }
    const keys = Object.keys(groups).sort((a, b) => b.localeCompare(a))
    return { grouped: groups, sortedKeys: keys, remaining: restCount }
  }, [allTxs])

  const getDailyTotal = (txns: TransactionWithDetails[]) => {
    return txns.reduce((acc, tx) => {
      const amount = parseAmount(tx.amount)
      if (tx.type === 'expense') return acc - amount
      if (tx.type === 'income') return acc + amount
      return acc
    }, 0)
  }

  const totalCount = allTxs.length

  if (totalCount === 0) {
    return (
      <Card className="w-full">
        <CardContent className="pt-5">
          <p className="text-sm text-muted-foreground text-center py-4">Belum ada transaksi</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold tracking-tight">Recent Transactions</h2>
          <Link
            href="/transactions"
            className="text-xs text-primary font-medium flex items-center gap-1"
          >
            Lihat Semua
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="space-y-1">
          {sortedKeys.map((dateKey) => {
            const dayTxs = grouped[dateKey]
            const dailyTotal = getDailyTotal(dayTxs)
            const totalColor = dailyTotal > 0 ? 'text-success' : dailyTotal < 0 ? 'text-destructive' : ''

            return (
              <div key={dateKey}>
                {/* Date group header */}
                <div className="flex items-center justify-between py-2 px-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                    {getShortDateLabel(dayTxs[0].date)}
                  </span>
                  {dailyTotal !== 0 && (
                    <span className={cn('text-xs font-bold tabular-nums', totalColor)}>
                      {dailyTotal > 0 ? '+' : '-'}{formatCurrency(Math.abs(dailyTotal), { isPrivacyMode })}
                    </span>
                  )}
                </div>

                {/* Rows */}
                <div className="space-y-px">
                  {dayTxs.map((tx) => {
                    const isExpanded = expandedId === tx._id
                    const isSplit = !!(tx.isSplit && tx.splits && tx.splits.length > 0)
                    const amountVal = parseAmount(tx.amount)
                    const dotColor = getDotColor(tx.type)
                    const amountColor = getAmountColor(tx.type)
                    const prefix = getAmountPrefix(tx.type)
                    const splitCount = tx.splits?.length ?? 0

                    return (
                      <div
                        key={tx._id}
                        className={cn(
                          'rounded-lg',
                          isSplit && 'bg-muted/20',
                          isSplit && !isExpanded && 'bg-muted/15'
                        )}
                      >
                        <div
                          className="flex items-center gap-3 px-2 py-2.5 cursor-pointer select-none"
                          onClick={() => toggleExpand(tx._id)}
                        >
                          <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotColor)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {isSplit && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal shrink-0">
                                  Split {splitCount}
                                </Badge>
                              )}
                              <span className="text-sm font-medium truncate">
                                {tx.merchant?.name || (isSplit ? getSplitDescription(tx) : (tx.description || tx.categoryName || 'No description'))}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              <span>{tx.categoryName || tx.fromAccountName}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn('text-sm font-bold tabular-nums', amountColor)}>
                              {prefix}{formatCurrency(amountVal, { isPrivacyMode })}
                            </span>
                            <ChevronDown className={cn(
                              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0',
                              isExpanded && 'rotate-180'
                            )} />
                          </div>
                        </div>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              key="detail"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-2 pb-3 pt-1.5 border-t border-border/30 ml-5 space-y-2">
                                {isSplit ? (
                                  <div className="space-y-1.5">
                                    {tx.splits!.map((split, idx) => (
                                      <div key={idx} className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                                          <span className="truncate">{split.description || split.categoryName || 'Split'}</span>
                                        </div>
                                        <span className="tabular-nums font-medium shrink-0 ml-2">
                                          {formatCurrency(split.amount, { isPrivacyMode })}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    <div>
                                      <span className="text-[10px] uppercase tracking-tight font-semibold block text-foreground/60">Akun</span>
                                      <span>{tx.fromAccountName}</span>
                                    </div>
                                    {tx.categoryName && (
                                      <div>
                                        <span className="text-[10px] uppercase tracking-tight font-semibold block text-foreground/60">Kategori</span>
                                        <span>{tx.categoryName}</span>
                                      </div>
                                    )}
                                    {tx.description && (
                                      <div className="col-span-2">
                                        <span className="text-[10px] uppercase tracking-tight font-semibold block text-foreground/60">Deskripsi</span>
                                        <span className="italic">{tx.description}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="flex gap-2 pt-1.5 border-t border-border/20">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 px-2"
                                    onClick={(e) => { e.stopPropagation(); onEdit(tx) }}
                                  >
                                    <Edit className="h-3 w-3" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 px-2 text-destructive hover:text-destructive"
                                    onClick={(e) => { e.stopPropagation(); onDelete(tx) }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Remaining count */}
        {remaining > 0 && (
          <div className="flex items-center justify-center pt-3 pb-1">
            <Link
              href="/transactions"
              className="text-xs text-muted-foreground font-medium"
            >
              +{remaining} transaksi lainnya →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
