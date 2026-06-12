'use client'

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
            <TabsTrigger value="balance">Balance</TabsTrigger>
            <TabsTrigger value="lent">Lent</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
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
