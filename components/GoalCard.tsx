'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Doc } from '../convex/_generated/dataModel'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { calculateGoalStrategy } from '@/lib/finance-utils'
import { TrendingUp, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface GoalCardProps {
  goal: Doc<'categories'> & { 
      currentAmount?: number, 
      currentBudget?: Doc<'budgets'>, 
      thisMonthContribution?: number 
  }
  isCompleted?: boolean
  onClick: () => void
}

export default function GoalCard({ goal, isCompleted = false, onClick }: GoalCardProps) {
  const globalTarget = goal.targetAmount ? parseFloat(goal.targetAmount.replace(/,/g, '')) : 0
  const globalCollected = goal.currentAmount || 0
  
  // Monthly Logic
  const monthlyLimit = goal.currentBudget ? parseFloat(goal.currentBudget.amount.replace(/,/g, '') || '0') : 0;
  const monthlyContribution = goal.thisMonthContribution || 0;
  const hasMonthlyBudget = monthlyLimit > 0;
  const isMonthlyMet = hasMonthlyBudget && monthlyContribution >= monthlyLimit;

  // Display Context - ALWAYS SHOW GLOBAL/LONG TERM by default per user request
  const displayTarget = globalTarget;
  const displayCurrent = globalCollected;
  const displayProgress = displayTarget > 0 ? (displayCurrent / displayTarget) * 100 : 0;
  
  // Strategy Insight (Required /mo)
  const strategy = !isCompleted && globalTarget > 0 
    ? calculateGoalStrategy(globalCollected, globalTarget, goal.targetDate) 
    : null;

  return (
    <Card 
      className={cn(
        "p-4 space-y-4 cursor-pointer hover:shadow-md transition active:scale-[0.98] relative overflow-hidden", 
        isCompleted && "bg-muted/30 border-primary/20",
        // Visual hint for monthly success, but subtle
        isMonthlyMet && !isCompleted && "border-success/30 bg-success/5"
      )}
      onClick={onClick}
    >
      {/* Background Decorator for Investment */}
      {goal.goalType === 'investment' && !isCompleted && (
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-primary/10 rounded-full blur-xl" />
      )}

      <div className="flex justify-between items-start relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg leading-tight line-clamp-1">{goal.name}</h3>
            {isMonthlyMet && !isCompleted && (
                <Badge variant="default" className="px-1 py-0 h-4 text-[9px] bg-success hover:bg-success text-success-foreground border-0 uppercase">
                    Monthly Met
                </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {goal.targetDate ? `Due: ${format(new Date(goal.targetDate), 'MMM yyyy')}` : 'No deadline'}
          </p>
        </div>
        {isCompleted ? (
          <span className="text-[10px] bg-success/10 text-success px-2 py-1 rounded-full font-bold uppercase flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Done
          </span>
        ) : (
            // Only show Strategy Recommendation if NOT met yet this month
            !isMonthlyMet && strategy && strategy.monthly > 0 && (
                <div className="text-right">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Required</span>
                    <span className="text-xs font-bold text-primary flex items-center justify-end gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {new Intl.NumberFormat('en-US', { notation: "compact" }).format(Math.ceil(strategy.monthly))}/mo
                    </span>
                </div>
            )
        )}
      </div>

      <div className="space-y-2 relative z-10">
        <div className="flex justify-between text-sm items-end">
          <div className="flex flex-col">
             <span className="text-xs text-muted-foreground">Collected</span>
             <span className={cn("font-bold", isCompleted ? "text-success" : "text-foreground")}>
                {new Intl.NumberFormat().format(displayCurrent)}
             </span>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-xs text-muted-foreground">Global Target</span>
             <span className="font-medium">
                {new Intl.NumberFormat().format(displayTarget)}
             </span>
          </div>
        </div>
        <Progress 
            value={isCompleted ? 100 : displayProgress} 
            className={cn("h-2", (isCompleted || isMonthlyMet) && "[&>div]:bg-success")} 
        />
        
        <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1">
            <span>{Math.round(displayProgress)}% of total</span>
            {strategy && !strategy.isDone && (
                <span>{strategy.months} months left</span>
            )}
        </div>
      </div>
    </Card>
  )
}
