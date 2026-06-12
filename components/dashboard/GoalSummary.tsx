'use client'

import { Progress } from '@/components/ui/progress';
import { cn, formatCurrency } from '@/lib/utils';
import { calculateGoalStrategy } from '@/lib/finance-utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { Sparkles, ShieldCheck, CalendarClock, Flag } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

type SummaryData = {
  budgetBreakdown: BudgetBreakdownItem[];
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function GoalSummary({ summary, isPrivacyMode }: Props) {
  const goals = (summary?.budgetBreakdown || []).filter(
    (item: BudgetBreakdownItem) => item.categoryType === 'saving'
  );

  if (goals.length === 0) {
    return <EmptyState icon={Flag} description="No goals set." />;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
          Total Funds in Goals
        </p>
        <p className="text-2xl font-bold">
          {formatCurrency(
            goals.reduce((acc: number, item: BudgetBreakdownItem) => acc + item.accumulated, 0),
            { isPrivacyMode }
          )}
        </p>
      </div>

      <div className="space-y-4">
        {goals.map((item: BudgetBreakdownItem) => {
          const hasMonthlyBudget = item.limit > 0;
          const displayTarget = hasMonthlyBudget ? item.limit : (item.targetAmount || 0);
          const displayCurrent = hasMonthlyBudget ? item.spent : item.accumulated;
          const percentage = displayTarget > 0 ? (displayCurrent / displayTarget) * 100 : 0;
          const isMet = hasMonthlyBudget && displayCurrent >= displayTarget;
          const globalTarget = item.targetAmount || 0;
          const strategy = calculateGoalStrategy(item.accumulated, globalTarget, item.targetDate);

          let typeIcon = Sparkles;
          let typeColor = 'text-chart-1';
          if (item.goalType === 'investment') typeIcon = ShieldCheck;
          else if (item.goalType === 'bill') typeIcon = CalendarClock;

          const Icon = typeIcon;

          return (
            <div key={item.categoryId} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className={cn('h-3 w-3 shrink-0', typeColor)} />
                  <span className="text-xs font-medium truncate">{item.categoryName}</span>
                </div>
                <span className="text-xs font-medium tabular-nums shrink-0 ml-2">
                  {formatCurrency(displayCurrent, { isPrivacyMode })}
                  <span className="text-muted-foreground font-normal">
                    /{formatCurrency(displayTarget, { isPrivacyMode })}
                  </span>
                </span>
              </div>
              <Progress value={Math.min(100, percentage)} className="h-1.5" />
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {percentage.toFixed(0)}%
                </span>
                {isMet ? (
                  <span className="text-[10px] text-success font-medium">Done!</span>
                ) : strategy && strategy.monthly > 0 && !hasMonthlyBudget ? (
                  <span className="text-[10px] text-muted-foreground">
                    {formatCurrency(strategy.monthly, { isPrivacyMode })}/mo needed
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
