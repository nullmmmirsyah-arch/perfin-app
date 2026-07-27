'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, parseAmount } from '@/lib/utils'
import { Receipt, AlertCircle, CalendarClock, CheckCircle2 } from '@/components/ui/icons'
import { toast } from 'sonner'
import Link from 'next/link'

type Props = {
  householdId?: Id<"households">
  isPrivacyMode?: boolean
}

export function MobileRecurringRow({ householdId, isPrivacyMode }: Props) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const currentDay = now.getDate()

  const summary = useQuery(api.recurring.getRecurringSummary, { householdId: householdId ?? undefined, year, month })
  const markPaid = useMutation(api.recurring.markRecurringPaid)

  const handleMarkPaid = async (recurringExpenseId: Id<"recurringExpenses">) => {
    try {
      await markPaid({ recurringExpenseId, year, month })
      toast.success('Marked as paid')
    } catch {
      toast.error('Failed to mark as paid')
    }
  }

  const getRelativeDate = (dayOfMonth: number) => {
    if (dayOfMonth === currentDay) return 'Hari ini'
    if (dayOfMonth > currentDay) return `${dayOfMonth - currentDay} hari lagi`
    return `Lewat ${currentDay - dayOfMonth} hari`
  }

  if (summary === undefined) return null

  const allItems = [...summary.overdue, ...summary.upcoming]

  if (Number(summary.totalAmount) === 0) {
    return (
      <Card className="w-full">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Recurring</span>
            </div>
            <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
              <Link href="/recurring">See All</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground italic">No recurring bills this month.</p>
        </CardContent>
      </Card>
    )
  }

  if (allItems.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Recurring</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {summary.paidCount}/{summary.totalCount}
              </span>
            </div>
            <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
              <Link href="/recurring">See All</Link>
            </Button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Semua lunas bulan ini</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxVisible = 3
  const visibleItems = allItems.slice(0, maxVisible)
  const remainingCount = allItems.length - maxVisible

  return (
    <Card className="w-full">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Recurring</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {summary.paidCount}/{summary.totalCount}
            </span>
          </div>
          <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
            <Link href="/recurring">See All</Link>
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {visibleItems.map((item: any) => {
            const isOverdue = summary.overdue.some((o: any) => o._id === item._id)
            return (
              <div
                key={item._id}
                className="flex flex-col gap-1.5 min-w-[140px] max-w-[160px] p-3 rounded-lg border border-border/50 bg-muted/20 shrink-0"
              >
                <div className="flex items-center gap-1.5">
                  {isOverdue ? (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  ) : (
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs font-medium truncate">{item.name}</span>
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {formatCurrency(parseAmount(item.amount), { isPrivacyMode })}
                </span>
                <span className={isOverdue ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                  {getRelativeDate(item.dayOfMonth)}
                </span>
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 text-xs w-full"
                  onClick={() => handleMarkPaid(item._id)}
                >
                  Bayar
                </Button>
              </div>
            )
          })}
          {remainingCount > 0 && (
            <div className="flex items-center justify-center min-w-[56px] shrink-0 text-xs text-muted-foreground font-medium">
              +{remainingCount} more
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
