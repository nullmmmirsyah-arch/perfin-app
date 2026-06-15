'use client'

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, parseAmount } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Receipt, CheckCircle2, AlertCircle, CalendarClock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useState } from 'react';

type Props = {
  householdId?: Id<"households">;
  isPrivacyMode?: boolean;
};

export function RecurringSummary({ householdId, isPrivacyMode }: Props) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentDay = now.getDate();
  const summary = useQuery(api.recurring.getRecurringSummary, { householdId: householdId ?? undefined, year, month });
  const markPaid = useMutation(api.recurring.markRecurringPaid)
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set())

  const handleMarkPaid = async (recurringExpenseId: Id<"recurringExpenses">) => {
    setPayingIds(prev => new Set(prev).add(recurringExpenseId))
    try {
      await markPaid({ recurringExpenseId, year, month })
      toast.success('Marked as paid')
    } catch {
      toast.error('Failed to mark as paid')
    } finally {
      setPayingIds(prev => { const next = new Set(prev); next.delete(recurringExpenseId); return next })
    }
  }

  if (summary === undefined) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recurring Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (Number(summary.totalAmount) === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recurring Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Receipt}
            title="No recurring bills"
            description="Add your monthly bills and subscriptions to track them here."
            action={{ href: "/recurring", label: "Add Bills" }}
            compact
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">Recurring Bills</CardTitle>
        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
          <Link href="/recurring">View All</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total this month</span>
          <span className="text-sm font-bold">{formatCurrency(summary.totalAmount, { isPrivacyMode })}</span>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" />{summary.paidCount} paid</span>
          <span className="flex items-center gap-1 text-muted-foreground"><Receipt className="h-3 w-3" />{summary.unpaidCount} unpaid</span>
          {summary.overdueCount > 0 && (
            <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" />{summary.overdueCount} overdue</span>
          )}
        </div>
        {(summary.upcoming.length > 0 || summary.overdue.length > 0) && (
          <div className="border-t border-border/30 pt-2 space-y-1">
            {summary.overdue.map((item: any) => (
              <div key={item._id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 truncate text-destructive">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {item.name} — overdue {currentDay - item.dayOfMonth}d
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="tabular-nums text-destructive">
                    {formatCurrency(parseAmount(item.amount), { isPrivacyMode })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    disabled={payingIds.has(item._id)}
                    onClick={() => handleMarkPaid(item._id)}
                  >
                    {payingIds.has(item._id) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      'Mark Paid'
                    )}
                  </Button>
                </div>
              </div>
            ))}
            {summary.upcoming.map((item: any) => (
              <div key={item._id} className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1 truncate">
                  <CalendarClock className="h-3 w-3 shrink-0" />
                  {item.name} — due in {item.dayOfMonth - currentDay}d
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="tabular-nums">
                    {formatCurrency(parseAmount(item.amount), { isPrivacyMode })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    disabled={payingIds.has(item._id)}
                    onClick={() => handleMarkPaid(item._id)}
                  >
                    {payingIds.has(item._id) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      'Mark Paid'
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
