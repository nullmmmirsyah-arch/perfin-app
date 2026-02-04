import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Info, CalendarClock, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';      
import { cn, formatCurrency } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calculateBudgetPace, calculateFiscalDaysRemaining, getFiscalDateDetails } from '@/lib/finance-utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type BudgetBreakdownItem = {
  categoryId: string;
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
  totalSavingsOnly: number;
  totalExpenseObligations: number;
  totalSavingObligations: number;
  totalDebtCovered: number;
  budgetBreakdown: BudgetBreakdownItem[];
  cashAccounts: { 
      name: string; 
      balance: number;
      allocations?: { name: string, amount: number }[];
      bankBalance?: number;
  }[];
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
  budgetStartDay?: number;
};

const BudgetRow = ({ item, daysRemaining, isPrivacyMode, budgetStartDay = 1 }: { item: BudgetBreakdownItem, daysRemaining: number, isPrivacyMode?: boolean, budgetStartDay?: number }) => {
    const percentage = item.limit > 0 ? (item.spent / item.limit) * 100 : 0;
    const isOver = item.spent > item.limit;
    const safeSpend = Math.max(0, item.remaining) / daysRemaining;

    // Pacing Logic
    const now = new Date();
    // FIX: Use Fiscal Month to ensure isCurrentFiscalMonth is TRUE in helper
    const { year, month } = getFiscalDateDetails(now.toISOString(), budgetStartDay);
    
    const pacing = item.enablePacing && item.limit > 0
        ? calculateBudgetPace(item.spent, item.limit, year, month, budgetStartDay)
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
                    <Badge variant="outline" className="text-[10px] px-0 py-0 h-5 font-semibold text-primary border-0 shrink-0 shadow-none">
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

export function DailyOperationsCard({ summary, isPrivacyMode, budgetStartDay = 1 }: Props) {
  // Insight Logic (Fiscal Aware)
  const daysRemaining = calculateFiscalDaysRemaining(budgetStartDay);
  
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
                              <Badge variant="outline" className="text-[10px] px-0 py-0 h-5 text-primary border-0 font-semibold shadow-none cursor-help" title="Safe to spend daily"> 
                                  ~{formatCurrency(dailySafeSpend, { isPrivacyMode })}/day
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
                    <PopoverContent align="end" className="w-80 p-0 overflow-hidden border-none shadow-2xl">
                        <div className="bg-primary p-4 text-primary-foreground">
                            <div className="flex items-center justify-between mb-1">
                                <h4 className="font-bold text-sm flex items-center gap-2">
                                    <Wallet className="h-4 w-4 text-emerald-300" /> Money Trace
                                </h4>
                            </div>
                            <p className="text-[10px] text-primary-foreground/70">Rincian alokasi dari total uang fisik Anda.</p>
                        </div>

                        <div className="p-4 space-y-4 bg-background">
                            {/* SECTION 1: PHYSICAL ASSETS */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">1. Sumber Uang (Fisik)</p>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span>Saldo Cash & Bank</span>
                                        <span className="font-medium">{formatCurrency(summary?.liquidCash, { isPrivacyMode })}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span>Saldo Tabungan (Goals)</span>
                                        <span className="font-medium">{formatCurrency(summary?.totalSavingsOnly, { isPrivacyMode })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold border-t pt-1.5 mt-1.5 border-dashed">
                                        <span>Total Uang</span>
                                        <span className="text-primary">{formatCurrency((summary?.liquidCash || 0) + (summary?.totalSavingsOnly || 0), { isPrivacyMode })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: ALLOCATIONS */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">2. Alokasi (Rencana)</p>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-3 w-3 text-muted-foreground cursor-help opacity-50" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[200px] text-[10px]">
                                                Angka alokasi bersifat &quot;Kewajiban&quot;. Jika pengeluaran melebihi budget, alokasi dianggap 0 karena uangnya sudah terpakai dari saldo fisik.
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Reserved for Expenses</span>
                                        <span className="font-medium">{formatCurrency(summary?.totalExpenseObligations, { isPrivacyMode })}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Reserved for Savings</span>
                                        <span className="font-medium">{formatCurrency((summary?.totalSavingObligations || 0) + (summary?.totalSavingsOnly || 0), { isPrivacyMode })}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="flex items-center gap-1 text-muted-foreground">Free Cash (Unassigned)</span>
                                        <span className={cn(
                                            "font-medium",
                                            (summary?.unassignedCash ?? 0) < 0 ? "text-destructive" : "text-success"
                                        )}>
                                            {formatCurrency(summary?.unassignedCash, { isPrivacyMode })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold border-t pt-1.5 mt-1.5 border-dashed">
                                        <span>Total Terencana</span>
                                        <span className="text-primary">{formatCurrency((summary?.totalExpenseObligations || 0) + (summary?.totalSavingObligations || 0) + (summary?.totalSavingsOnly || 0) + (summary?.unassignedCash || 0), { isPrivacyMode })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* INSIGHTS */}
                            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                    <Wallet className="h-3 w-3" /> Money Insights
                                </p>
                                <div className="space-y-1.5">
                                    {summary?.totalDebtCovered ? (
                                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                                            • Jatah belanja Anda otomatis dipotong <span className="font-bold text-destructive">-{formatCurrency(summary.totalDebtCovered, { isPrivacyMode })}</span> untuk menutupi overspend bulan lalu.
                                        </p>
                                    ) : null}
                                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                                        • Sebesar <span className="font-bold text-primary">{formatCurrency(summary?.totalSavingObligations, { isPrivacyMode })}</span> dijadwalkan masuk tabungan. Pastikan Anda melakukan transfer agar saldo Goals bertambah.
                                    </p>
                                </div>
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
                    const { year, month } = getFiscalDateDetails(now.toISOString(), budgetStartDay);
                    
                    const getPacingScore = (item: BudgetBreakdownItem) => {
                        if (!item.enablePacing || item.limit <= 0) return 0;
                        
                        const p = calculateBudgetPace(item.spent, item.limit, year, month, budgetStartDay);
                        if (p.status === 'danger') return 3;
                        if (p.status === 'warning') return 2;
                        return 1;
                    };

                    const scoreA = getPacingScore(a);
                    const scoreB = getPacingScore(b);

                    if (scoreA !== scoreB) return scoreB - scoreA;
                    
                    const pctA = a.limit > 0 ? (a.spent / a.limit) : 0;
                    const pctB = b.limit > 0 ? (b.spent / b.limit) : 0;
                    return pctB - pctA;
                })
                .map((item: BudgetBreakdownItem, index: number) => (
                    <BudgetRow key={index} item={item} daysRemaining={daysRemaining} isPrivacyMode={isPrivacyMode} budgetStartDay={budgetStartDay} />
                ))}
            </div>
          </TabsContent>

          {/* CASH TAB - REFACTORED */}
          <TabsContent value="cash" className="space-y-4 animate-in fade-in-5">
            <div>
              <div className="text-2xl font-bold">
                {formatCurrency(summary?.liquidCash, { isPrivacyMode })}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                Total Liquid Cash
              </p>
            </div>
            <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
              {summary?.cashAccounts?.length === 0 && <p className="text-xs text-muted-foreground italic">No cash accounts.</p>}
              {summary?.cashAccounts?.map((account, index) => {
                  const hasAllocations = (account.allocations?.length || 0) > 0;
                  
                  return (
                    <div key={index} className="flex flex-col gap-2 p-3 rounded-lg bg-card border shadow-sm">
                        {/* Header: Name & Total Balance */}
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-semibold">{account.name}</span>
                            <span className="font-mono font-bold">
                                {formatCurrency(account.bankBalance ?? account.balance, { isPrivacyMode })}
                            </span>
                        </div>

                        {/* Allocation Details */}
                        {hasAllocations && (
                            <div className="pl-2 border-l-2 border-primary/20 space-y-1.5 mt-1">
                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <span>Funds Breakdown:</span>
                                </div>
                                {account.allocations?.map((alloc, idx) => (
                                    <div key={idx} className="flex justify-between text-[10px] text-muted-foreground/80">
                                        <span>↳ {alloc.name}</span>
                                        <span>-{formatCurrency(alloc.amount, { isPrivacyMode })}</span>
                                    </div>
                                ))}
                                {/* True Available */}
                                <div className="flex justify-between items-center pt-1 border-t border-dashed mt-1">
                                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">True Available</span>
                                    <span className="text-xs font-bold text-primary">
                                        {formatCurrency(account.balance, { isPrivacyMode })}
                                    </span>
                                </div>
                            </div>
                        )}
                        {!hasAllocations && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-success/50" /> Fully Available
                            </div>
                        )}
                    </div>
                  );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}