'use client';

import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from '@/components/ui/icons';

interface PeriodData {
  year: number;
  month: number;
  periodLabel: string;
  initial: number;
  adjustment: number;
  carryover: number;
  total: number;
  spent: number;
  remaining: number;
  isOverBudget: boolean;
  byCategory?: Array<{
    categoryId: string;
    categoryName: string;
    categoryType: string;
    initial: number;
    adjustment: number;
    carryover: number;
    total: number;
    spent: number;
    remaining: number;
    isOverBudget: boolean;
  }>;
}

interface BudgetReportTableProps {
  periods: PeriodData[];
  isLoading?: boolean;
  className?: string;
}

export function BudgetReportTable({ periods, isLoading, className }: BudgetReportTableProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (periods.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No budget data available</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create budgets to see your report
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatAdjustment = (value: number) => {
    const formatted = formatCurrency(Math.abs(value));
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Budget Breakdown by Period</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Period</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Initial</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Adjustment</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Carryover</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Total</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Spent</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={`${period.year}-${period.month}`} className="border-b hover:bg-muted/50">
                <td className="py-3 px-3 font-medium">{period.periodLabel}</td>
                <td className="py-3 px-3 text-right">{formatCurrency(period.initial)}</td>
                <td className="py-3 px-3 text-right">
                  <span className={cn(
                    'inline-flex items-center gap-1',
                    period.adjustment > 0 && 'text-success',
                    period.adjustment < 0 && 'text-destructive'
                  )}>
                    {period.adjustment > 0 && <TrendingUp className="h-3 w-3" />}
                    {period.adjustment < 0 && <TrendingDown className="h-3 w-3" />}
                    {period.adjustment === 0 && <Minus className="h-3 w-3 text-muted-foreground" />}
                    {formatAdjustment(period.adjustment)}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className={cn(
                    period.carryover !== 0 && (period.carryover > 0 ? 'text-success' : 'text-destructive')
                  )}>
                    {period.carryover !== 0 && (period.carryover > 0 ? '+' : '')}
                    {formatCurrency(period.carryover)}
                  </span>
                </td>
                <td className="py-3 px-3 text-right font-medium">{formatCurrency(period.total)}</td>
                <td className="py-3 px-3 text-right text-primary">{formatCurrency(period.spent)}</td>
                <td className={cn(
                  'py-3 px-3 text-right font-medium',
                  period.remaining < 0 ? 'text-destructive' : 'text-success'
                )}>
                  {formatCurrency(period.remaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Category Breakdown Toggle */}
        {periods.length === 1 && periods[0].byCategory && periods[0].byCategory.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium mb-3">By Category</p>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Category</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Initial</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Adjustment</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Carryover</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Spent</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {periods[0].byCategory?.map((cat) => (
                  <tr key={cat.categoryId} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 text-sm">{cat.categoryName}</td>
                    <td className="py-2 px-3 text-right text-sm">{formatCurrency(cat.initial)}</td>
                    <td className="py-2 px-3 text-right text-sm">
                      <span className={cn(
                        cat.adjustment > 0 && 'text-success',
                        cat.adjustment < 0 && 'text-destructive'
                      )}>
                        {cat.adjustment !== 0 && (cat.adjustment > 0 ? '+' : '-')}
                        {formatCurrency(Math.abs(cat.adjustment))}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-sm">
                      <span className={cn(
                        cat.carryover !== 0 && (cat.carryover > 0 ? 'text-success' : 'text-destructive')
                      )}>
                        {cat.carryover !== 0 && (cat.carryover > 0 ? '+' : '')}
                        {formatCurrency(cat.carryover)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-sm font-medium">{formatCurrency(cat.total)}</td>
                    <td className="py-2 px-3 text-right text-sm text-primary">{formatCurrency(cat.spent)}</td>
                    <td className={cn(
                      'py-2 px-3 text-right text-sm font-medium',
                      cat.remaining < 0 ? 'text-destructive' : 'text-success'
                    )}>
                      {formatCurrency(cat.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
