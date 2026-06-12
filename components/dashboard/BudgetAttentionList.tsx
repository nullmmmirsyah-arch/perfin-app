'use client'

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { calculateBudgetPace } from '@/lib/finance-utils';

type SummaryData = {
  budgetBreakdown: BudgetBreakdownItem[];
  budgetStartDay?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

function getPaceInfo(item: BudgetBreakdownItem, budgetStartDay?: number) {
  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  return calculateBudgetPace(item.spent, item.limit, year, month, budgetStartDay);
}

function getStatusBadge(status: 'safe' | 'warning' | 'danger') {
  switch (status) {
    case 'danger': return { label: 'Too Fast', class: 'bg-destructive/10 text-destructive border-destructive/20' };
    case 'warning': return { label: 'Watch', class: 'bg-warning/10 text-warning border-warning/20' };
    case 'safe': return { label: 'On Track', class: 'bg-success/10 text-success border-success/20' };
  }
}

export function BudgetAttentionList({ summary, isPrivacyMode }: Props) {
  const [showSafe, setShowSafe] = useState(false);

  const items = (summary?.budgetBreakdown || []).filter(
    (item: BudgetBreakdownItem) => item.enablePacing !== false && item.limit > 0
  );

  const pacedItems = items.map((item: BudgetBreakdownItem) => ({
    ...item,
    pace: getPaceInfo(item, summary?.budgetStartDay),
  }));

  const dangerItems = pacedItems.filter((item) => item.pace.status === 'danger');
  const warningItems = pacedItems.filter((item) => item.pace.status === 'warning');
  const safeItems = pacedItems.filter((item) => item.pace.status === 'safe');

  const attentionItems = [...dangerItems, ...warningItems];

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Budget Attention
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {attentionItems.length === 0 && safeItems.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No budgets set.{' '}
            <Link href="/budgets" className="text-primary underline underline-offset-2 font-medium">
              Set up your first budget
            </Link>
          </p>
        )}

        {attentionItems.length === 0 && safeItems.length > 0 && (
          <p className="text-xs text-success">All budgets are on track!</p>
        )}

        {attentionItems.map((item) => {
          const badge = getStatusBadge(item.pace.status);
          return (
            <div key={item.categoryId} className="flex items-center justify-between py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.categoryName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatCurrency(item.remaining, { isPrivacyMode })} left
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', badge.class)}>
                  {badge.label}
                </Badge>
                {item.pace.status !== 'safe' && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatCurrency(item.pace.dailyLimit, { isPrivacyMode })}/day
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {safeItems.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground h-8"
            onClick={() => setShowSafe(!showSafe)}
          >
            {showSafe ? (
              <ChevronDown className="h-3 w-3 mr-1" />
            ) : (
              <ChevronRight className="h-3 w-3 mr-1" />
            )}
            {showSafe
              ? 'Hide on track budgets'
              : `${safeItems.length} other budget${safeItems.length > 1 ? 's' : ''} on track`}
          </Button>
        )}

        {showSafe && safeItems.map((item) => {
          const badge = getStatusBadge('safe');
          return (
            <div key={item.categoryId} className="flex items-center justify-between py-1">
              <p className="text-xs truncate">{item.categoryName}</p>
              <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', badge.class)}>
                {badge.label}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
