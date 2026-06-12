'use client'

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, cn, parseAmount } from '@/lib/utils';
import { calculateBudgetPace, calculateFiscalDaysRemaining } from '@/lib/finance-utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';

type TransactionWithDetails = {
  _id: string;
  date: string;
  amount: number | string;
  type: string;
  description?: string;
  categoryName?: string;
  categoryId?: string;
};

type SummaryData = {
  remainingBudget: number;
  budgetBreakdown: BudgetBreakdownItem[];
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

  // Group today's transactions by category
  const categoryGroups = new Map<string, { categoryId?: string; categoryName: string; total: number }>();
  for (const tx of todayTxns) {
    const key = tx.categoryId || tx.categoryName || '__uncategorized__';
    if (!categoryGroups.has(key)) {
      categoryGroups.set(key, { categoryId: tx.categoryId, categoryName: tx.categoryName || 'Uncategorized', total: 0 });
    }
    const group = categoryGroups.get(key)!;
    const amt = typeof tx.amount === 'string' ? parseAmount(tx.amount) : (tx.amount ?? 0);
    group.total += amt;
  }

  const year = new Date().getFullYear();
  const month = new Date().getMonth();

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
          <div className="space-y-3">
            {/* Per-category breakdown */}
            <div className="space-y-2">
              {Array.from(categoryGroups.entries()).map(([key, group]) => {
                const budgetItem = summary?.budgetBreakdown?.find(
                  (b: BudgetBreakdownItem) => b.categoryId === group.categoryId
                );
                const pace = budgetItem
                  ? calculateBudgetPace(budgetItem.spent, budgetItem.limit, year, month, summary?.budgetStartDay)
                  : null;

                let badgeLabel: string | null = null;
                let badgeClass = '';
                if (pace && budgetItem) {
                  const statusMap: Record<string, { label: string; cls: string }> = {
                    danger: { label: 'Too Fast', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
                    warning: { label: 'Watch', cls: 'bg-warning/10 text-warning border-warning/20' },
                    safe: { label: 'On Track', cls: 'bg-success/10 text-success border-success/20' },
                  };
                  const s = statusMap[pace.status];
                  badgeLabel = s.label;
                  badgeClass = s.cls;
                }
                const catDailyLimit = pace?.dailyLimit ?? 0;

                return (
                  <div key={key} className="flex items-center justify-between py-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{group.categoryName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatCurrency(group.total, { isPrivacyMode })} spent
                        {budgetItem && catDailyLimit > 0 && (
                          <> &middot; {formatCurrency(catDailyLimit, { isPrivacyMode })}/day left</>
                        )}
                      </p>
                    </div>
                    {badgeLabel && (
                      <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 shrink-0 ml-2', badgeClass)}>
                        {badgeLabel}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            <div className="border-t border-border/50" />

            {/* Individual transactions */}
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {todayTxns.slice(0, 10).map((tx: TransactionWithDetails) => (
                <div key={tx._id} className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn(
                      'w-1 h-1 rounded-full shrink-0',
                      tx.type === 'expense' ? 'bg-destructive' : 'bg-success'
                    )} />
                    <span className="text-[11px] truncate">{tx.description || tx.categoryName}</span>
                  </div>
                  <span className={cn(
                    'text-[11px] font-medium tabular-nums shrink-0 ml-2',
                    tx.type === 'expense' ? 'text-destructive' : 'text-success'
                  )}>
                    {tx.type === 'expense' ? '-' : '+'}
                    {formatCurrency(tx.amount, { isPrivacyMode })}
                  </span>
                </div>
              ))}
            </div>
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
