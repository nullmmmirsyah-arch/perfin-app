'use client'

import { Progress } from '@/components/ui/progress';
import { cn, formatCurrency } from '@/lib/utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { Sparkles, ShieldCheck, CalendarClock, Flag } from '@/components/ui/icons';
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

      <div className="space-y-3">
        {goals.map((item: BudgetBreakdownItem, index: number) => {
          const hasMonthlyBudget = item.limit > 0;
          const hasOverallTarget = (item.targetAmount || 0) > 0;

          const overallPercentage = hasOverallTarget
            ? (item.accumulated / (item.targetAmount || 1)) * 100
            : 0;
          const monthlyPercentage = hasMonthlyBudget
            ? (item.spent / item.limit) * 100
            : 0;

          const isMonthlyMet = hasMonthlyBudget && item.spent >= item.limit;
          const isOverallMet = hasOverallTarget && item.accumulated >= (item.targetAmount || 0);

          let typeIcon = Sparkles;
          let typeColor = 'text-chart-1';
          if (item.goalType === 'investment') { typeIcon = ShieldCheck; typeColor = 'text-chart-2'; }
          else if (item.goalType === 'bill') { typeIcon = CalendarClock; typeColor = 'text-chart-3'; }

          const Icon = typeIcon;

          return (
            <div key={item.categoryId}>
              <div className="space-y-2.5">
                {/* Header: Icon + Name + Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', typeColor)} />
                    <span className="text-sm font-semibold truncate">{item.categoryName}</span>
                  </div>
                  {isOverallMet ? (
                    <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium">
                      Done!
                    </span>
                  ) : isMonthlyMet ? (
                    <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium">
                      On Track
                    </span>
                  ) : hasMonthlyBudget || hasOverallTarget ? (
                    <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-medium">
                      Needs Attention
                    </span>
                  ) : null}
                </div>

                {/* Overall Progress */}
                {hasOverallTarget && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Overall</span>
                      <span className="text-[10px] font-medium tabular-nums">
                        {formatCurrency(item.accumulated, { isPrivacyMode })}
                        <span className="text-muted-foreground font-normal">
                          /{formatCurrency(item.targetAmount, { isPrivacyMode })}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, overallPercentage)} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                        {overallPercentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Monthly Progress */}
                {hasMonthlyBudget && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Bulanan</span>
                      <span className="text-[10px] font-medium tabular-nums">
                        {formatCurrency(item.spent, { isPrivacyMode })}
                        <span className="text-muted-foreground font-normal">
                          /{formatCurrency(item.limit, { isPrivacyMode })}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, monthlyPercentage)} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                        {monthlyPercentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* No target set */}
                {!hasOverallTarget && !hasMonthlyBudget && (
                  <p className="text-[10px] text-muted-foreground">
                    {formatCurrency(item.accumulated, { isPrivacyMode })} terkumpul
                  </p>
                )}
              </div>

              {/* Divider */}
              {index < goals.length - 1 && (
                <div className="border-b border-border/30 mt-3" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
