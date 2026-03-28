'use client';

import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface BudgetReportSummaryProps {
  totals: {
    initial: number;
    adjustment: number;
    carryover: number;
    total: number;
    spent: number;
    remaining: number;
  } | null;
  isLoading?: boolean;
  className?: string;
}

export function BudgetReportSummary({ totals, isLoading, className }: BudgetReportSummaryProps) {
  if (isLoading || !totals) {
    return (
      <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-3', className)}>
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-4">
              <div className="h-4 w-20 bg-muted rounded mb-2" />
              <div className="h-6 w-28 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Budgeted',
      value: totals.total,
      subLabel: 'Initial + Adj + Carryover',
    },
    {
      label: 'Total Spent',
      value: totals.spent,
      subLabel: 'Across all periods',
      highlight: true,
    },
    {
      label: 'Total Remaining',
      value: totals.remaining,
      subLabel: 'Available to spend',
      isNegative: totals.remaining < 0,
    },
    {
      label: 'Spent %',
      value: totals.total > 0 ? (totals.spent / totals.total) * 100 : 0,
      subLabel: 'Budget utilization',
      isPercent: true,
    },
  ];

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-3', className)}>
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
            <p className={cn(
              'text-lg md:text-xl font-bold mt-1',
              card.isNegative && 'text-destructive',
              card.highlight && 'text-primary'
            )}>
              {card.isPercent 
                ? `${card.value.toFixed(1)}%`
                : formatCurrency(card.value)
              }
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{card.subLabel}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
