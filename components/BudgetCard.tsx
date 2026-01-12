'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Edit2, Trash2, Target, Wallet, CheckCircle2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Doc, Id } from '../convex/_generated/dataModel'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { calculateBudgetPace, calculateGoalStrategy } from '@/lib/finance-utils'

interface BudgetStatusItem {
  category: any; // Using any for Doc<'categories'> to avoid strict import issues here
  budget: any | null;
  spent: number;
  accumulated: number;
}

interface BudgetCardProps {
  item: BudgetStatusItem;
  daysRemaining: number;
  isPastMonth: boolean;
  selectedDate: Date;
  onEdit: (category: any, amount?: string) => void;
  onDelete: (id: any, name: string) => void;
  onClickGoal?: (id: any) => void;
}

export default function BudgetCard({
  item,
  daysRemaining,
  isPastMonth,
  selectedDate,
  onEdit,
  onDelete,
  onClickGoal
}: BudgetCardProps) {
  const { category, budget, spent, accumulated } = item;
  
  const isGoal = category.type === 'saving' && category.targetAmount;
  const targetAmount = isGoal ? parseFloat(category.targetAmount!.replace(/,/g, '')) : 0;
  const goalPercentage = isGoal && targetAmount > 0 ? (accumulated / targetAmount) * 100 : 0;
  const limit = budget ? parseFloat(budget.amount) : 0;
  const percentage = limit > 0 ? (spent / limit) * 100 : 0;
  const isOverBudget = spent > limit && limit > 0;
  const remaining = Math.max(0, limit - spent);
  const dailySafeSpend = remaining / daysRemaining;

  // Pacing Logic (Expenses)
  const pacing = category.enablePacing && category.type === 'expense' && budget
    ? calculateBudgetPace(spent, limit, selectedDate.getFullYear(), selectedDate.getMonth())
    : null;

  // Goal Strategy Logic (Savings)
  const strategy = isGoal && !isPastMonth 
    ? calculateGoalStrategy(accumulated, targetAmount, category.targetDate) 
    : null;

  // --- NEW LOGIC FOR SAVINGS CARD ---
  // Benchmark = Manual Budget Limit OR Calculated Strategy Suggestion
  const monthlyTarget = budget && limit > 0 ? limit : (strategy?.monthly || 0);
  // Progress = What we saved this month (spent) / Monthly Target
  const monthlyProgress = monthlyTarget > 0 ? (spent / monthlyTarget) * 100 : 0;
  const isMonthlyGoalMet = monthlyTarget > 0 && spent >= monthlyTarget;

  return (
    <Card 
      className={cn(
        "p-6 flex flex-col justify-between shadow-sm h-full min-h-[160px] transition-all",
        isGoal ? "cursor-pointer hover:shadow-md active:scale-[0.99]" : ""
      )}
      onClick={() => {
        if (isGoal && onClickGoal) onClickGoal(category._id)
      }}
    >
      <div>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              {category.name}
              {isGoal && isMonthlyGoalMet && (
                  <span className="flex items-center justify-center bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 p-1 rounded-full" title="Monthly Goal Met!">
                      <CheckCircle2 className="h-4 w-4" />
                  </span>
              )}
              {pacing && (
                <Popover>
                  <PopoverTrigger asChild>
                    <div onClick={(e) => e.stopPropagation()} className={cn(
                      "h-2 w-2 rounded-full animate-pulse cursor-pointer",
                      pacing.status === 'safe' ? "bg-success" : 
                      pacing.status === 'warning' ? "bg-yellow-500" : "bg-destructive"
                    )} />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-4" align="start">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          pacing.status === 'safe' ? "bg-success" : 
                          pacing.status === 'warning' ? "bg-yellow-500" : "bg-destructive"
                        )} />
                        <h4 className="font-semibold text-sm">
                          {pacing.status === 'safe' ? "On Track" : 
                           pacing.status === 'warning' ? "Spending Alert" : "Spending Critical"}
                        </h4>
                      </div>
                      
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Time Passed:</span>
                          <span>{Math.round(pacing.timeProgress)}% of month</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Budget Used:</span>
                          <span className={cn(
                            "font-medium",
                            pacing.status !== 'safe' ? "text-destructive" : ""
                          )}>{Math.round(pacing.spendProgress)}%</span>
                        </div>
                      </div>

                      <div className="bg-muted/50 p-2 rounded text-xs italic">
                        {pacing.status === 'safe' 
                          ? "You are saving money compared to the monthly timeline. Keep it up!" 
                          : pacing.status === 'warning'
                          ? `You're spending slightly faster than time passes. Try to limit daily spending to ~${pacing.dailyLimit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : `Whoa! You've used a lot of budget early. Reduce spending to ${pacing.dailyLimit.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day to survive the month.`
                        }
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground capitalize">
                {isGoal ? (category.goalType === 'bill' ? 'Sinking Fund' : category.goalType === 'investment' ? 'Investment' : 'Goal') : category.type}
              </p>
              {!isGoal && budget && remaining > 0 && !isPastMonth && !pacing && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                  ~{dailySafeSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day
                </span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                // Pass suggestion as default amount if editing
                const suggestedAmount = strategy?.monthly ? strategy.monthly.toFixed(0) : undefined;
                onEdit(category, budget?.amount || suggestedAmount);
              }}>
                <Edit2 className="mr-2 h-4 w-4" />
                {isGoal ? 'Set Monthly Contribution' : (budget ? 'Edit Budget' : 'Set Budget')}
              </DropdownMenuItem>
              {budget && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(budget._id, category.name);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove Budget
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-4">
          {isGoal ? (
            <>
              {/* Monthly Progress Bar for Goals */}
              <div className="flex justify-between text-sm">
                <span className="font-medium text-primary">
                  {spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-muted-foreground font-normal">saved this month</span>
                </span>
                <span className="text-muted-foreground">
                  of {monthlyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <Progress 
                value={Math.min(monthlyProgress, 100)} 
                className={cn("h-2 bg-muted", isMonthlyGoalMet ? "[&>div]:bg-success" : "[&>div]:bg-blue-500")}
              />
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    {isMonthlyGoalMet ? (
                        <span className="text-success font-medium flex items-center gap-1">
                            Monthly Target Met! 🎉
                        </span>
                    ) : (
                        <span>{Math.round(monthlyProgress)}% of monthly target</span>
                    )}
                </div>
                {/* Total Accumulated (Small Info) */}
                <span>Total: {accumulated.toLocaleString(undefined, { notation: 'compact' })}</span>
              </div>
              
              {/* Footer with Suggestion vs Budget Logic */}
              <div className="pt-3 border-t mt-2 flex justify-between items-center bg-muted/20 -mx-6 -mb-6 p-4 rounded-b-xl">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Set Limit</span>
                    <span className="text-sm font-medium">
                        {budget ? limit.toLocaleString(undefined, { maximumFractionDigits: 0 }) : 'None'}
                    </span>
                </div>
                
                {strategy && strategy.monthly > 0 && !isMonthlyGoalMet && (
                    <div className="text-right">
                        <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Suggested</span>
                        <div className="flex items-center gap-1 justify-end">
                            <Target className="h-3 w-3 text-blue-500" />
                            <span className="text-sm font-bold text-blue-600">
                                {strategy.monthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-muted-foreground font-normal">spent</span>
                </span>
                <span className="text-muted-foreground">
                  {budget ? `${limit.toLocaleString(undefined, { maximumFractionDigits: 0 })} limit` : 'No limit set'}
                </span>
              </div>

              {budget && (
                <>
                  <Progress 
                    value={Math.min(percentage, 100)} 
                    className={cn(
                      "h-2",
                      isOverBudget ? "bg-destructive/20 [&>div]:bg-destructive" : 
                      (pacing?.status === 'warning' ? "bg-yellow-500/20 [&>div]:bg-yellow-500" : "")
                    )}
                  />
                  <div className="flex justify-between items-center">
                    <p className={cn(
                      "text-xs font-semibold",
                      isOverBudget ? "text-destructive" : "text-foreground"
                    )}>
                      {isOverBudget 
                        ? `-${(spent - limit).toLocaleString(undefined, { maximumFractionDigits: 0 })} over budget` 
                        : `${(limit - spent).toLocaleString(undefined, { maximumFractionDigits: 0 })} left`
                      }
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(percentage)}%
                    </span>
                  </div>

                  {pacing && (
                    <p className={cn(
                        "text-[10px] font-medium mt-0.5",
                        pacing.status === 'danger' ? "text-destructive" : 
                        pacing.status === 'warning' ? "text-yellow-600" : "text-success"
                    )}>
                        {pacing.status === 'danger' ? "⚠️ Spending too fast!" :
                         pacing.status === 'warning' ? "⚡ Pace is a bit fast" :
                         "✅ Pace is healthy"}
                    </p>
                  )}

                  {pacing && pacing.dailyLimit > 0 && !isPastMonth && (
                    <div className="mt-3 pt-3 border-t border-dashed">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
                        Daily Allowance
                      </p>
                      <p className="text-sm font-semibold">
                        {pacing.dailyLimit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        <span className="text-muted-foreground font-normal text-xs ml-1">
                          / day left
                        </span>
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {!budget && (
                <Button 
                  variant="outline" 
                  className="w-full border-dashed"
                  onClick={() => onEdit(category)}
                >
                  Set {format(selectedDate, 'MMM')} Limit
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
