'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { useHousehold } from '@/components/HouseholdProvider'
import { format, differenceInMonths, isValid } from 'date-fns'
import { TrendingUp, History, Wallet, ChevronLeft, Calendar, CheckCircle2, Plus, ArrowRightLeft } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { GoalActionDrawer } from '@/components/goals/GoalActionDrawer'
import { Zap, Settings2 } from 'lucide-react'
import CategoryDrawer from '@/components/CategoryDrawer'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'

export default function GoalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { householdId } = useHousehold()
  
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false)
  const [actionType, setActionType] = useState<'deposit' | 'withdraw'>('deposit')
  const [suggestionAmount, setSuggestionAmount] = useState<number | undefined>(undefined)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  
  const goalId = params.id as Id<"categories">

  const data = useQuery(api.categories.getGoalDetails, { 
      id: goalId, 
      householdId: householdId ?? undefined 
  })

  const automation = useQuery(api.automations.getScheduleByGoal, {
      linkedEntityId: goalId,
      householdId: householdId ?? undefined
  })

  const toggleAutomation = useMutation(api.automations.toggleSchedule)

  const handleToggleAutoSave = async (checked: boolean) => {
      if (!automation) {
          setEditDrawerOpen(true);
          return;
      }
      try {
          await toggleAutomation({ id: automation._id, isEnabled: checked });
          toast.success(checked ? "Auto-Save enabled" : "Auto-Save disabled");
      } catch (error) {
          toast.error("Failed to update Auto-Save");
      }
  }

  const openAction = (type: 'deposit' | 'withdraw', amount?: number) => {
      setActionType(type)
      setSuggestionAmount(amount)
      setActionDrawerOpen(true)
  }

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

  const { category, currentAmount, history, pastCycles, currentBudget, thisMonthContribution, linkedAccountId } = data
  const targetAmount = category.targetAmount ? parseFloat(category.targetAmount.replace(/,/g, '')) : 0
  const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0
  const remaining = Math.max(0, targetAmount - currentAmount)

  // Monthly Budget Status
  const monthlyLimit = currentBudget ? parseFloat(currentBudget.amount.replace(/,/g, '') || '0') : 0;
  const isMonthlyMet = monthlyLimit > 0 && (thisMonthContribution || 0) >= monthlyLimit;

  // Source Account for automation display
  const automationSource = automation ? data.linkedAccountId && automation.fromAccountId === data.linkedAccountId ? "Another Account" : "Source Account" : null;

  // Strategy Calculation
  let strategyText = "Set a target date to get a strategy."
  let monthlyTarget = 0
  let monthsLeft = 0

  if (category.targetDate && targetAmount > 0 && remaining > 0) {
      const targetDate = new Date(category.targetDate)
      if (isValid(targetDate)) {
          const now = new Date()
          monthsLeft = differenceInMonths(targetDate, now)
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

  // Calculate Suggestion Gap & Contextual Strategy Text
  let gapSuggestion = 0;
  let customStrategyText = strategyText;

  if (monthlyLimit > 0) {
      const currentGap = Math.max(0, monthlyLimit - (thisMonthContribution || 0));
      gapSuggestion = currentGap;
      
      if (isMonthlyMet) {
          customStrategyText = "You've met your budget for this month! Any additional savings will speed up your goal.";
      } else {
          customStrategyText = `You need ${new Intl.NumberFormat().format(currentGap)} more this month to stay on track with your budget of ${new Intl.NumberFormat().format(monthlyLimit)}.`;
      }
  } else if (monthlyTarget > 0) {
      gapSuggestion = Math.ceil(monthlyTarget);
  }

  // --- Monthly Performance Logic ---
  // Group history by Month (YYYY-MM)
  const monthlyGroups = history.reduce((acc, tx) => {
      const date = new Date(tx.date);
      const key = format(date, 'yyyy-MM');
      const label = format(date, 'MMM yyyy');
      const amount = parseFloat(tx.amount.replace(/,/g, '') || '0');
      
      // Heuristic for direction based on description (consistent with list view)
      // Ideally backend sends this, but for now this works for visual consistency
      const isWithdraw = tx.description?.toLowerCase().includes('withdraw') || tx.description?.toLowerCase().includes('goal reached');
      
      if (!acc[key]) {
          acc[key] = { label, amount: 0, date: date };
      }
      
      if (isWithdraw) {
          acc[key].amount -= amount;
      } else {
          acc[key].amount += amount;
      }
      
      return acc;
  }, {} as Record<string, { label: string, amount: number, date: Date }>);

  // Convert to array and sort by date descending
  const monthlyPerformance = Object.values(monthlyGroups)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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

            {/* Quick Actions (Deposit/Withdraw) */}
            {linkedAccountId && (
                <div className="flex w-full gap-3 mt-2">
                    <Button 
                        className="flex-1 gap-2 h-12 text-base shadow-sm" 
                        onClick={() => openAction('deposit', gapSuggestion > 0 ? gapSuggestion : undefined)}
                    >
                        <Plus className="h-5 w-5" />
                        Add Funds
                    </Button>
                    <Button 
                        variant="outline" 
                        className="flex-1 gap-2 h-12 text-base"
                        onClick={() => openAction('withdraw')}
                    >
                        <ArrowRightLeft className="h-5 w-5" />
                        Withdraw
                    </Button>
                </div>
            )}
        </div>

        {/* 1.5. Auto-Save Status Card */}
        <div className={cn(
            "border rounded-xl p-5 flex flex-col gap-4 transition-all duration-300",
            automation?.isEnabled 
                ? "bg-primary/5 border-primary/20 shadow-sm" 
                : "bg-muted/30 border-dashed"
        )}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-lg",
                        automation?.isEnabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                        <Zap className="h-5 w-5 fill-current" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">Monthly Auto-Save</h4>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                            {automation?.isEnabled ? `Next: ${format(new Date(automation.nextRunAt), 'dd MMM')}` : "Paused or Not Set"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {automation && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => setEditDrawerOpen(true)}
                        >
                            <Settings2 className="h-4 w-4" />
                        </Button>
                    )}
                    <Switch 
                        checked={automation?.isEnabled || false} 
                        onCheckedChange={handleToggleAutoSave}
                    />
                </div>
            </div>

            {automation?.isEnabled ? (
                <div className="flex items-end justify-between pt-1 animate-in fade-in slide-in-from-bottom-2">
                    <div className="space-y-1">
                        <span className="text-2xl font-black text-primary">
                            Rp {new Intl.NumberFormat().format(parseFloat(automation.amount.replace(/,/g, '')))}
                        </span>
                        <p className="text-xs text-muted-foreground">
                            Automatically saved every month
                        </p>
                    </div>
                    {automation.lastRunStatus === 'failed' && (
                         <div className="flex items-center gap-1.5 text-destructive bg-destructive/10 px-2 py-1 rounded-md animate-pulse">
                            <span className="text-[10px] font-bold">LATEST RUN FAILED</span>
                         </div>
                    )}
                </div>
            ) : (
                <div className="py-2">
                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                        {automation 
                            ? "Auto-save is currently paused. Switch it on to resume automated saving." 
                            : "Set up automated monthly transfers to reach this goal faster without thinking about it."
                        }
                    </p>
                    {!automation && (
                        <Button 
                            variant="link" 
                            className="p-0 h-auto text-primary font-bold text-xs mt-2"
                            onClick={() => setEditDrawerOpen(true)}
                        >
                            Set Up Automation &rarr;
                        </Button>
                    )}
                </div>
            )}
        </div>

        {linkedAccountId && (
            <GoalActionDrawer 
                open={actionDrawerOpen} 
                onOpenChange={setActionDrawerOpen}
                goalName={category.name}
                goalAccountId={linkedAccountId}
                goalCategoryId={goalId}
                actionType={actionType}
                suggestionAmount={suggestionAmount}
            />
        )}

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
                            You&apos;ve contributed <strong>{new Intl.NumberFormat().format(thisMonthContribution || 0)}</strong> this month. Great job staying on track.
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
                            {customStrategyText}
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
                    {pastCycles.map((cycle) => (
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
                <h4 className="font-semibold text-base">Recent Activity</h4>
            </div>
            {history.length === 0 ? (
                <div className="text-center py-12 border rounded-xl border-dashed bg-muted/20">
                    <p className="text-muted-foreground">No transactions yet.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {history.map(tx => {
                        // Determine flow based on description logic or raw amounts if we had full tx object
                        // Since 'history' prop is simplified, we might lack raw account IDs.
                        // BUT, we know this is the Goal Page.
                        // Let's assume standard behavior:
                        // If description contains "Withdraw" or "Goal Reached", it's outgoing.
                        // OR better, let's fix backend to send accountId in history so we can compare with linkedAccountId.
                        
                        // Fallback Logic (Temporary until backend is perfect):
                        // Check if type is 'expense' (rare for goal) or transfer.
                        // Since we can't reliably know direction from simplified history object without accountId,
                        // I'll rely on a heuristic or we update backend again.
                        
                        // WAIT: 'getGoalDetails' backend sends a mapped object.
                        // Let's assume positive unless we prove otherwise.
                        // Actually, 'analyzeTransactionFlow' logic suggests Withdraw is 'Negative Spending' if not disbursement.
                        
                        // Let's update the visual to be safer:
                        // Check logic: Transaction Amount is stored as string.
                        // If we are looking at a Goal, usually transfers IN are positive.
                        // Transfers OUT (Withdraw) should be visualized as negative.
                        
                        // I will update the backend mapping for 'history' to include 'isOutgoing'.
                        // For now, let's use a heuristic based on description to fix the UI immediately.
                        const isWithdraw = tx.description?.toLowerCase().includes('withdraw') || tx.description?.toLowerCase().includes('goal reached');
                        const isNegative = isWithdraw;
                        
                        return (
                        <div key={tx._id} className="bg-card border rounded-lg p-4 flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", isNegative ? "bg-destructive/10" : "bg-success/10")}>
                                    <Wallet className={cn("h-5 w-5", isNegative ? "text-destructive" : "text-success")} />
                                </div>
                                <div>
                                    <p className="font-medium">{format(new Date(tx.date), 'dd MMMM yyyy')}</p>
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{tx.description || 'Transfer'}</p>
                                </div>
                            </div>
                            <span className={cn("font-semibold", isNegative ? "text-destructive" : "text-success")}>
                                {isNegative ? '-' : '+'}{new Intl.NumberFormat().format(parseFloat(tx.amount.replace(/,/g, '')))}
                            </span>
                        </div>
                    )})}
                </div>
            )}
        </div>
        
        <CategoryDrawer 
            open={editDrawerOpen}
            onOpenChange={setEditDrawerOpen}
            category={category}
        />
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
