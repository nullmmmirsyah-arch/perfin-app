'use client'

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, parseAmount, cn } from '@/lib/utils';
import { calculateFiscalDaysRemaining, getFiscalDateDetails } from '@/lib/finance-utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { RotateCcw, Loader2 } from '@/components/ui/icons';
import { toast } from 'sonner';

type SummaryData = {
  remainingBudget: number;
  budgetBreakdown: BudgetBreakdownItem[];
  budgetStartDay?: number;
};

type Props = {
  householdId?: Id<"households">;
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function QuickAdjust({ householdId, summary, isPrivacyMode }: Props) {
  const upsertBudget = useMutation(api.budgets.upsertBudget);
  const { year, month } = getFiscalDateDetails(new Date().toISOString(), summary?.budgetStartDay ?? 1);

  const items = useMemo(() =>
    (summary?.budgetBreakdown || []).filter(
      (item: BudgetBreakdownItem) => item.enablePacing !== false && item.limit > 0
    ),
    [summary?.budgetBreakdown]
  );

  const [values, setValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initial: Record<string, number> = {};
    for (const item of items) {
      initial[item.categoryId] = item.limit - item.carryover;
    }
    setValues(initial);
  }, [items]);

  const handleSliderChange = useCallback((categoryId: string, newValue: number) => {
    setValues(prev => ({ ...prev, [categoryId]: newValue }));
  }, []);

  const handleInputChange = useCallback((categoryId: string, raw: string) => {
    if (raw === '') return;
    const num = parseAmount(raw);
    if (Number.isFinite(num) && num >= 0) {
      setValues(prev => ({ ...prev, [categoryId]: num }));
    }
  }, []);

  const handleReset = useCallback(() => {
    const initial: Record<string, number> = {};
    for (const item of items) {
      initial[item.categoryId] = item.limit - item.carryover;
    }
    setValues(initial);
  }, [items]);

  const changeCount = useMemo(() => {
    let count = 0;
    for (const item of items) {
      const original = item.limit - item.carryover;
      const current = values[item.categoryId] ?? original;
      if (current !== original) count++;
    }
    return count;
  }, [values, items]);

  const { adjustedTotal, totalDiff, dailyAllowance } = useMemo(() => {
    const origTotal = items.reduce((sum, item) => sum + item.limit, 0);
    const adjTotal = items.reduce((sum, item) => {
      const currentVal = values[item.categoryId] ?? (item.limit - item.carryover);
      return sum + currentVal + item.carryover;
    }, 0);
    const diff = adjTotal - origTotal;
    const daysRemaining = calculateFiscalDaysRemaining(summary?.budgetStartDay);
    const daily = daysRemaining > 0 ? Math.max(0, (summary?.remainingBudget || 0) + diff) / daysRemaining : 0;
    return { adjustedTotal: adjTotal, totalDiff: diff, dailyAllowance: daily };
  }, [values, items, summary]);

  const handleApply = useCallback(async () => {
    const toSave = items.filter(item => {
      const original = item.limit - item.carryover;
      const current = values[item.categoryId] ?? original;
      return current !== original;
    });

    if (toSave.length === 0) return;

    setSaving(true);
    let saved = 0;
    let failed = 0;
    for (const item of toSave) {
      try {
        const newAllocated = values[item.categoryId] ?? (item.limit - item.carryover);
        await upsertBudget({
          householdId,
          categoryId: item.categoryId as Id<"categories">,
          amount: String(newAllocated),
          year,
          month,
        });
        saved++;
      } catch (e) {
        failed++;
      }
    }

    if (failed > 0) {
      toast.error(`Updated ${saved}, ${failed} failed`);
    } else {
      toast.success(`Updated ${saved} budget${saved > 1 ? 's' : ''}`);
    }
    setSaving(false);
  }, [values, items, upsertBudget, householdId, year, month]);

  if (!summary || items.length === 0) {
    return null
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">Quick Adjust</CardTitle>
        <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 px-2 text-xs">
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 max-h-[260px] overflow-y-auto">
          {items.map((item: BudgetBreakdownItem) => {
            const allocated = item.limit - item.carryover;
            const currentVal = values[item.categoryId] ?? allocated;
            const min = Math.round(allocated * 0.5 / 10000) * 10000;
            const max = Math.round(allocated * 1.5 / 10000) * 10000;
            const isChanged = currentVal !== allocated;
            return (
              <div key={item.categoryId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium">{item.categoryName}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Input
                      type="text"
                      value={String(currentVal)}
                      onChange={(e) => handleInputChange(item.categoryId, e.target.value)}
                      className={cn(
                        'h-6 w-24 text-xs text-right tabular-nums',
                        isChanged && 'border-primary/50'
                      )}
                    />
                  </div>
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
                {item.carryover !== 0 && (
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    +{formatCurrency(item.carryover, { isPrivacyMode })} carryover
                  </p>
                )}
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

        <Button
          onClick={handleApply}
          disabled={changeCount === 0 || saving}
          className="w-full text-xs h-8"
        >
          {saving ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Applying...</>
          ) : (
            `Apply Changes${changeCount > 0 ? ` (${changeCount})` : ''}`
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
