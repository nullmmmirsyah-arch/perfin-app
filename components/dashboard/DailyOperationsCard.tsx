import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Info, CalendarClock, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

const BudgetRow = ({ item, daysRemaining }: { item: BudgetBreakdownItem, daysRemaining: number }) => {
    const percentage = item.limit > 0 ? (item.spent / item.limit) * 100 : 0;
    const isOver = item.spent > item.limit;
    const safeSpend = Math.max(0, item.remaining) / daysRemaining;

    return (
        <div className="flex flex-col gap-1.5 pb-2 border-b border-border/40 last:border-0 last:pb-0">
            <div className="flex justify-between items-start">
                <span className="text-sm font-medium truncate pr-2">
                    {item.categoryName}
                </span>
                
                {/* Safe Daily Badge - Always Visible if applicable */}
                {!isOver && item.remaining > 0 && safeSpend > 0 ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal bg-primary/5 text-primary border-primary/20 shrink-0">
                        ~{safeSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day
                    </Badge>
                ) : isOver ? (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 font-normal shrink-0">
                        Over Budget
                    </Badge>
                ) : (
                    <span className="text-[10px] text-muted-foreground font-medium">Done</span>
                )}
            </div>
            
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all duration-500", isOver ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                <span>{item.spent.toLocaleString()} / {item.limit.toLocaleString()}</span>
                <span className={isOver ? "text-destructive font-bold" : "text-foreground font-medium"}>
                    {isOver 
                        ? `-${(item.spent - item.limit).toLocaleString()}` 
                        : `${item.remaining.toLocaleString()} left`
                    }
                </span>
            </div>
        </div>
    );
};

export function DailyOperationsCard({ summary }: Props) {
  // Insight Logic
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const daysRemaining = daysInMonth - daysPassed + 1; // Include today
  
  const remainingBudget = summary?.remainingBudget || 0;
  const dailySafeSpend = remainingBudget > 0 ? remainingBudget / daysRemaining : 0;

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
                        {remainingBudget.toLocaleString() ?? '...'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                            Monthly Budget Left
                        </p>
                        {remainingBudget > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-primary/5 text-primary border-primary/20 cursor-help" title="Safe to spend daily">
                                ~{dailySafeSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day
                            </Badge>
                        )}
                    </div>
                </div>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground -mt-1">
                            <Info className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72">
                        <div className="space-y-3">
                            <h4 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
                                <Info className="h-3 w-3" /> Budget Insights
                            </h4>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Unassigned Cash</span>
                                    <span className={cn(
                                        "font-bold",
                                        (summary?.unassignedCash ?? 0) < 0 ? "text-destructive" : "text-success"
                                    )}>
                                        {summary?.unassignedCash.toLocaleString() ?? '...'}
                                    </span>
                                </div>
                                
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <CalendarClock className="h-3 w-3" /> Time Remaining
                                    </span>
                                    <span className="font-medium">
                                        {daysRemaining} days <span className="text-muted-foreground text-xs font-normal">({Math.round((daysPassed/daysInMonth)*100)}% passed)</span>
                                    </span>
                                </div>
                            </div>

                            <div className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded space-y-1">
                                <p>• <strong>Safe Spend:</strong> You can spend <strong>{dailySafeSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> today globally to stay on track.</p>
                                <p>• <strong>Tip:</strong> Tap on any category below to see its specific daily limit.</p>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            
            <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin pb-12">
              {summary?.budgetBreakdown?.filter((item: BudgetBreakdownItem) => item.categoryType !== 'saving').length === 0 && (
                <p className="text-xs text-muted-foreground italic">No expense budgets set.</p>
              )}
              {summary?.budgetBreakdown
                ?.filter((item: BudgetBreakdownItem) => item.categoryType !== 'saving')
                .map((item: BudgetBreakdownItem, index: number) => (
                    <BudgetRow key={index} item={item} daysRemaining={daysRemaining} />
                ))}
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
