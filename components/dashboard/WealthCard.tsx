import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight } from 'lucide-react';
import { BudgetBreakdownItem } from './DailyOperationsCard';

type SummaryData = {
  budgetBreakdown: BudgetBreakdownItem[];
  totalSavingsOnly: number;
  savingAccounts: { name: string; balance: number }[];
  totalAssetsOnly: number;
  assetAccounts: { name: string; balance: number }[];
};

type Props = {
  summary: SummaryData | undefined | null;
};

export function WealthCard({ summary }: Props) {
  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Wealth & Goals</CardTitle>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="goals" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="savings">Savings</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
          </TabsList>

          {/* GOALS TAB */}
          <TabsContent value="goals" className="space-y-4 animate-in fade-in-5">
            <div>
              <div className="text-2xl font-bold text-success">
                {summary?.budgetBreakdown
                  ?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving')
                  .reduce((acc: number, item: BudgetBreakdownItem) => acc + item.accumulated, 0)
                  .toLocaleString() ?? '0'}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                Accumulated Goal Progress
              </p>
            </div>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
              {summary?.budgetBreakdown?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving').length === 0 && (
                <p className="text-xs text-muted-foreground italic">No saving goals set.</p>
              )}
              {summary?.budgetBreakdown
                ?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving')
                .map((item: BudgetBreakdownItem, index: number) => {
                  const target = item.targetAmount || 0;
                  const percentage = target > 0 ? (item.accumulated / target) * 100 : 0;

                  return (
                    <div key={index} className="flex flex-col gap-1.5 pb-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">{item.categoryName}</span>
                        <span className="font-bold text-xs text-success">
                          {item.accumulated.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-success/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-success rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{item.targetAmount ? `${Math.round(percentage)}%` : 'No Target'}</span>
                        <span>Goal: {item.targetAmount ? item.targetAmount.toLocaleString() : '∞'}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </TabsContent>

          {/* SAVINGS TAB */}
          <TabsContent value="savings" className="space-y-4 animate-in fade-in-5">
            <div>
              <div className="text-2xl font-bold text-success">
                {summary?.totalSavingsOnly.toLocaleString() ?? '...'}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                Total In Savings Accounts
              </p>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
              {(summary?.savingAccounts?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground italic">No saving accounts.</p>}
              {summary?.savingAccounts?.map((account: { name: string, balance: number }, index: number) => (
                <div key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-success/10 text-success">
                  <span className="font-medium">{account.name}</span>
                  <span>{account.balance.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ASSETS TAB */}
          <TabsContent value="assets" className="space-y-4 animate-in fade-in-5">
            <div>
              <div className="text-2xl font-bold text-primary">
                {summary?.totalAssetsOnly.toLocaleString() ?? '...'}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                Total Assets Value
              </p>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
              {(summary?.assetAccounts?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground italic">No assets.</p>}
              {summary?.assetAccounts?.map((account: { name: string, balance: number }, index: number) => (
                <div key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-primary/10 text-primary">
                  <span className="font-medium">{account.name}</span>
                  <span>{account.balance.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
