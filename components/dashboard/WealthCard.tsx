import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, ShieldCheck, CalendarClock, Sparkles, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { calculateGoalStrategy } from '@/lib/finance-utils';

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
                {isPrivacyMode ? '••••' : (
                  summary?.budgetBreakdown
                    ?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving')
                    .reduce((acc: number, item: BudgetBreakdownItem) => acc + item.accumulated, 0)
                    .toLocaleString() ?? '0'
                )}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                Total Funds in Goals
              </p>
            </div>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
              {summary?.budgetBreakdown?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving').length === 0 && (
                <p className="text-xs text-muted-foreground italic">No goals set.</p>
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
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`px-1 py-0 h-4 text-[9px] border gap-1 font-semibold ${typeColor}`}>
                                <Icon className="h-2 w-2" />
                                {typeLabel}
                            </Badge>
                            <span className="text-muted-foreground font-medium truncate max-w-[120px]">{item.categoryName}</span>
                            {isMet && (
                                <Badge variant="default" className="px-1 py-0 h-4 text-[9px] bg-success hover:bg-success/90 text-success-foreground border-0 gap-1">
                                    Met
                                </Badge>
                            )}
                        </div>
                        <div className="text-right">
                            <span className={cn("font-bold text-xs block", isMet ? "text-success" : "text-foreground")}>
                                {isPrivacyMode ? '••••' : displayCurrent.toLocaleString()}
                            </span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", isMet ? "bg-success" : "bg-primary")}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      
                      <div className="flex justify-between items-end text-[10px] text-muted-foreground">
                        <div>
                            <span>{displayTarget ? `${Math.round(percentage)}%` : 'N/A'}</span>
                            <span className="mx-1">•</span>
                            <span>{displayLabel}: {isPrivacyMode ? '••••' : (displayTarget ? displayTarget.toLocaleString() : '∞')}</span>
                        </div>
                        
                        {/* Strategy Suggestion (Only show if NOT met yet to avoid confusion) */}
                        {!isMet && strategy && strategy.monthly > 0 && !strategy.isDone && (
                            <div className="flex items-center gap-1 text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded-sm" title="Suggested monthly saving to reach goal on time">
                                <TrendingUp className="h-3 w-3" />
                                <span>Rec: +{new Intl.NumberFormat('en-US', { notation: "compact" }).format(Math.ceil(strategy.monthly))}/mo</span>
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
                {isPrivacyMode ? '••••' : (summary?.totalSavingsOnly.toLocaleString() ?? '...')}
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
                  <span>{isPrivacyMode ? '••••' : account.balance.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ASSETS TAB */}
          <TabsContent value="assets" className="space-y-4 animate-in fade-in-5">
            <div>
              <div className="text-2xl font-bold text-primary">
                {isPrivacyMode ? '••••' : (summary?.totalAssetsOnly.toLocaleString() ?? '...')}
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
                  <span>{isPrivacyMode ? '••••' : account.balance.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
