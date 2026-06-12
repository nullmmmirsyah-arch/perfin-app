import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, ShieldCheck, CalendarClock, Sparkles, TrendingUp, ChevronRight, Landmark } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { calculateGoalStrategy } from '@/lib/finance-utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type SummaryData = {
  budgetBreakdown: BudgetBreakdownItem[];
  totalSavingsOnly: number;
  savingAccounts: { name: string; balance: number }[];
  totalAssetsOnly: number;
  assetAccounts: { name: string; balance: number }[];
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function WealthCard({ summary, isPrivacyMode }: Props) {
  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Wealth & Goals</CardTitle>
          <Button variant="ghost" size="sm" className="h-8 text-xs font-normal text-muted-foreground hover:text-primary px-2" asChild>
            <Link href="/goals" className="flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
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
                {formatCurrency(
                  summary?.budgetBreakdown
                    ?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving')
                    .reduce((acc: number, item: BudgetBreakdownItem) => acc + item.accumulated, 0),
                  { isPrivacyMode }
                )}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                Total Funds in Goals
              </p>
            </div>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
              {summary?.budgetBreakdown?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving').length === 0 && (
                <EmptyState compact icon={Sparkles} description="No goals set." />
              )}
              {summary?.budgetBreakdown
                ?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving')
                .map((item: BudgetBreakdownItem, index: number) => {
                  // Logic: Prioritize Monthly Budget if it exists (> 0), otherwise show Global Goal
                  const hasMonthlyBudget = item.limit > 0;
                  
                  // Contextual Data
                  const displayTarget = hasMonthlyBudget ? item.limit : (item.targetAmount || 0);
                  const displayCurrent = hasMonthlyBudget ? item.spent : item.accumulated;
                  const displayLabel = hasMonthlyBudget ? "Monthly Target" : "Global Goal";
                  
                  // Percentage
                  const percentage = displayTarget > 0 ? (displayCurrent / displayTarget) * 100 : 0;
                  const isMet = hasMonthlyBudget && displayCurrent >= displayTarget;

                  // Strategy Insight (Always based on Global Goal to guide the Monthly Budget)
                  // We show this to help user set the CORRECT monthly budget
                  const globalTarget = item.targetAmount || 0;
                  const strategy = calculateGoalStrategy(item.accumulated, globalTarget, item.targetDate);

                  // Type Logic
                  let typeLabel = "Goal";
                  let typeIcon = Sparkles;
                  // Using Chart colors for consistent theming
                  let typeColor = "text-chart-1 bg-chart-1/10 border-chart-1/20"; 

                  if (item.goalType === 'investment') {
                      typeLabel = "Wealth";
                      typeIcon = ShieldCheck;
                      typeColor = "text-chart-2 bg-chart-2/10 border-chart-2/20";
                  } else if (item.goalType === 'bill') {
                      typeLabel = "Bill";
                      typeIcon = CalendarClock;
                      typeColor = "text-chart-3 bg-chart-3/10 border-chart-3/20";
                  }

                  const Icon = typeIcon;

                  return (
                    <div key={index} className="flex flex-col gap-1.5 pb-2">
                      <Link 
                        href={`/goals/${item.categoryId}`} 
                        className="group block p-2 -mx-2 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex justify-between items-center text-sm mb-1.5">
                          <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`px-1 py-0 h-4 text-[9px] border gap-1 font-semibold ${typeColor}`}>
                                  <Icon className="h-2 w-2" />
                                  {typeLabel}
                              </Badge>
                              <span className="text-muted-foreground font-medium truncate max-w-[120px] group-hover:text-foreground transition-colors">{item.categoryName}</span>
                              {isMet && (
                                  <Badge variant="default" className="px-1 py-0 h-4 text-[9px] bg-success hover:bg-success/90 text-success-foreground border-0 gap-1">
                                      Met
                                  </Badge>
                              )}
                          </div>
                          <div className="flex items-center gap-1">
                              <span className={cn("font-bold text-xs block", isMet ? "text-success" : "text-foreground")}>
                                  {formatCurrency(displayCurrent, { isPrivacyMode })}
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", isMet ? "bg-success" : "bg-primary")}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </Link>
                      
                      <div className="flex justify-between items-end text-[10px] text-muted-foreground px-2">
                        <div>
                            <span>{displayTarget ? `${Math.round(percentage)}%` : 'N/A'}</span>
                            <span className="mx-1">•</span>
                            <span>{displayLabel}: {formatCurrency(displayTarget, { isPrivacyMode })}</span>
                        </div>
                        
                        {/* Strategy Suggestion (Only show if NOT met yet to avoid confusion) */}
                        {!isMet && strategy && strategy.monthly > 0 && !strategy.isDone && (
                            <div className="flex items-center gap-1 text-primary font-medium" title="Suggested monthly saving to reach goal on time">
                                <TrendingUp className="h-3 w-3" />
                                <span>Rec: +{formatCurrency(Math.ceil(strategy.monthly), { notation: "compact" })}/mo</span>
                            </div>
                        )}
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
                {formatCurrency(summary?.totalSavingsOnly, { isPrivacyMode })}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                Total In Savings Accounts
              </p>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
              {(summary?.savingAccounts?.length ?? 0) === 0 && <EmptyState compact icon={Landmark} description="No saving accounts." />}
              {summary?.savingAccounts?.map((account: { name: string, balance: number }, index: number) => (
                <div key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-success/10 text-success">
                  <span className="font-medium">{account.name}</span>
                  <span>{formatCurrency(account.balance, { isPrivacyMode })}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ASSETS TAB */}
          <TabsContent value="assets" className="space-y-4 animate-in fade-in-5">        
            <div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(summary?.totalAssetsOnly, { isPrivacyMode })}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                Total Assets Value
              </p>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
              {(summary?.assetAccounts?.length ?? 0) === 0 && <EmptyState compact icon={Landmark} description="No assets." />}
              {summary?.assetAccounts?.map((account: { name: string, balance: number }, index: number) => (
                <div key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-primary/10 text-primary">
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
