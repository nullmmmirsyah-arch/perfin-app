'use client'

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';
import { calculateFiscalDaysRemaining } from '@/lib/finance-utils';

type SummaryData = {
  remainingBudget: number;
  budgetBreakdown: { limit: number; spent: number }[];
  budgetStartDay?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function BudgetSummary({ summary, isPrivacyMode }: Props) {
  const daysRemaining = calculateFiscalDaysRemaining(summary?.budgetStartDay);
  const totalBudget = summary?.budgetBreakdown?.reduce((acc, item) => acc + item.limit, 0) || 0;
  const totalSpent = summary?.budgetBreakdown?.reduce((acc, item) => acc + item.spent, 0) || 0;
  const remaining = summary?.remainingBudget || 0;
  const percentUsed = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-tighter font-semibold">
            Budget Left
          </p>
          <p className="text-xs text-muted-foreground">
            {daysRemaining > 0 ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left` : 'Final day'}
          </p>
        </div>
        <p className="text-2xl font-bold mb-3">
          {formatCurrency(remaining, { isPrivacyMode })}
        </p>
        <Progress value={percentUsed} className="h-2" />
        <div className="flex justify-between mt-1">
          <span className="text-[11px] text-muted-foreground">
            {formatCurrency(totalSpent, { isPrivacyMode })} spent
          </span>
          <span className="text-[11px] text-muted-foreground">
            of {formatCurrency(totalBudget, { isPrivacyMode })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
