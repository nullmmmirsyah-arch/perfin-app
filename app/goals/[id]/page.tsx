'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { useHousehold } from '@/components/HouseholdProvider'
import { format, differenceInMonths, isValid } from 'date-fns'
import { TrendingUp, History, Wallet, ChevronLeft, Calendar } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'

export default function GoalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { householdId } = useHousehold()
  
  const goalId = params.id as Id<"categories">

  const data = useQuery(api.categories.getGoalDetails, { 
      id: goalId, 
      householdId: householdId ?? undefined 
  })

  if (data === undefined) {
      return <GoalDetailSkeleton />
  }

  if (!data || !data.category) {
      return (
          <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
              <p className="text-muted-foreground">Goal not found.</p>
              <Button onClick={() => router.back()}>Go Back</Button>
          </div>
      )
  }

  const { category, currentAmount, history, pastCycles } = data
  const targetAmount = category.targetAmount ? parseFloat(category.targetAmount.replace(/,/g, '')) : 0
  const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0
  const remaining = Math.max(0, targetAmount - currentAmount)

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
    <div className="pb-24 p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
                <h1 className="text-xl font-bold">{category.name}</h1>
                <p className="text-xs text-muted-foreground">
                    {category.targetDate ? `Due: ${format(new Date(category.targetDate), 'MMMM yyyy')}` : 'No deadline'}
                </p>
            </div>
        </div>

        {/* 1. Summary Card */}
        <div className="bg-card border rounded-xl p-8 shadow-sm flex flex-col items-center gap-6">
            <div className="relative h-48 w-48 flex items-center justify-center">
                {/* Simple CSS Ring Chart */}
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    {/* Background Circle */}
                    <path className="text-muted/20" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    {/* Progress Circle */}
                    <path 
                        className="text-primary transition-all duration-1000 ease-out" 
                        strokeDasharray={`${Math.min(progress, 100)}, 100`} 
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2.5" 
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-bold">{Math.round(progress)}%</span>
                </div>
            </div>
            
            <div className="text-center space-y-1">
                <p className="text-4xl font-bold tracking-tight text-primary">
                    {new Intl.NumberFormat().format(currentAmount)}
                </p>
                <p className="text-base text-muted-foreground">
                    of {new Intl.NumberFormat().format(targetAmount)}
                </p>
            </div>
        </div>

        {/* 2. Strategy / Insight */}
        {remaining > 0 && (
            <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-5 flex items-start gap-4">
                <div className="bg-blue-100 dark:bg-blue-800 p-2.5 rounded-full mt-0.5">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                    <h4 className="font-semibold text-base text-blue-900 dark:text-blue-100 mb-1">Monthly Pace</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-200 leading-relaxed">
                        {strategyText}
                    </p>
                </div>
            </div>
        )}

        {/* 3. Past Cycles (History) */}
        {pastCycles && pastCycles.length > 0 && (
            <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <h4 className="font-semibold text-base">History / Past Cycles</h4>
                </div>
                <div className="space-y-3">
                    {pastCycles.map((cycle: any) => (
                        <div key={cycle._id} className="bg-muted/30 border border-dashed rounded-lg p-4 flex justify-between items-center">
                            <div>
                                <p className="font-medium text-sm">Cycle Completed</p>
                                <p className="text-xs text-muted-foreground">
                                    {format(new Date(cycle.completedDate), 'dd MMMM yyyy')}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="font-semibold text-sm block">
                                    {new Intl.NumberFormat().format(cycle.finalAmount)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Target: {new Intl.NumberFormat().format(cycle.targetAmount)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* 4. Recent Transactions */}
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
                <History className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-semibold text-base">Recent Contributions</h4>
            </div>
            {history.length === 0 ? (
                <div className="text-center py-12 border rounded-xl border-dashed bg-muted/20">
                    <p className="text-muted-foreground">No transactions yet.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {history.map(tx => (
                        <div key={tx._id} className="bg-card border rounded-lg p-4 flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Wallet className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="font-medium">{format(new Date(tx.date), 'dd MMMM yyyy')}</p>
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{tx.description || 'Transfer'}</p>
                                </div>
                            </div>
                            <span className="font-semibold text-green-600">
                                +{new Intl.NumberFormat().format(parseFloat(tx.amount.replace(/,/g, '')))}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  )
}

function GoalDetailSkeleton() {
    return (
        <div className="pb-24 p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-24" />
                </div>
            </div>
            <Skeleton className="h-[300px] w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="space-y-4">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
            </div>
        </div>
    )
}
