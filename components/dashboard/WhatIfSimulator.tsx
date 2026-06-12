'use client'

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, cn } from '@/lib/utils';
import { calculateFiscalDaysRemaining } from '@/lib/finance-utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { RotateCcw } from 'lucide-react';

type SummaryData = {
  remainingBudget: number;
  budgetBreakdown: BudgetBreakdownItem[];
  budgetStartDay?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function WhatIfSimulator({ summary, isPrivacyMode }: Props) {
  const items = useMemo(() =>
    (summary?.budgetBreakdown || []).filter(
      (item: BudgetBreakdownItem) => item.enablePacing !== false && item.limit > 0
    ),
    [summary?.budgetBreakdown]
  );

  const [values, setValues] = useState<Record<string, number>>({});

  useEffect(() => {
    const initial: Record<string, number> = {};
    for (const item of items) {
      initial[item.categoryId] = item.limit;
    }
    setValues(initial);
  }, [items]);

  const handleSliderChange = useCallback((categoryId: string, newValue: number) => {
    setValues(prev => ({ ...prev, [categoryId]: newValue }));
  }, []);

  const handleReset = useCallback(() => {
    const initial: Record<string, number> = {};
    for (const item of items) {
      initial[item.categoryId] = item.limit;
    }
    setValues(initial);
  }, [items]);

  const { adjustedTotal, totalDiff, dailyAllowance } = useMemo(() => {
    const origTotal = items.reduce((sum, item) => sum + item.limit, 0);
    const adjTotal = Object.entries(values).reduce((sum, [id, val]) => sum + val, 0);
    const diff = adjTotal - origTotal;
    const daysRemaining = calculateFiscalDaysRemaining(summary?.budgetStartDay);
    const daily = daysRemaining > 0 ? Math.max(0, (summary?.remainingBudget || 0) + diff) / daysRemaining : 0;
    return { adjustedTotal: adjTotal, totalDiff: diff, dailyAllowance: daily };
  }, [values, items, summary]);

  if (!summary || items.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">What If...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground italic">
              Set up budgets to explore what-if scenarios.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">What If...</CardTitle>
        <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 px-2 text-xs">
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 max-h-[200px] overflow-y-auto">
          {items.map((item: BudgetBreakdownItem) => {
            const currentVal = values[item.categoryId] ?? item.limit;
            const min = Math.round(item.limit * 0.5 / 10000) * 10000;
            const max = Math.round(item.limit * 1.5 / 10000) * 10000;
            return (
              <div key={item.categoryId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate">{item.categoryName}</span>
                  <span className="tabular-nums font-medium shrink-0 ml-2">
                    {formatCurrency(currentVal, { isPrivacyMode })}
                  </span>
                </div>
                <input
                  type="range"
                  value={currentVal}
                  min={Math.max(0, min)}
                  max={max}
                  step={10000}
                  onChange={(e) => handleSliderChange(item.categoryId, Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                />
              </div>
            );
          })}
        </div>

        <div className="border-t border-border/50 pt-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total budget</span>
            <span className="tabular-nums font-medium">
              {formatCurrency(adjustedTotal, { isPrivacyMode })}
              {totalDiff !== 0 && (
                <span className={cn('ml-1', totalDiff < 0 ? 'text-success' : 'text-destructive')}>
                  ({totalDiff < 0 ? '' : '+'}{formatCurrency(totalDiff, { isPrivacyMode })})
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Daily allowance</span>
            <span className="tabular-nums font-medium">
              {formatCurrency(dailyAllowance, { isPrivacyMode })}/day
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
