'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Doc } from '../convex/_generated/dataModel'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface GoalCardProps {
  goal: Doc<'categories'> & { currentAmount?: number }
  isCompleted?: boolean
  onClick: () => void
}

export default function GoalCard({ goal, isCompleted = false, onClick }: GoalCardProps) {
  const targetAmount = goal.targetAmount ? parseFloat(goal.targetAmount.replace(/,/g, '')) : 0
  const currentAmount = goal.currentAmount || 0
  const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0
  
  return (
    <Card 
      className={cn(
        "p-4 space-y-4 cursor-pointer hover:shadow-md transition active:scale-[0.98]", 
        isCompleted && "bg-muted/30 border-primary/20"
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">{goal.name}</h3>
          <p className="text-xs text-muted-foreground">
            {goal.targetDate ? `Target: ${format(new Date(goal.targetDate), 'MMM yyyy')}` : 'No deadline'}
          </p>
        </div>
        {isCompleted && (
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-bold uppercase">
            Achieved
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress ({Math.round(progress)}%)</span>
          <span className="font-medium">
            {new Intl.NumberFormat().format(currentAmount)} / {new Intl.NumberFormat().format(targetAmount)}
          </span>
        </div>
        <Progress value={isCompleted ? 100 : progress} className={cn("h-2", isCompleted && "[&>div]:bg-success")} />
        <p className="text-[10px] text-primary text-right font-medium">Tap for details &rarr;</p>
      </div>
    </Card>
  )
}
