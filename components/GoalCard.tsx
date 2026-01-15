'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Doc } from '../convex/_generated/dataModel'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { calculateGoalStrategy } from '@/lib/finance-utils'
import { TrendingUp, CheckCircle2, MoreVertical, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface GoalCardProps {
  goal: Doc<'categories'> & { 
      currentAmount?: number, 
      currentBudget?: Doc<'budgets'>, 
      thisMonthContribution?: number 
  }
  isCompleted?: boolean
  onClick: () => void
  onEdit?: (goal: Doc<'categories'>) => void
}

export default function GoalCard({ goal, isCompleted = false, onClick, onEdit }: GoalCardProps) {
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
        <div className="space-y-1 pr-8">
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

        {/* Action Menu (Ellipsis) - Cleanly positioned top-right */}
        <div className="absolute top-1 right-0 z-20">
            <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.(goal as any);
                        }}
                        className="gap-2"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit Goal</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2 relative z-10">
        <div className="flex justify-between items-center text-sm">
          <div className="flex flex-col">
             <span className="text-xs text-muted-foreground">Collected</span>
             <span className={cn("font-bold", isCompleted ? "text-success" : "text-foreground")}>
                {new Intl.NumberFormat().format(displayCurrent)}
             </span>
          </div>

          {/* SMART PLACEMENT: Required /mo suggestion in the middle */}
          {!isCompleted && !isMonthlyMet && strategy && strategy.monthly > 0 && (
              <div className="flex flex-col items-center px-2 py-1 rounded-lg bg-primary/5 border border-primary/10 animate-in fade-in zoom-in-95 duration-500">
                  <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">Required</span>
                  <span className="text-[10px] font-black text-primary leading-none">
                      +{new Intl.NumberFormat('en-US', { notation: "compact" }).format(Math.ceil(strategy.monthly))}/mo
                  </span>
              </div>
          )}

          <div className="flex flex-col items-end">
             <span className="text-xs text-muted-foreground">Target</span>
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
