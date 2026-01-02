import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export type BudgetBreakdownItem = {
  categoryName: string;
  categoryType: string;
  targetAmount?: number;
  accumulated: number;
  limit: number;
  spent: number;
  remaining: number;
};

type SummaryData = {
  remainingBudget: number;
  unassignedCash: number;
  liquidCash: number;
  budgetBreakdown: BudgetBreakdownItem[];
  cashAccounts: { name: string; balance: number }[];
};

type Props = {
  summary: SummaryData | undefined | null;
};

export function DailyOperationsCard({ summary }: Props) {
  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Daily Operations</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="budget" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="cash">Cash</TabsTrigger>
          </TabsList>

          {/* BUDGET TAB */}
          <TabsContent value="budget" className="space-y-4 animate-in fade-in-5">
            <div className="flex items-start justify-between mb-2">
                <div>
                    <div className="text-2xl font-bold text-primary">
                        {summary?.remainingBudget.toLocaleString() ?? '...'}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                        Monthly Budget Left
                    </p>
                </div>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground -mt-1">
                            <Info className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64">
                        <div className="space-y-3">
                            <h4 className="font-medium text-sm border-b pb-2">Budget Details</h4>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Unassigned Cash</span>
                                <span className={cn(
                                    "font-bold",
                                    (summary?.unassignedCash ?? 0) < 0 ? "text-destructive" : "text-success"
                                )}>
                                    {summary?.unassignedCash.toLocaleString() ?? '...'}
                                </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded">
                                Unassigned Cash = Total Income - Total Budgeted (All Time). Keep this positive!
                            </p>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
              {summary?.budgetBreakdown?.filter((item: BudgetBreakdownItem) => item.categoryType !== 'saving').length === 0 && (
                <p className="text-xs text-muted-foreground italic">No expense budgets set.</p>
              )}
              {summary?.budgetBreakdown
                ?.filter((item: BudgetBreakdownItem) => item.categoryType !== 'saving')
                .map((item: BudgetBreakdownItem, index: number) => {
                  const percentage = item.limit > 0 ? (item.spent / item.limit) * 100 : 0;
                  const isOver = item.spent > item.limit;

                  return (
                    <div key={index} className="flex flex-col gap-1.5 pb-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">{item.categoryName}</span>
                        <span className={cn(
                          "font-bold text-xs",
                          isOver ? "text-destructive" : "text-primary"
                        )}>
                          {isOver
                            ? `Over ${(item.spent - item.limit).toLocaleString()}`
                            : `${item.remaining.toLocaleString()} left`
                          }
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", isOver ? "bg-destructive" : "bg-primary")}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{Math.round(percentage)}%</span>
                        <span>{item.spent.toLocaleString()} / {item.limit.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </TabsContent>

          {/* CASH TAB */}
          <TabsContent value="cash" className="space-y-4 animate-in fade-in-5">
            <div>
              <div className="text-2xl font-bold">
                {summary?.liquidCash.toLocaleString() ?? '...'}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                Total Liquid Cash
              </p>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
              {summary?.cashAccounts?.length === 0 && <p className="text-xs text-muted-foreground italic">No cash accounts.</p>}
              {summary?.cashAccounts?.map((account: { name: string, balance: number }, index: number) => (
                <div key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-muted/20">
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
