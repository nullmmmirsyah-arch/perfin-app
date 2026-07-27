'use client'

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';
import { TrendingDown, TrendingUp } from '@/components/ui/icons';

type MonthlyTrend = {
  year: number;
  month: number;
  totalSpent: number;
  categories: { categoryId: string; categoryName: string; spent: number }[];
};

type Props = {
  householdId?: Id<"households">;
  isPrivacyMode?: boolean;
};

export function MonthlyComparison({ householdId, isPrivacyMode }: Props) {
  const [comparisonMode, setComparisonMode] = useState<'prev' | 'lastYear'>('prev');

  const months = comparisonMode === 'prev' ? 2 : 13;
  const comparisonTitle = comparisonMode === 'prev' ? 'vs Last Month' : 'vs Last Year';

  const trends = useQuery(api.dashboard.getMonthlyTrends, {
    householdId: householdId ?? undefined,
    months,
  });

  if (trends === undefined) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{comparisonTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[160px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trends.length < months) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{comparisonTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[160px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground italic">
              {comparisonMode === 'prev'
                ? 'Comparison will appear once you have at least 2 months of data.'
                : 'Not enough data for a year-over-year comparison yet.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const thisMonth = trends[trends.length - 1];
  const comparisonMonth = trends[0];
  const diff = thisMonth.totalSpent - comparisonMonth.totalSpent;
  const pctChange = comparisonMonth.totalSpent > 0
    ? Math.round((diff / comparisonMonth.totalSpent) * 100)
    : 0;
  const isDecrease = diff < 0;

  // Find top 3 categories by absolute change (keyed by categoryId, not name)
  const categoryChanges: { id: string; name: string; thisAmt: number; lastAmt: number; diff: number; pct: number }[] = [];
  const allCatIds = new Set<string>();
  for (const m of trends) {
    for (const c of m.categories) allCatIds.add(c.categoryId);
  }
  for (const catId of allCatIds) {
    const thisCat = thisMonth.categories.find(c => c.categoryId === catId);
    const lastCat = comparisonMonth.categories.find(c => c.categoryId === catId);
    const thisAmt = thisCat?.spent ?? 0;
    const lastAmt = lastCat?.spent ?? 0;
    const name = thisCat?.categoryName ?? lastCat?.categoryName ?? 'Unknown';
    const catDiff = thisAmt - lastAmt;
    const catPct = lastAmt > 0 ? Math.round((catDiff / lastAmt) * 100) : 0;
    categoryChanges.push({ id: catId, name, thisAmt, lastAmt, diff: catDiff, pct: catPct });
  }
  categoryChanges.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const topChanges = categoryChanges.slice(0, 3);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{comparisonTitle}</CardTitle>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setComparisonMode('prev')}
              className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                comparisonMode === 'prev'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Prev Month
            </button>
            <button
              type="button"
              onClick={() => setComparisonMode('lastYear')}
              className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                comparisonMode === 'lastYear'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Last Year
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3">
          <div className={cn(
            'flex items-center gap-1 text-2xl font-bold',
            isDecrease ? 'text-success' : 'text-destructive'
          )}>
            {isDecrease ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
            {Math.abs(pctChange)}%
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {formatCurrency(thisMonth.totalSpent, { isPrivacyMode })} this month &middot;{' '}
          {formatCurrency(comparisonMonth.totalSpent, { isPrivacyMode })} {comparisonMode === 'prev' ? 'last month' : 'last year'}
        </p>

        {topChanges.length > 0 && (
          <>
            <p className="text-[10px] text-muted-foreground uppercase tracking-tight font-semibold mb-2">
              Biggest changes
            </p>
            <div className="space-y-2">
              {topChanges.map(cat => (
                <div key={cat.id} className="flex items-center justify-between text-xs">
                  <span className="truncate">{cat.name}</span>
                  <span className={cn(
                    'tabular-nums shrink-0 ml-2',
                    cat.diff > 0 ? 'text-destructive' : cat.diff < 0 ? 'text-success' : 'text-muted-foreground'
                  )}>
                    {cat.diff > 0 ? '↑' : cat.diff < 0 ? '↓' : '→'} {Math.abs(cat.pct)}%
                    <span className="text-muted-foreground ml-1">
                      {cat.diff > 0 ? '+' : ''}{formatCurrency(cat.diff, { isPrivacyMode })}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
