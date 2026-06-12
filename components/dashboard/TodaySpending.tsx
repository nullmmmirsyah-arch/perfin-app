'use client'

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, cn, parseAmount } from '@/lib/utils';
import { calculateFiscalDaysRemaining } from '@/lib/finance-utils';

type TransactionWithDetails = {
  _id: string;
  date: string;
  amount: number | string;
  type: string;
  description?: string;
  categoryName?: string;
};

type SummaryData = {
  remainingBudget: number;
  recentTransactions: TransactionWithDetails[];
  budgetStartDay?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

function isToday(dateStr: string): boolean {
  const today = new Date();
  const date = new Date(dateStr);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function TodaySpending({ summary, isPrivacyMode }: Props) {
  const todayTxns = (summary?.recentTransactions || []).filter(
    (tx: TransactionWithDetails) => isToday(tx.date)
  );

  const todaySpent = todayTxns.reduce(
    (acc: number, tx: TransactionWithDetails) => {
      const amt = typeof tx.amount === 'string' ? parseAmount(tx.amount) : (tx.amount ?? 0);
      return acc + amt;
    },
    0
  );

  const daysRemaining = calculateFiscalDaysRemaining(summary?.budgetStartDay);
  const dailyAllowance = daysRemaining > 0
    ? Math.max(0, (summary?.remainingBudget || 0) / daysRemaining)
    : 0;

  const totalDailyBudget = dailyAllowance;
  const percentUsed = dailyAllowance > 0
    ? Math.min(100, (todaySpent / dailyAllowance) * 100)
    : 0;

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-tighter font-semibold">
            Today&apos;s Spending
          </p>
          <p className="text-sm font-semibold">
            {formatCurrency(todaySpent, { isPrivacyMode })}
            <span className="text-xs text-muted-foreground font-normal">
              {' '}/ {formatCurrency(totalDailyBudget, { isPrivacyMode })}
            </span>
          </p>
        </div>

        <Progress value={percentUsed} className="h-2 mb-3" />

        {todayTxns.length > 0 ? (
          <div className="space-y-1 max-h-[160px] overflow-y-auto">
            {todayTxns.slice(0, 10).map((tx: TransactionWithDetails) => (
              <div key={tx._id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    tx.type === 'expense' ? 'bg-destructive' : 'bg-success'
                  )} />
                  <span className="text-xs truncate">{tx.description || tx.categoryName}</span>
                </div>
                <span className={cn(
                  'text-xs font-medium tabular-nums shrink-0 ml-2',
                  tx.type === 'expense' ? 'text-destructive' : 'text-success'
                )}>
                  {tx.type === 'expense' ? '-' : '+'}
                  {formatCurrency(tx.amount, { isPrivacyMode })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No spending yet today. You have{' '}
            <span className="font-semibold text-foreground">
              {formatCurrency(dailyAllowance, { isPrivacyMode })}
            </span>{' '}
            to spend.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
