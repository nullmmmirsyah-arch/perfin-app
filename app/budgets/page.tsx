'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useQuery, useMutation } from 'convex/react'
import { api as convexApi } from '../../convex/_generated/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { MoreHorizontal, Edit2, Trash2, ChevronLeft, ChevronRight, CheckCircle2, Info, Target, Wallet, RefreshCw } from '@/components/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import BudgetDrawer from '@/components/BudgetDrawer'
import MoveFundsDrawer from '@/components/MoveFundsDrawer'
import { Doc, Id } from '../../convex/_generated/dataModel'
import { cn, formatCurrency } from '@/lib/utils'
import { addMonths, subMonths, format, differenceInCalendarDays } from 'date-fns'
import { toast } from 'sonner'
import { useHousehold } from '@/components/HouseholdProvider'
import { BudgetListSkeleton } from '@/components/skeletons'
import { calculateBudgetPace, calculateGoalStrategy, getFiscalDate, getFiscalDateDetails, getFiscalMonthRange, calculateFiscalDaysRemaining } from '@/lib/finance-utils'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import BudgetCard from '@/components/BudgetCard'
import AllocationProgressCard from '@/components/budgets/AllocationProgressCard'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { useRouter } from "next/navigation"

// ... existing imports

export default function BudgetsPage() {
  const [open, setOpen] = useState(false)
  const [moveFundsOpen, setMoveFundsOpen] = useState(false)
  
  // ... existing state ...
  const [selectedCategory, setSelectedCategory] = useState<Doc<'categories'> | undefined>(undefined)
  const [selectedAmount, setSelectedAmount] = useState<string | undefined>(undefined)
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  const router = useRouter()
  
  // Tab State
  const [activeSection, setActiveSection] = useState<'expenses' | 'savings'>('expenses')

  // State for deletion confirmation
  const [budgetToDelete, setBudgetToDelete] = useState<{ id: Id<'budgets'>, name: string } | undefined>(undefined)

  const { householdId, households } = useHousehold()
  const memberRole = useQuery(convexApi.households.getMemberRole,
    householdId ? { householdId } : "skip"
  )
  const isAdmin = !householdId || memberRole === "admin"
  const activeHousehold = households.find(h => h._id === householdId)
  const budgetStartDay = activeHousehold?.budgetStartDay || 1;

  // Helper to get the actual "Current Fiscal Month" based on Today
  const getCurrentFiscalDate = () => getFiscalDate(new Date(), budgetStartDay);

  const { year: fiscalYear, month: fiscalMonth } = getFiscalDateDetails(selectedDate.toISOString(), budgetStartDay);

  // Fiscal month Date for header display — derived from fiscal year/month, not selectedDate.
  // selectedDate is a raw calendar date used for navigation; the header must show the
  // fiscal period label (e.g., "December" for Dec 25 – Jan 24 when budgetStartDay=25).
  const fiscalDisplayDate = new Date(fiscalYear, fiscalMonth);
  const budgetData = useQuery(convexApi.budgets.getBudgetStatus, {
    month: fiscalMonth,
    year: fiscalYear,
    householdId: householdId ?? undefined,
  })

  // Calculate Fiscal Period for Display
  const period = getFiscalMonthRange(fiscalYear, fiscalMonth, budgetStartDay);
  const formattedPeriod = `${format(period.start, 'MMM d')} - ${format(period.end, 'MMM d')}`;

  // Check if viewed month is the "Current Active Period"
  const currentFiscalDate = getCurrentFiscalDate();
  const isCurrentPeriod = fiscalMonth === currentFiscalDate.getMonth() && 
                          fiscalYear === currentFiscalDate.getFullYear();
  const isPastMonth = new Date(fiscalYear, fiscalMonth) < new Date(currentFiscalDate.getFullYear(), currentFiscalDate.getMonth());

  const monthEndProposals = useQuery(convexApi.budgets.getMonthEndProposals, {
    householdId: householdId ?? undefined,
  })

  const budgetStatus = budgetData?.data
  const unassignedCash = budgetData?.unassignedCash ?? 0
  const breakdown = budgetData?.breakdown;

  const deleteBudget = useMutation(convexApi.budgets.deleteBudget)
  const latestSnapshot = useQuery(convexApi.monthEndSnapshots.getLatest, {
    householdId: householdId ?? undefined
  })
  const rollbackMonthEnd = useMutation(convexApi.monthEndSnapshots.rollback)
  const [showRollbackDialog, setShowRollbackDialog] = useState(false)
  const [isRollingBack, setIsRollingBack] = useState(false)

  const handleEdit = (category: Doc<'categories'>, amount?: string) => {
    setSelectedCategory(category)
    setSelectedAmount(amount)
    setOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (budgetToDelete) {
        await deleteBudget({ id: budgetToDelete.id });
        toast.success("Budget removed");
        setBudgetToDelete(undefined);
    }
  }

  const nextMonth = () => setSelectedDate(curr => addMonths(curr, 1))
  const prevMonth = () => setSelectedDate(curr => subMonths(curr, 1))

  const handleRollback = async () => {
    navigator.vibrate(10)
    setIsRollingBack(true)
    try {
      await rollbackMonthEnd({ householdId: householdId ?? undefined })
      toast.success('Month-end process undone')
      setShowRollbackDialog(false)
    } catch (error) {
      toast.error('Failed to undo: ' + (error as Error).message)
    } finally {
      setIsRollingBack(false)
    }
  }

  const calculatedDaysRemaining = (() => {
    if (isPastMonth) return 0;
    if (isCurrentPeriod) return calculateFiscalDaysRemaining(budgetStartDay);
    const { start: fsStart, end: fsEnd } = getFiscalMonthRange(fiscalYear, fiscalMonth, budgetStartDay);
    return differenceInCalendarDays(fsEnd, fsStart) + 1;
  })();

  const savings = budgetData?.data?.filter(item => item.category.type === 'saving') || []
  const expenses = budgetData?.data?.filter(item => item.category.type === 'expense') || []
  const budgetSummary = budgetData?.budgetSummary;

  // Calculate Monthly Savings Aggregate (Goals Focus)
  const savingsAggregate = savings.reduce((acc, item) => {
      const targetAmount = item.category.targetAmount ? parseFloat(item.category.targetAmount.replace(/,/g, '')) : 0;
      const strategy = calculateGoalStrategy(item.accumulated, targetAmount, item.category.targetDate, budgetStartDay);
      
      const manualBudget = item.budget ? parseFloat(item.budget.amount) : 0;
      let monthlyTarget = manualBudget > 0 ? manualBudget : (strategy?.monthly || 0);

      const monthlySaved = item.spent;

      // UX Tweak: If user has saved money but has no target, treat the target as the saved amount
      const effectiveTarget = (monthlyTarget === 0 && monthlySaved > 0) ? monthlySaved : monthlyTarget;

      return {
          totalTarget: acc.totalTarget + effectiveTarget,
          totalSaved: acc.totalSaved + monthlySaved
      };
  }, { totalTarget: 0, totalSaved: 0 });

  // Calculate previous period (the period being reviewed)
  let prevFiscalMonth = fiscalMonth - 1
  let prevFiscalYear = fiscalYear
  if (prevFiscalMonth < 0) { prevFiscalMonth = 11; prevFiscalYear-- }

  // Check if previous period has been processed (snapshot exists for previous period)
  const isPreviousPeriodProcessed = useMemo(() => {
    if (!latestSnapshot) return false
    return latestSnapshot.month === prevFiscalMonth && latestSnapshot.year === prevFiscalYear
  }, [latestSnapshot, prevFiscalMonth, prevFiscalYear])

  // Show Month-End Review only if previous period hasn't been processed yet
  const showMonthEndReview = useMemo(() => {
    if (!budgetData?.data || budgetData.data.length === 0) return false
    return !isPreviousPeriodProcessed
  }, [budgetData?.data, isPreviousPeriodProcessed])

  // Show Re-process button only if previous period has been processed
  const showReprocessButton = useMemo(() => {
    if (!budgetData?.data || budgetData.data.length === 0) return false
    return isPreviousPeriodProcessed
  }, [budgetData?.data, isPreviousPeriodProcessed])

  return (
    <div className="pb-24 p-4 md:p-8 overflow-x-hidden">
      {/* Mobile Header Layout */}
      <motion.div className="md:hidden mb-4 space-y-3" variants={fadeInUp} initial="hidden" animate="visible">
        {/* Row 1: Title */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Budgets</h1>
          {!isCurrentPeriod && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedDate(getCurrentFiscalDate())}
              className="h-8 text-xs px-2"
            >
              Jump to Current
            </Button>
          )}
        </div>

        {/* Row 2: Month Navigator + Unassigned */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center border rounded-md bg-card">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex flex-col items-center justify-center px-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium">{format(fiscalDisplayDate, 'MMM yyyy')}</span>
                {isCurrentPeriod && (
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" title="Current Active Period" />
                )}
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-[9px] text-muted-foreground cursor-help border-b border-dotted border-muted-foreground/50 leading-none pb-0.5">
                      {formattedPeriod}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This is your budget cycle.<br/>Change it in Household Settings.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>


        </div>
      </motion.div>

      {/* Allocation Progress Hero Card - Mobile */}
      {isAdmin && !isPastMonth && (
        <div className="mb-4 md:hidden">
          <AllocationProgressCard
            unassignedCash={unassignedCash}
            breakdown={breakdown}
            onMoveFunds={() => setMoveFundsOpen(true)}
            isAdmin={isAdmin}
            isPastMonth={isPastMonth}
          />
        </div>
      )}

      {/* Desktop Header Layout */}
      <div className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">Set spending limits for each category and track your progress.</p>
        </div>
        
        <div className="flex items-center gap-2">
           {!isCurrentPeriod && (
               <Button 
                 variant="outline" 
                 size="sm" 
                 onClick={() => setSelectedDate(getCurrentFiscalDate())}
                 className="h-9 text-xs px-2"
               >
                 Jump to Current
               </Button>
           )}

           <div className="flex items-center border rounded-md bg-card relative">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                 <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex flex-col items-center justify-center w-40">
                 <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{format(fiscalDisplayDate, 'MMMM yyyy')}</span>
                    {isCurrentPeriod && (
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" title="Current Active Period" />
                    )}
                 </div>
                 
                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="text-[10px] text-muted-foreground cursor-help border-b border-dotted border-muted-foreground/50 leading-none pb-0.5">
                                {formattedPeriod}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>This is your budget cycle.<br/>Change it in Household Settings.</p>
                        </TooltipContent>
                    </Tooltip>
                 </TooltipProvider>
              </div>
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                 <ChevronRight className="h-4 w-4" />
              </Button>
           </div>
           

        </div>
      </div>

      {/* Allocation Progress Hero Card - Desktop */}
      {isAdmin && !isPastMonth && (
        <div className="hidden md:block mb-6">
          <AllocationProgressCard
            unassignedCash={unassignedCash}
            breakdown={breakdown}
            onMoveFunds={() => setMoveFundsOpen(true)}
            isAdmin={isAdmin}
            isPastMonth={isPastMonth}
          />
        </div>
      )}

      {/* Month-End Review button - show only when user hasn't processed this period yet */}
      {showMonthEndReview && !isPastMonth && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="mb-6"
        >
          <button
            onClick={() => router.push('/budgets/month-end')}
            className="w-full p-3 rounded-xl border border-primary/20 bg-linear-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-primary">Month-End Review</p>
                  <p className="text-[10px] text-primary/70">
                    {monthEndProposals && monthEndProposals.length > 0
                      ? `${monthEndProposals.length} action${monthEndProposals.length > 1 ? 's' : ''} pending`
                      : 'Review your previous period performance'}
                  </p>
                </div>
              </div>
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        </motion.div>
      )}

      {/* Re-process button - only show when user has processed before but current period needs re-processing */}
      {showReprocessButton && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="mb-6"
        >
          <button
            onClick={() => router.push(`/budgets/month-end?reprocess=true&month=${fiscalMonth}&year=${fiscalYear}`)}
            className="w-full p-3 rounded-xl border border-amber-500/20 bg-linear-to-r from-amber-500/5 to-amber-500/10 hover:from-amber-500/10 hover:to-amber-500/15 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-amber-500">Re-process Rollover</p>
                  <p className="text-[10px] text-amber-500/70">
                    Transactions were added to a processed period. Update your rollover to reflect changes.
                  </p>
                </div>
              </div>
              <div className="h-7 w-7 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
          </button>
        </motion.div>
      )}

      {/* Rollback Banner — only show when viewing the processed period */}
      {latestSnapshot && latestSnapshot.month === fiscalMonth && latestSnapshot.year === fiscalYear && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded-lg mb-4">
          <p className="text-xs text-muted-foreground">
            ↩ Month-end processed for {latestSnapshot.month + 1}/{latestSnapshot.year}
          </p>
          <button
            onClick={() => setShowRollbackDialog(true)}
            className="text-xs text-destructive hover:text-destructive/80 font-medium"
          >
            Undo last process
          </button>
        </div>
      )}

      <BudgetDrawer
        open={open}
        onOpenChange={setOpen}
        defaultCategory={selectedCategory}
        currentAmount={selectedAmount}
        year={fiscalYear}
        month={fiscalMonth}
      />

      <MoveFundsDrawer
        open={moveFundsOpen}
        onOpenChange={setMoveFundsOpen}
        year={fiscalYear}
        month={fiscalMonth}
      />
      
      <AlertDialog open={!!budgetToDelete} onOpenChange={(open) => !open && setBudgetToDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Budget?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the budget for <strong>{budgetToDelete?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rollback Confirmation Dialog */}
      <AlertDialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo Month-End Process</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will reverse the last month-end process:</p>
              {latestSnapshot?.sweptBudgets && latestSnapshot.sweptBudgets.length > 0 && (
                <p className="text-sm">
                  • {latestSnapshot.sweptBudgets.length} categories will have swept amounts reset
                </p>
              )}
              {latestSnapshot?.rolledOverBudgets && latestSnapshot.rolledOverBudgets.length > 0 && (
                <p className="text-sm">
                  • {latestSnapshot.rolledOverBudgets.length} categories will have carryover amounts restored
                </p>
              )}
              {latestSnapshot?.insertedBudgets && latestSnapshot.insertedBudgets.length > 0 && (
                <p className="text-sm">
                  • {latestSnapshot.insertedBudgets.length} budgets created during rollover will be deleted
                </p>
              )}
              <p className="text-destructive font-medium text-sm pt-2">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={isRollingBack}
              className={cn(
                buttonVariants(),
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {isRollingBack ? 'Undoing...' : 'Undo Process'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ErrorBoundary>
      <div className="space-y-4 overflow-hidden">
        {budgetStatus === undefined ? (
          <BudgetListSkeleton />
        ) : (
          <>
            {/* Section Switcher / Header */}
            <div className="flex gap-4 border-b">
                <button
                    onClick={() => setActiveSection('expenses')}
                    className={cn(
                        "pb-2 px-1 text-sm font-medium transition-colors flex items-center gap-2",
                        activeSection === 'expenses' 
                            ? "border-b-2 border-primary text-primary" 
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Wallet className="h-4 w-4" />
                    Monthly Expenses
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
                        {expenses.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveSection('savings')}
                    className={cn(
                        "pb-2 px-1 text-sm font-medium transition-colors flex items-center gap-2",
                        activeSection === 'savings' 
                            ? "border-b-2 border-primary text-primary" 
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Target className="h-4 w-4" />
                    Savings & Goals
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
                        {savings.length}
                    </span>
                </button>
            </div>

            {/* Expenses Section */}
            {activeSection === 'expenses' && (
                <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="visible">
                    {/* Expenses Summary Card */}
                    <motion.div variants={fadeInUp} className="bg-card border rounded-xl p-5 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Wallet className="h-24 w-24 rotate-12" />
                        </div>
                        <div className="space-y-4 relative z-10">
                            <div>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1.5">Monthly Budget Left</p>
                                <div className="flex items-baseline gap-2">
                                    <span className={cn(
                                        "text-4xl font-black tracking-tighter",
                                        (budgetSummary?.totalRemaining ?? 0) < 0 ? "text-destructive" : "text-foreground"
                                    )}>
                                        {formatCurrency(budgetSummary?.totalRemaining ?? 0)}
                                    </span>
                                    <span className="text-sm text-muted-foreground font-medium">remaining</span>
                                </div>
                            </div>
                            <div className="space-y-2 pt-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                    <span className="text-muted-foreground">Spending Progress</span>
                                    <span className="text-foreground">{formatCurrency(budgetSummary?.totalSpent ?? 0)} / {formatCurrency(budgetSummary?.totalEffective ?? 0)}</span>
                                </div>
                                <Progress 
                                    value={(budgetSummary?.totalEffective ?? 0) > 0 ? ((budgetSummary?.totalSpent ?? 0) / (budgetSummary?.totalEffective ?? 0)) * 100 : 0} 
                                    className="h-2.5 bg-muted"
                                />
                                {(budgetSummary?.totalSwept ?? 0) > 0 && (
                                    <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground italic">
                                        <Info className="h-3 w-3" />
                                        <span>{formatCurrency(budgetSummary?.totalSwept ?? 0)} swept back to wallet</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{calculatedDaysRemaining} days left</span>
                                {(budgetSummary?.totalEffective ?? 0) > 0 && calculatedDaysRemaining > 0 && (
                                    <span>
                                        {formatCurrency((budgetSummary?.totalRemaining ?? 0) / calculatedDaysRemaining)}/day avg
                                    </span>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {expenses.length === 0 ? (
                        <EmptyState
                            icon={Wallet}
                            title="No expense budgets yet"
                            description="Create a budget to understand how much you can safely spend."
                            action={{ label: "Create a budget", onClick: () => setOpen(true) }}
                            variant="illustrated"
                        />
                    ) : (
                        <motion.div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pb-4" variants={staggerContainer} initial="hidden" animate="visible">
                            {expenses.map(item => (
                                <motion.div key={item.category._id} variants={fadeInUp} className="min-w-0">
                                    <BudgetCard 
                                        item={item}
                                        daysRemaining={calculatedDaysRemaining}
                                        isPastMonth={isPastMonth}
                                        selectedDate={selectedDate}
                                        budgetStartDay={budgetStartDay}
                                        isAdmin={isAdmin}
                                        onEdit={handleEdit}
                                        onDelete={(id, name) => setBudgetToDelete({ id, name })}
                                    />
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* Savings Section */}
            {activeSection === 'savings' && (
                <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="visible">
                    {/* Savings Summary Card */}
                    <motion.div variants={fadeInUp} className="bg-card border rounded-xl p-4 shadow-sm">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Monthly Saving Progress</p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-3xl font-black text-success tracking-tight">
                                        {formatCurrency(savingsAggregate.totalSaved)}
                                    </span>
                                    <span className="text-sm text-muted-foreground font-medium">saved</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Monthly Target</p>
                                <p className="text-sm font-bold text-foreground">
                                    {savingsAggregate.totalTarget > 0 
                                        ? formatCurrency(savingsAggregate.totalTarget)
                                        : "No target set"
                                    }
                                </p>
                            </div>
                        </div>
                        <Progress 
                            value={savingsAggregate.totalTarget > 0 ? (savingsAggregate.totalSaved / savingsAggregate.totalTarget) * 100 : (savingsAggregate.totalSaved > 0 ? 100 : 0)} 
                            className="h-2 bg-muted [&>div]:bg-success"
                        />
                    </motion.div>

                    {savings.length === 0 ? (
                        <EmptyState
                            icon={Target}
                            title="No savings goals yet"
                            description="Set a savings goal to track your progress toward financial targets."
                            variant="illustrated"
                            action={{ label: "Create a goal", onClick: () => router.push('/goals') }}
                        />
                    ) : (
                        <motion.div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pb-4" variants={staggerContainer} initial="hidden" animate="visible">
                            {savings.map(item => (
                                <motion.div key={item.category._id} variants={fadeInUp} className="min-w-0">
                                    <BudgetCard 
                                        item={item}
                                        daysRemaining={calculatedDaysRemaining}
                                        isPastMonth={isPastMonth}
                                        selectedDate={selectedDate}
                                        budgetStartDay={budgetStartDay}
                                        isAdmin={isAdmin}
                                        onEdit={handleEdit}
                                        onDelete={(id, name) => setBudgetToDelete({ id, name })}
                                        onClickGoal={(id) => router.push(`/goals/${id}`)}
                                    />
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </motion.div>
            )}
          </>
        )}
      </div>
      </ErrorBoundary>
    </div>
  )
}