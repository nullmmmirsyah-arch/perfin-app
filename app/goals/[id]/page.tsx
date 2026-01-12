'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { useHousehold } from '@/components/HouseholdProvider'
import { format, differenceInMonths, isValid } from 'date-fns'
import { TrendingUp, History, Wallet, ChevronLeft, Calendar, CheckCircle2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

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

  const { category, currentAmount, history, pastCycles, currentBudget, thisMonthContribution } = data
  const targetAmount = category.targetAmount ? parseFloat(category.targetAmount.replace(/,/g, '')) : 0
  const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0
  const remaining = Math.max(0, targetAmount - currentAmount)

  // Monthly Budget Status
  const monthlyLimit = currentBudget ? parseFloat(currentBudget.amount.replace(/,/g, '') || '0') : 0;
  const isMonthlyMet = monthlyLimit > 0 && (thisMonthContribution || 0) >= monthlyLimit;

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

  // --- Monthly Performance Logic ---
  // Group history by Month (YYYY-MM)
  const monthlyGroups = history.reduce((acc, tx) => {
      const date = new Date(tx.date);
      const key = format(date, 'yyyy-MM');
      const label = format(date, 'MMM yyyy');
      const amount = parseFloat(tx.amount.replace(/,/g, '') || '0');
      
      if (!acc[key]) {
          acc[key] = { label, amount: 0, date: date };
      }
      acc[key].amount += amount;
      return acc;
  }, {} as Record<string, { label: string, amount: number, date: Date }>);

  // Convert to array and sort by date descending
  const monthlyPerformance = Object.values(monthlyGroups)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 6); // Show last 6 active months

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
                        className={isMonthlyMet ? "text-success transition-all duration-1000 ease-out" : "text-primary transition-all duration-1000 ease-out"} 
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
                    {isMonthlyMet && <span className="text-sm text-success font-medium bg-success/10 px-2 py-0.5 rounded-full mt-2">On Track</span>}
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
        {remaining > 0 ? (
            isMonthlyMet ? (
                <div className="bg-success/10 border border-success/20 rounded-xl p-5 flex items-center gap-4">
                    <div className="bg-success/20 p-2.5 rounded-full">
                        <CheckCircle2 className="h-6 w-6 text-success" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-base text-success mb-1">Monthly Target Met!</h4>
                        <p className="text-sm text-success/80 leading-relaxed">
                            You've contributed <strong>{new Intl.NumberFormat().format(thisMonthContribution || 0)}</strong> this month. Great job staying on track.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-5 flex items-start gap-4">
                    <div className="bg-primary/10 p-2.5 rounded-full mt-0.5">
                        <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-base text-primary mb-1">Monthly Pace</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {strategyText}
                        </p>
                    </div>
                </div>
            )
        ) : null}

        {/* 3. Monthly Performance (New Section) */}
        {monthlyPerformance.length > 0 && (
            <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <h4 className="font-semibold text-base">Monthly Performance</h4>
                </div>
                <div className="space-y-3">
                    {monthlyPerformance.map((item) => {
                        // Calculate percentage against Monthly Target (Strategy)
                        // If no strategy target (e.g. goal achieved), assume 100% base for visual
                        const baseTarget = monthlyTarget > 0 ? monthlyTarget : (item.amount * 1.2); 
                        const pct = Math.min((item.amount / baseTarget) * 100, 100);
                        const isMet = monthlyTarget > 0 && item.amount >= monthlyTarget;

                        return (
                            <div key={item.label} className="flex flex-col gap-1.5">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-muted-foreground">{item.label}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={isMet ? "text-success font-bold" : "text-foreground font-semibold"}>
                                            +{new Intl.NumberFormat().format(item.amount)}
                                        </span>
                                        {isMet && <span className="text-[10px] bg-success/10 text-success px-1.5 rounded-full">Met</span>}
                                    </div>
                                </div>
                                {/* Bar Visual */}
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative">
                                    <div 
                                        className={cn("h-full rounded-full transition-all", isMet ? "bg-success" : "bg-primary")}
                                        style={{ width: `${pct}%` }}
                                    />
                                    {/* Target Line Marker (if valid target exists) */}
                                    {monthlyTarget > 0 && (
                                        <div 
                                            className="absolute top-0 bottom-0 w-0.5 bg-foreground/20 z-10" 
                                            style={{ left: `${Math.min((monthlyTarget / baseTarget) * 100, 100)}%` }} 
                                            title="Target"
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* 4. Past Cycles (History) */}
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
