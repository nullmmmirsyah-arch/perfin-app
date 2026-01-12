'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Doc, Id } from '../../convex/_generated/dataModel'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useHousehold } from '@/components/HouseholdProvider'
import { format, differenceInMonths, isValid } from 'date-fns'
import { TrendingUp, Calendar, History, Wallet, CheckCircle2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

type GoalDetailDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalId: Id<"categories"> | null
}

export default function GoalDetailDrawer({ open, onOpenChange, goalId }: GoalDetailDrawerProps) {
  const { householdId } = useHousehold()
  
  const data = useQuery(api.categories.getGoalDetails, 
    goalId ? { id: goalId, householdId: householdId ?? undefined } : "skip"
  )

  if (!data || !data.category) return null

  const { category, currentAmount, history, currentBudget, thisMonthContribution } = data
  const targetAmount = category.targetAmount ? parseFloat(category.targetAmount.replace(/,/g, '')) : 0
  const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0
  const remaining = Math.max(0, targetAmount - currentAmount)

  // Monthly Budget Status
  const monthlyLimit = currentBudget ? parseFloat(currentBudget.amount.replace(/,/g, '') || '0') : 0;
  const isMonthlyMet = monthlyLimit > 0 && thisMonthContribution >= monthlyLimit;

  // Strategy Calculation
  let strategyText = "Set a target date to get a strategy."
  let monthlyTarget = 0
  let monthsLeft = 0

  if (category.targetDate && targetAmount > 0 && remaining > 0) {
      const targetDate = new Date(category.targetDate)
      if (isValid(targetDate)) {
          const now = new Date()
          monthsLeft = differenceInMonths(targetDate, now)
          
          // If less than 1 month (or past), treat as 1 month to avoid infinity
          const divisor = Math.max(1, monthsLeft) 
          monthlyTarget = remaining / divisor

          if (monthsLeft <= 0) {
              strategyText = "Target date has passed. Save as much as you can!"
          } else {
              strategyText = `Save ${new Intl.NumberFormat().format(Math.ceil(monthlyTarget))} / month to reach your goal on time.`
          }
      }
  } else if (remaining === 0) {
      strategyText = "Goal Achieved! Congratulations."
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] flex flex-col">
        <DrawerHeader>
          <DrawerTitle className="text-center text-xl">{category.name}</DrawerTitle>
          <div className="text-center text-sm text-muted-foreground">
            {category.targetDate ? `Due: ${format(new Date(category.targetDate), 'MMMM yyyy')}` : 'No deadline'}
          </div>
        </DrawerHeader>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* 1. Summary Card */}
            <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col items-center gap-4">
                <div className="relative h-32 w-32 flex items-center justify-center">
                    {/* Simple CSS Ring Chart */}
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                        {/* Background Circle */}
                        <path className="text-muted/20" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        {/* Progress Circle */}
                        <path 
                            className={isMonthlyMet ? "text-success transition-all duration-1000 ease-out" : "text-primary transition-all duration-1000 ease-out"} 
                            strokeDasharray={`${Math.min(progress, 100)}, 100`} 
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="3" 
                        />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                        <span className="text-2xl font-bold">{Math.round(progress)}%</span>
                        {isMonthlyMet && <span className="text-[10px] text-success font-medium bg-success/10 px-1.5 rounded-full mt-1">On Track</span>}
                    </div>
                </div>
                
                <div className="text-center space-y-1">
                    <p className="text-3xl font-bold tracking-tight">
                        {new Intl.NumberFormat().format(currentAmount)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        of {new Intl.NumberFormat().format(targetAmount)}
                    </p>
                </div>
            </div>

            {/* 2. Strategy / Insight */}
            {remaining > 0 ? (
                isMonthlyMet ? (
                    <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
                        <div className="bg-green-100 dark:bg-green-800 p-2 rounded-full">
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-300" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-green-900 dark:text-green-100">Monthly Target Met!</h4>
                            <p className="text-xs text-green-700 dark:text-green-200 leading-relaxed">
                                You've contributed <strong>{new Intl.NumberFormat().format(thisMonthContribution)}</strong> this month. Great job staying on track.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
                        <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-full mt-0.5">
                            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">Monthly Pace</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-200 leading-relaxed">
                                {strategyText}
                            </p>
                        </div>
                    </div>
                )
            ) : null}

            {/* 3. History */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm">Recent Contributions</h4>
                </div>
                {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>
                ) : (
                    <div className="space-y-3">
                        {history.map(tx => (
                            <div key={tx._id} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                        <Wallet className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{format(new Date(tx.date), 'dd MMM yyyy')}</p>
                                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{tx.description || 'Transfer'}</p>
                                    </div>
                                </div>
                                <span className="font-medium text-green-600">
                                    +{new Intl.NumberFormat().format(parseFloat(tx.amount.replace(/,/g, '')))}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        <DrawerFooter className="border-t bg-background pt-4 pb-safe">
            <DrawerClose asChild>
                <Button variant="outline" className="w-full">Close</Button>
            </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
