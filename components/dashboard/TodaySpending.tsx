'use client'

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, cn, parseAmount } from '@/lib/utils';
import { calculateFiscalDaysRemaining } from '@/lib/finance-utils';

type SplitDetail = {
  categoryId: string;
  amount: string;
  description?: string;
  labelId?: string;
  categoryName?: string;
  labelName?: string;
  labelColor?: string;
};

type TransactionWithDetails = {
  _id: string;
  date: string;
  amount: number | string;
  type: string;
  description?: string;
  categoryName?: string;
  isSplit?: boolean;
  splits?: SplitDetail[];
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

function getTxEntries(tx: TransactionWithDetails): { id: string; description: string; amount: number; type: string; categoryName?: string }[] {
  if (tx.isSplit && tx.splits && tx.splits.length > 0) {
    return tx.splits.map(split => ({
      id: tx._id + '-' + split.categoryId,
      description: split.description || tx.description || split.categoryName || 'Split',
      amount: parseAmount(split.amount),
      type: tx.type,
      categoryName: split.categoryName,
    }));
  }
  return [{
    id: tx._id,
    description: tx.description || tx.categoryName || 'Transaction',
    amount: typeof tx.amount === 'string' ? parseAmount(tx.amount) : (tx.amount ?? 0),
    type: tx.type,
    categoryName: tx.categoryName,
  }];
}

export function TodaySpending({ summary, isPrivacyMode }: Props) {
  const todayTxns = (summary?.recentTransactions || []).filter(
    (tx: TransactionWithDetails) => isToday(tx.date) && tx.type === 'expense'
  );

  const todayEntries = todayTxns.flatMap(getTxEntries);

  const todaySpent = todayEntries.reduce((acc, entry) => acc + entry.amount, 0);

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

        {todayEntries.length > 0 ? (
          <div className="space-y-1 max-h-[160px] overflow-y-auto">
            {todayEntries.slice(0, 15).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-destructive" />
                  <span className="text-xs truncate">{entry.description}</span>
                </div>
                <span className="text-xs font-medium tabular-nums shrink-0 ml-2 text-destructive">
                  -{formatCurrency(entry.amount, { isPrivacyMode })}
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
