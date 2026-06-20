'use client'

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Progress } from '@/components/ui/progress'
import { cn, formatCurrency } from '@/lib/utils'
import { type BudgetBreakdownItem } from './MobileBudgetToday'
import type { PacingResult } from '@/lib/finance-utils'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

type Props = {
  item: BudgetBreakdownItem
  pace: PacingResult
  isPrivacyMode?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BudgetCategorySheet({ item, pace, isPrivacyMode, open, onOpenChange }: Props) {
  const weeklyAllowance = pace.dailyLimit * 7

  const dataRows = [
    { label: 'Sisa Budget', value: item.remaining, color: 'text-foreground' },
    { label: 'Anggaran', value: item.limit, color: 'text-muted-foreground' },
    { label: 'Terpakai', value: item.spent, color: 'text-destructive' },
  ]

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[70dvh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{item.categoryName}</DrawerTitle>
        </DrawerHeader>
        <div className="px-5 pb-6 space-y-5 overflow-y-auto">
          {/* Header + progress */}
          <div className="space-y-2">
            <p className="text-base font-bold">{item.categoryName}</p>
            <Progress value={pace.spendProgress} className="h-2.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Number.isFinite(pace.spendProgress) ? `${pace.spendProgress.toFixed(0)}%` : '0%'} terpakai</span>
              <span>{pace.daysRemaining} hari tersisa</span>
            </div>
          </div>

          {/* Data rows: Sisa, Anggaran, Terpakai */}
          <div className="space-y-2">
            {dataRows.map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={cn('text-sm font-semibold tabular-nums', row.color)}>
                  {formatCurrency(row.value, { isPrivacyMode })}
                </span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-border/50" />

          {/* Pacing: Daily, Weekly, Days remaining */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">Pacing</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Harian</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(pace.dailyLimit, { isPrivacyMode })}
                <span className="text-xs text-muted-foreground font-normal"> /hari</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mingguan</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(weeklyAllowance, { isPrivacyMode })}
                <span className="text-xs text-muted-foreground font-normal"> /minggu</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sisa hari</span>
              <span className="text-sm font-semibold tabular-nums">
                {pace.daysRemaining}
                <span className="text-xs text-muted-foreground font-normal"> hari</span>
              </span>
            </div>
          </div>

          {/* Link to transactions */}
          <Link
            href={`/transactions?categoryId=${encodeURIComponent(item.categoryId)}`}
            className="flex items-center justify-center gap-1.5 text-sm text-primary font-medium underline underline-offset-2"
            onClick={() => onOpenChange(false)}
          >
            Lihat transaksi {item.categoryName}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
