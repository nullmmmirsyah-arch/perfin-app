import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Info, CalendarClock, ChevronDown, ChevronUp } from 'lucide-react';      
import { cn, formatCurrency } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calculateBudgetPace } from '@/lib/finance-utils';

export type BudgetBreakdownItem = {
  categoryName: string;
  categoryType: string;
  targetAmount?: number;
  targetDate?: string;
  enablePacing?: boolean;
  goalType?: string;
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
  isPrivacyMode?: boolean;
};

const BudgetRow = ({ item, daysRemaining, isPrivacyMode }: { item: BudgetBreakdownItem, daysRemaining: number, isPrivacyMode?: boolean }) => {
    const percentage = item.limit > 0 ? (item.spent / item.limit) * 100 : 0;
    const isOver = item.spent > item.limit;
    const safeSpend = Math.max(0, item.remaining) / daysRemaining;

    // Pacing Logic
    const now = new Date();
    const pacing = item.enablePacing && item.limit > 0
        ? calculateBudgetPace(item.spent, item.limit, now.getFullYear(), now.getMonth())
        : null;

    return (
        <div className="flex flex-col gap-1.5 pb-2 border-b border-border/40 last:border-0 last:pb-0">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-1.5 truncate pr-2">
                    <span className="text-sm font-medium truncate">
                        {item.categoryName}
                    </span>
                    {pacing && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <div className={cn(
                                    "h-2 w-2 rounded-full animate-pulse cursor-pointer shrink-0",
                                    pacing.status === 'safe' ? "bg-success" : 
                                    pacing.status === 'warning' ? "bg-yellow-500" : "bg-destructive"
                                )} />
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3" align="start">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 border-b pb-1">
                                        <div className={cn(
                                            "h-2 w-2 rounded-full",
                                            pacing.status === 'safe' ? "bg-success" : 
                                            pacing.status === 'warning' ? "bg-yellow-500" : "bg-destructive"
                                        )} />
                                        <h4 className="font-semibold text-xs">
                                            {pacing.status === 'safe' ? "On Track" : 
                                             pacing.status === 'warning' ? "Spending Alert" : "Critical"}
                                        </h4>
                                    </div>
                                                                        <p className="text-[10px] text-muted-foreground">    
                                                                            {pacing.status === 'safe'
                                                                                ? "Pace is healthy."
                                                                                : pacing.status === 'warning'
                                                                                ? `Spending fast! Limit: ~${formatCurrency(pacing.dailyLimit)}/day`
                                                                                : `Too fast! Reduce to ~${formatCurrency(pacing.dailyLimit)}/day`
                                                                            }
                                                                        </p>                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
                
                {/* Safe Daily Badge - Always Visible if applicable */}
                {!isOver && item.remaining > 0 && safeSpend > 0 ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal bg-primary/5 text-primary border-primary/20 shrink-0">
                        ~{formatCurrency(safeSpend, { isPrivacyMode })}/day
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
                    className={cn(
                        "h-full rounded-full transition-all duration-500", 
                        isOver ? "bg-destructive" : 
                        (pacing?.status === 'warning' ? "bg-yellow-500" : 
                         pacing?.status === 'danger' ? "bg-destructive" : "bg-primary")
                    )}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                <span>
                    {formatCurrency(item.spent, { isPrivacyMode })} / {formatCurrency(item.limit, { isPrivacyMode })}
                </span>
                <span className={isOver ? "text-destructive font-bold" : "text-foreground font-medium"}>
                    {isOver
                        ? `-${formatCurrency(item.spent - item.limit, { isPrivacyMode })}`
                        : `${formatCurrency(item.remaining, { isPrivacyMode })} left`
                    }
                </span>
            </div>
        </div>
    );
};

export function DailyOperationsCard({ summary, isPrivacyMode }: Props) {
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
                                  {formatCurrency(remainingBudget, { isPrivacyMode })}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                                      Monthly Budget Left
                                  </p>
                                  {remainingBudget > 0 && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-primary/5 text-primary border-primary/20 cursor-help" title="Safe to spend daily"> 
                                          ~{formatCurrency(dailySafeSpend, { isPrivacyMode })}/day
                                      </Badge>
                                  )}
                              </div>
                          </div>                <Popover>
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
                                        {formatCurrency(summary?.unassignedCash, { isPrivacyMode })}
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
                                <p>• <strong>Safe Spend:</strong> You can spend <strong>{formatCurrency(dailySafeSpend, { isPrivacyMode })}</strong> today globally to stay on track.</p>
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
                .sort((a, b) => {
                    const now = new Date();
                    
                    const getPacingScore = (item: BudgetBreakdownItem) => {
                        if (!item.enablePacing || item.limit <= 0) return 0; // Lowest priority
                        
                        const p = calculateBudgetPace(item.spent, item.limit, now.getFullYear(), now.getMonth());
                        if (p.status === 'danger') return 3;
                        if (p.status === 'warning') return 2;
                        return 1; // Safe but tracked
                    };

                    const scoreA = getPacingScore(a);
                    const scoreB = getPacingScore(b);

                    // Sort Descending by Score (High Priority First)
                    if (scoreA !== scoreB) return scoreB - scoreA;
                    
                    // Secondary Sort: Percentage Spent (Highest first)
                    const pctA = a.limit > 0 ? (a.spent / a.limit) : 0;
                    const pctB = b.limit > 0 ? (b.spent / b.limit) : 0;
                    return pctB - pctA;
                })
                .map((item: BudgetBreakdownItem, index: number) => (
                    <BudgetRow key={index} item={item} daysRemaining={daysRemaining} isPrivacyMode={isPrivacyMode} />
                ))}
            </div>
          </TabsContent>

          {/* CASH TAB */}
          <TabsContent value="cash" className="space-y-4 animate-in fade-in-5">
            <div>
              <div className="text-2xl font-bold">
                {formatCurrency(summary?.liquidCash, { isPrivacyMode })}
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
                  <span>{formatCurrency(account.balance, { isPrivacyMode })}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
