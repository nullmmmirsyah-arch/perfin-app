'use client'

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatCurrency } from '@/lib/utils';
import { BalanceSummary } from './BalanceSummary';
import { LentSummary } from './LentSummary';
import { GoalSummary } from './GoalSummary';

type SummaryData = {
  liquidCash: number;
  cashAccounts: { name: string; balance: number }[];
  totalReceivables: number;
  pendingReceivables: any[];
  budgetBreakdown: any[];
};

type TabConfig = {
  value: string;
  label: string;
  getValue: (summary: SummaryData | undefined | null) => number;
};

const TABS_CONFIG: TabConfig[] = [
  {
    value: 'balance',
    label: 'Balance',
    getValue: (s) => s?.liquidCash ?? 0,
  },
  {
    value: 'lent',
    label: 'Lent',
    getValue: (s) => s?.totalReceivables ?? 0,
  },
  {
    value: 'goals',
    label: 'Goals',
    getValue: (s) =>
      (s?.budgetBreakdown || [])
        .filter((item) => item.categoryType === 'saving')
        .reduce((acc, item) => acc + item.accumulated, 0),
  },
];

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function MobileDashboardTabs({ summary, isPrivacyMode }: Props) {
  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <Tabs defaultValue="balance" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            {TABS_CONFIG.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex-col gap-0 py-2">
                <span className="text-xs">{tab.label}</span>
                <span
                  className={cn(
                    'text-[10px] font-normal',
                    tab.getValue(summary) === 0
                      ? 'text-muted-foreground/40'
                      : 'text-muted-foreground'
                  )}
                >
                  {formatCurrency(tab.getValue(summary), { isPrivacyMode })}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="balance">
            <BalanceSummary summary={summary} isPrivacyMode={isPrivacyMode} />
          </TabsContent>
          <TabsContent value="lent">
            <LentSummary summary={summary} isPrivacyMode={isPrivacyMode} />
          </TabsContent>
          <TabsContent value="goals">
            <GoalSummary summary={summary} isPrivacyMode={isPrivacyMode} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
