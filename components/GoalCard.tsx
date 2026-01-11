'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Doc } from '../convex/_generated/dataModel'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { calculateGoalStrategy } from '@/lib/finance-utils'
import { TrendingUp, CheckCircle2 } from 'lucide-react'

interface GoalCardProps {
  goal: Doc<'categories'> & { currentAmount?: number }
  isCompleted?: boolean
  onClick: () => void
}

export default function GoalCard({ goal, isCompleted = false, onClick }: GoalCardProps) {
  const targetAmount = goal.targetAmount ? parseFloat(goal.targetAmount.replace(/,/g, '')) : 0
  const currentAmount = goal.currentAmount || 0
  const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0
  
  // Strategy Insight
  const strategy = !isCompleted && targetAmount > 0 
    ? calculateGoalStrategy(currentAmount, targetAmount, goal.targetDate) 
    : null;

  return (
    <Card 
      className={cn(
        "p-4 space-y-4 cursor-pointer hover:shadow-md transition active:scale-[0.98] relative overflow-hidden", 
        isCompleted && "bg-muted/30 border-primary/20"
      )}
      onClick={onClick}
    >
      {/* Background Decorator for Investment */}
      {goal.goalType === 'investment' && !isCompleted && (
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-xl" />
      )}

      <div className="flex justify-between items-start relative z-10">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg leading-tight line-clamp-1">{goal.name}</h3>
          <p className="text-xs text-muted-foreground">
            {goal.targetDate ? `Target: ${format(new Date(goal.targetDate), 'MMM yyyy')}` : 'No deadline'}
          </p>
        </div>
        {isCompleted ? (
          <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full font-bold uppercase flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Done
          </span>
        ) : (
            strategy && strategy.monthly > 0 && (
                <div className="text-right">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Required</span>
                    <span className="text-xs font-bold text-primary flex items-center justify-end gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {new Intl.NumberFormat('en-US').format(Math.ceil(strategy.monthly))}/mo
                    </span>
                </div>
            )
        )}
      </div>

      <div className="space-y-2 relative z-10">
        <div className="flex justify-between text-sm items-end">
          <div className="flex flex-col">
             <span className="text-xs text-muted-foreground">Collected</span>
             <span className="font-medium text-foreground">
                {new Intl.NumberFormat().format(currentAmount)}
             </span>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-xs text-muted-foreground">Target</span>
             <span className="font-medium">
                {new Intl.NumberFormat().format(targetAmount)}
             </span>
          </div>
        </div>
        <Progress value={isCompleted ? 100 : progress} className={cn("h-2", isCompleted && "[&>div]:bg-success")} />
        
        {strategy && !strategy.isDone && (
            <p className="text-[10px] text-muted-foreground text-center pt-1">
                {Math.round(progress)}% done &bull; {strategy.months} months left
            </p>
        )}
      </div>
    </Card>
  )
}
