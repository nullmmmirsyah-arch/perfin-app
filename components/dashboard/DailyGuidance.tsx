'use client'

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { differenceInCalendarDays } from 'date-fns';
import { calculateBudgetPace, calculateFiscalDaysRemaining, getFiscalDate, getFiscalMonthRange } from '@/lib/finance-utils';

type SummaryData = {
  remainingBudget: number;
  budgetBreakdown: BudgetBreakdownItem[];
  budgetStartDay?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

type OverallStatus = 'on_track' | 'spending_faster' | 'slow_down';

function computeOverallStatus(breakdown: BudgetBreakdownItem[], budgetStartDay?: number): OverallStatus {
  if (!breakdown || breakdown.length === 0) return 'on_track';

  const year = new Date().getFullYear();
  const month = new Date().getMonth();

  let hasWarning = false;
  for (const item of breakdown) {
    if (item.enablePacing === false || item.limit <= 0) continue;
    const pace = calculateBudgetPace(item.spent, item.limit, year, month, budgetStartDay);
    if (pace.status === 'danger') return 'slow_down';
    if (pace.status === 'warning') hasWarning = true;
  }
  return hasWarning ? 'spending_faster' : 'on_track';
}

function computeDailyAllowance(remainingBudget: number, daysRemaining: number): number {
  if (daysRemaining <= 0) return 0;
  return Math.max(0, remainingBudget / daysRemaining);
}

export function DailyGuidance({ summary, isPrivacyMode }: Props) {
  const budgetStartDay = summary?.budgetStartDay;
  const daysRemaining = calculateFiscalDaysRemaining(budgetStartDay);
  const now = new Date();
  const fiscalDate = getFiscalDate(now, budgetStartDay);
  const { start, end } = getFiscalMonthRange(fiscalDate.getFullYear(), fiscalDate.getMonth(), budgetStartDay);
  const totalFiscalDays = differenceInCalendarDays(end, start) + 1;
  const fiscalDayNumber = differenceInCalendarDays(now, start) + 1;
  const hasBudgets = (summary?.budgetBreakdown || []).length > 0;
  const status = computeOverallStatus(summary?.budgetBreakdown || [], summary?.budgetStartDay);
  const dailyAllowance = computeDailyAllowance(summary?.remainingBudget || 0, daysRemaining);

  const statusConfig = {
    on_track: { label: 'On Track', class: 'bg-success/10 text-success border-success/20' },
    spending_faster: { label: 'Spending Faster', class: 'bg-warning/10 text-warning border-warning/20' },
    slow_down: { label: 'Slow Down', class: 'bg-destructive/10 text-destructive border-destructive/20' },
  } as const;

  const config = statusConfig[status];

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-tighter font-semibold mb-1">
              Day {fiscalDayNumber} of {totalFiscalDays}
            </p>
            <h2 className="text-lg font-bold tracking-tight">Daily Guidance</h2>
          </div>
          {hasBudgets && (
            <Badge variant="outline" className={cn('text-xs font-semibold px-3 py-1', config.class)}>
              {config.label}
            </Badge>
          )}
        </div>
        {hasBudgets ? (
          <div>
            <p className="text-sm text-muted-foreground">
              Spend up to{' '}
              <span className="font-bold text-foreground">
                {formatCurrency(dailyAllowance, { isPrivacyMode })}
              </span>{' '}
              today
            </p>
            {daysRemaining > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining this period
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Set up your first budget to get daily guidance.{' '}
            <Link href="/budgets" className="text-primary underline underline-offset-2 font-medium">
              Go to Budgets
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
