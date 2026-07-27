'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Edit2, Trash2, CheckCircle2, ArrowRightLeft } from '@/components/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { calculateBudgetPace, calculateGoalStrategy, getFiscalDateDetails, getFiscalMonthRange } from '@/lib/finance-utils'
import { calculateAllowance } from '@/lib/allowance-calculator'
import { useGoalCelebration } from '@/hooks/useGoalCelebration'
import { useRouter } from 'next/navigation'

interface BudgetStatusItem {
  category: any;
  budget: any | null;
  spent: number;
  accumulated: number;
  pendingReceivables?: number;
  weeklySpent?: number;
}

interface BudgetCardProps {
  item: BudgetStatusItem;
  daysRemaining: number;
  isPastMonth: boolean;
  selectedDate: Date;
  budgetStartDay?: number;
  isAdmin: boolean;
  onEdit: (category: any, amount?: string) => void;
  onDelete: (id: any, name: string) => void;
  onClickGoal?: (id: any) => void;
}

export default function BudgetCard({
  item,
  daysRemaining,
  isPastMonth,
  selectedDate,
  budgetStartDay = 1,
  isAdmin,
  onEdit,
  onDelete,
  onClickGoal
}: BudgetCardProps) {
  const router = useRouter()
  const { category, budget, spent, accumulated } = item;

  const isGoal = category.type === 'saving' && category.targetAmount;
  const targetAmount = isGoal ? parseFloat(category.targetAmount!.replace(/,/g, '')) : 0;

  const limit = budget ? parseFloat(budget.amount) : 0;
  const carryover = budget?.carryoverAmount ? parseFloat(budget.carryoverAmount) : 0;
  const swept = budget?.sweptAmount ? parseFloat(budget.sweptAmount) : 0;

  const effectiveLimit = limit + carryover;
  const remaining = effectiveLimit - spent - swept;

  const now = new Date()
  const { year: fy, month: fm } = getFiscalDateDetails(now.toISOString(), budgetStartDay)
  const fiscalRange = getFiscalMonthRange(fy, fm, budgetStartDay)

  const allowance = category.allowanceType ? calculateAllowance({
    allowanceType: category.allowanceType ?? "budget_period",
    weeklyResetDay: category.weeklyResetDay,
    budgetAmount: effectiveLimit,
    spent,
    weeklySpent: item.weeklySpent ?? 0,
    fiscalPeriodStart: new Date(fiscalRange.start),
    fiscalPeriodEnd: new Date(fiscalRange.end),
    now,
  }) : null

  const percentage = effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : 100;
  const isOverBudget = effectiveLimit <= 0 || spent > effectiveLimit;

  const { year: fiscalYear, month: fiscalMonth } = getFiscalDateDetails(selectedDate.toISOString(), budgetStartDay);
  const pacing = category.enablePacing && category.type === 'expense' && budget
    ? calculateBudgetPace(spent, effectiveLimit, fiscalYear, fiscalMonth, budgetStartDay)
    : null;

  const strategy = isGoal && !isPastMonth
    ? calculateGoalStrategy(accumulated, targetAmount, category.targetDate, budgetStartDay)
    : null;

  const monthlyTarget = budget && effectiveLimit > 0 ? effectiveLimit : (strategy?.monthly || 0);
  const monthlyProgress = monthlyTarget > 0 ? (spent / monthlyTarget) * 100 : 0;
  const isMonthlyGoalMet = monthlyTarget > 0 && spent >= monthlyTarget;

  // Peak-End Rule: confetti when goal is met
  useGoalCelebration(category._id, isGoal && isMonthlyGoalMet)

  return (
    <Card
      className={cn(
        "p-5 flex flex-col justify-between shadow-sm h-full min-h-[150px] min-w-0 transition-all cursor-pointer",
        "hover:shadow-md active:scale-[0.99]",
        isOverBudget && "border-destructive/30"
      )}
      onClick={() => {
        if (isGoal && onClickGoal) {
          onClickGoal(category._id)
        } else {
          router.push(`/categories/${category._id}`)
        }
      }}
    >
      <div>
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base flex items-center gap-2 truncate">
              {category.name}
              {isGoal && isMonthlyGoalMet && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              )}
              {pacing && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[12px] px-2 py-0 h-5 font-medium border shrink-0 pointer-events-none gap-1.5",
                    pacing.status === 'safe' && "border-success/30 text-success bg-success/5",
                    pacing.status === 'warning' && "border-yellow-500/30 text-yellow-600 dark:text-yellow-400 bg-yellow-500/5",
                    pacing.status === 'danger' && "border-destructive/30 text-destructive bg-destructive/5"
                  )}
                >
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    pacing.status === 'safe' && "bg-success",
                    pacing.status === 'warning' && "bg-yellow-500",
                    pacing.status === 'danger' && "bg-destructive"
                  )} />
                  {pacing.status === 'safe' ? "On Track" :
                   pacing.status === 'warning' ? "Watch" :
                   "Too Fast"}
                </Badge>
              )}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-muted-foreground capitalize">
                {isGoal ? (category.goalType === 'bill' ? 'Sinking Fund' : category.goalType === 'investment' ? 'Investment' : 'Goal') : category.type}
              </p>
              {carryover !== 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tight",
                  carryover > 0 ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"
                )}>
                  {carryover > 0 ? `+${formatCurrency(carryover)}` : formatCurrency(carryover)} Rollover
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  const suggestedAmount = strategy?.monthly ? strategy.monthly.toFixed(0) : undefined;
                  onEdit(category, budget?.amount || suggestedAmount);
                }}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  {isGoal ? 'Set Monthly Contribution' : (isOverBudget ? 'Adjust Budget' : (budget ? 'Edit Budget' : 'Set Budget'))}
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
          )}
        </div>

        {/* Content */}
        <div className="space-y-3">
          {isGoal ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-primary">
                  {formatCurrency(spent)} <span className="text-muted-foreground font-normal">saved</span>
                </span>
                <span className="text-muted-foreground">
                  of {formatCurrency(monthlyTarget)}
                </span>
              </div>
              <Progress
                value={Math.min(monthlyProgress, 100)}
                className={cn("h-2 bg-muted", isMonthlyGoalMet ? "[&>div]:bg-success" : "[&>div]:bg-primary")}
              />
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                {isMonthlyGoalMet ? (
                  <span className="text-success font-medium">Monthly Target Met</span>
                ) : (
                  <span>{Math.round(monthlyProgress)}% of target</span>
                )}
                <span>{formatCurrency(accumulated, { notation: 'compact' })} accumulated</span>
              </div>
              {strategy && !strategy.isDone && strategy.months > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{formatCurrency(strategy.monthly)}/mo</span>
                  {' · '}{strategy.months} months to target
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {formatCurrency(spent)} spent
                </span>
                <span className="text-muted-foreground">
                  {budget ? `${formatCurrency(limit)} limit` : 'No limit'}
                </span>
              </div>

              {budget && (
                <>
                  <Progress
                    value={Math.min(percentage, 100)}
                    className={cn(
                      "h-2.5 bg-muted",
                      isOverBudget ? "[&>div]:bg-destructive" :
                      pacing?.status === 'warning' ? "[&>div]:bg-yellow-500" :
                      pacing?.status === 'danger' ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"
                    )}
                  />

                  <div className="flex justify-between items-center">
                    <p className={cn(
                      "text-xs font-semibold",
                      isOverBudget ? "text-destructive" : "text-foreground"
                    )}>
                      {isOverBudget
                        ? `-${formatCurrency(spent - effectiveLimit)} over`
                        : `${formatCurrency(remaining)} left`
                      }
                    </p>
                    {allowance && allowance.allowance > 0 && !isOverBudget && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(allowance.allowance)}/{allowance.type === 'weekly' ? 'week' : 'day'} safe
                      </p>
                    )}
                    {!allowance && pacing && pacing.dailyLimit > 0 && !isOverBudget && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(pacing.dailyLimit)}/day safe
                      </p>
                    )}
                    {pacing && isOverBudget && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(percentage)}%
                      </span>
                    )}
                    {!pacing && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(percentage)}%
                      </span>
                    )}
                  </div>

                  {isOverBudget && pacing && pacing.dailyLimit > 0 && (
                    <p className="text-[11px] text-destructive">
                      Cut to {formatCurrency(pacing.dailyLimit)}/day to recover
                    </p>
                  )}

                  {isOverBudget && isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-destructive/30 text-destructive hover:bg-destructive/5 text-xs h-8"
                      onClick={(e) => { e.stopPropagation(); onEdit(category, budget?.amount); }}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                      Adjust Budget
                    </Button>
                  )}
                </>
              )}

              {isAdmin && !budget && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed text-xs h-8"
                  onClick={(e) => { e.stopPropagation(); onEdit(category); }}
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
