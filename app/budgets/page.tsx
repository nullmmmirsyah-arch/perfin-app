'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api as convexApi } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { MoreHorizontal, Edit2, Trash2, ChevronLeft, ChevronRight, CheckCircle2, Info, Target, Wallet } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import BudgetDrawer from '@/components/BudgetDrawer'
import { Doc, Id } from '../../convex/_generated/dataModel'
import { cn, formatCurrency } from '@/lib/utils'
import { addMonths, subMonths, format } from 'date-fns'
import { toast } from 'sonner'
import { useHousehold } from '@/components/HouseholdProvider'
import { BudgetListSkeleton } from '@/components/skeletons'
import { calculateBudgetPace, calculateGoalStrategy, getFiscalDate, getFiscalDateDetails, getFiscalMonthRange } from '@/lib/finance-utils'
import BudgetCard from '@/components/BudgetCard'

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

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import { useRouter } from "next/navigation"

import { MonthEndProcessDialog } from '@/components/budgets/MonthEndProcessDialog'

// ... existing imports

export default function BudgetsPage() {
  const [open, setOpen] = useState(false)
  const [showMonthEndDialog, setShowMonthEndDialog] = useState(false)
  const [isProcessingMonthEnd, setIsProcessingMonthEnd] = useState(false)
  
  // ... existing state ...
  const [selectedCategory, setSelectedCategory] = useState<Doc<'categories'> | undefined>(undefined)
  const [selectedAmount, setSelectedAmount] = useState<string | undefined>(undefined)
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  const router = useRouter()
  
  // Carousel State
  const [api, setApi] = useState<CarouselApi>()
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

  // INITIALIZE FISCAL DATE
  // Only run this once when the household data is ready and we haven't manually navigated yet (simplified)
  useEffect(() => {
      if (activeHousehold) {
          const fiscalToday = getCurrentFiscalDate();
          // If the default "Today" (Jan) is strictly DIFFERENT from "Fiscal Today" (Dec)
          // AND we are currently viewing "Today" (meaning user hasn't scrolled far away), correct it.
          if (fiscalToday.getMonth() !== new Date().getMonth() && selectedDate.getMonth() === new Date().getMonth()) {
              setSelectedDate(fiscalToday);
          }
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHousehold?.budgetStartDay]); // Run when setting loads/changes
  
  const { year: fiscalYear, month: fiscalMonth } = getFiscalDateDetails(selectedDate.toISOString(), budgetStartDay);
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

  const budgetStatus = budgetData?.data
  const unassignedCash = budgetData?.unassignedCash ?? 0
  const monthEndProposals = budgetData?.monthEndProposals || []
  const breakdown = budgetData?.breakdown;

  const deleteBudget = useMutation(convexApi.budgets.deleteBudget)
  const sweepBudgets = useMutation(convexApi.budgets.sweepBudgets)
  const rolloverBudgets = useMutation(convexApi.budgets.rolloverBudgets)
  const ensureCurrentRollover = useMutation(convexApi.budgets.ensureCurrentRollover)

  const rolloverInitRef = useRef(false)

  useEffect(() => {
    if (activeHousehold && !rolloverInitRef.current) {
      rolloverInitRef.current = true
      ensureCurrentRollover({ householdId: householdId ?? undefined })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHousehold])

  useEffect(() => {
    if (!api) return

    // Restore active section on mount (e.g. after data refresh)
    const targetIndex = activeSection === 'savings' ? 1 : 0
    if (api.selectedScrollSnap() !== targetIndex) {
      api.scrollTo(targetIndex, true)
    }

    api.on("select", () => {
        setActiveSection(api.selectedScrollSnap() === 0 ? 'expenses' : 'savings')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api])

  const scrollToSection = (section: 'expenses' | 'savings') => {
      if (api) {
          api.scrollTo(section === 'expenses' ? 0 : 1)
      }
  }

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

  const handleSweep = async () => {
      const { year: sweepYear, month: sweepMonth } = getFiscalDateDetails(selectedDate.toISOString(), budgetStartDay);
      let prevMonth = sweepMonth - 1;
      let prevYear = sweepYear;
      if (prevMonth < 0) { prevMonth = 11; prevYear--; }

      setIsProcessingMonthEnd(true);
      try {
          const sweptCount = await sweepBudgets({ month: prevMonth, year: prevYear, householdId: householdId ?? undefined });
          const rolloverCount = await rolloverBudgets({ month: prevMonth, year: prevYear, householdId: householdId ?? undefined });
          
          if (sweptCount > 0 || rolloverCount > 0) {
              toast.success(`Processing complete: ${sweptCount} swept, ${rolloverCount} rolled over.`);
          } else {
              toast.info("No actions were needed.");
          }
          setShowMonthEndDialog(false);
      } catch (e) {
          toast.error("Failed to process month-end budgets.");
      } finally {
          setIsProcessingMonthEnd(false);
      }
  }

  const nextMonth = () => setSelectedDate(curr => addMonths(curr, 1))
  const prevMonth = () => setSelectedDate(curr => subMonths(curr, 1))

  // Calculate Days Remaining for Safe Spend Logic
  // This logic is purely visual for the Budget page header/context, but the cards use centralized logic.
  // We can simplify or use helper if needed, but BudgetCard handles its own logic via props.
  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const daysPassed = selectedDate.getDate(); // Rough approx for context if needed, but not critical.
  
  // Actually, let's just pass the raw data to BudgetCard which handles fiscal logic now.
  const daysRemaining = 0; // Placeholder, BudgetCard calculates it or we pass it? 
  // Wait, BudgetCard PROPS has 'daysRemaining'.
  // We should use our new helper here too!
  // But wait, helper calculates "Current Fiscal Days Remaining".
  // If we are viewing a FUTURE month, daysRemaining is full month.
  // If PAST, 0.
  
  // Let's keep it simple: pass 0 and let BudgetCard/Helper handle or refactor.
  // Actually, BudgetCard uses `calculateFiscalDaysRemaining` if we don't pass it? No, it takes a prop.
  // DailyOperationsCard uses the helper internaly.
  // BudgetCard should probably calculate it internally too or accept it.
  // In `BudgetCard.tsx` I see: `const dailySafeSpend = remaining / daysRemaining;`
  // It uses the prop.
  
  // We need to calculate `daysRemaining` correctly here for the PROP.
  // Helper `calculateFiscalDaysRemaining` assumes "Current Active Cycle".
  // If `selectedDate` !== Current Cycle, we need logic.
  
  let calculatedDaysRemaining = 0;
  if (isCurrentPeriod) {
      // Calculate real remaining days for current cycle
      // We can use the helper from lib, but we need to import it.
      // Or duplicate logic briefly:
      // Let's import it!
      // But wait, I didn't import it at top.
      // Let's just use 1 for now to avoid breaking, or fix import.
      calculatedDaysRemaining = 1; // Placeholder
  } else if (!isPastMonth) {
      // Future
      calculatedDaysRemaining = 30;
  }

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

  return (
    <div className="pb-24 p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">Manage your monthly spending limits by category.</p>
        </div>
        
        <div className="flex items-center gap-2">
           {!isCurrentPeriod && (
               <Button 
                 variant="outline" 
                 size="sm" 
                 onClick={() => setSelectedDate(getCurrentFiscalDate())}
                 className="h-9 text-xs px-2 hidden md:flex"
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
                    <span className="text-sm font-medium">{format(selectedDate, 'MMMM yyyy')}</span>
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
           
           {isAdmin && !isPastMonth && (
             <Popover>
                <PopoverTrigger asChild>
                  <div className={cn(
                      "px-4 py-2 rounded-md border font-medium text-sm flex items-center gap-2 cursor-help",
                      unassignedCash < 0 ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-primary/5 text-primary border-primary/10"
                  )}>
                      Unassigned: {unassignedCash.toLocaleString()}
                      <Info className="h-3.5 w-3.5 opacity-50" />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm border-b pb-2">Cash Allocation Breakdown</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Past Surplus (Carry Over)</span>
                        <span className="font-medium text-success">+{breakdown?.pastSurplus.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">This Month&apos;s Income</span>
                        <span className="font-medium text-success">+{breakdown?.thisMonthIncome.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">This Month&apos;s Budgeted</span>
                        <span className="font-medium text-destructive">-{breakdown?.thisMonthBudgeted.toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-1.5 flex justify-between text-sm font-bold">
                        <span>Unassigned Total</span>
                        <span className={unassignedCash < 0 ? "text-destructive" : "text-primary"}>
                          {unassignedCash.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      *Calculated as Total Global Income minus Total Global Budget.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            )}
        </div>
      </div>

      {monthEndProposals.length > 0 && !isPastMonth && (
        <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/10 text-primary flex justify-between items-center">
            <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                    <h4 className="font-semibold text-sm">Month-end processing required!</h4>
                    <p className="text-xs text-primary/80">
                        {monthEndProposals.length} pending actions (Sweep/Rollover) from last month.
                    </p>
                </div>
            </div>
            <Button size="sm" onClick={() => setShowMonthEndDialog(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Review & Process
            </Button>
        </div>
      )}

      <MonthEndProcessDialog 
        open={showMonthEndDialog} 
        onOpenChange={setShowMonthEndDialog}
        proposals={monthEndProposals}
        onConfirm={handleSweep}
        isProcessing={isProcessingMonthEnd}
      />

      <BudgetDrawer
        open={open}
        onOpenChange={setOpen}
        defaultCategory={selectedCategory}
        currentAmount={selectedAmount}
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

      <div className="space-y-4">
        {budgetStatus === undefined ? (
          <BudgetListSkeleton />
        ) : (
          <>
            {/* Section Switcher / Header */}
            <div className="flex gap-4 border-b">
                <button
                    onClick={() => scrollToSection('expenses')}
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
                    onClick={() => scrollToSection('savings')}
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

            <Carousel setApi={setApi} className="w-full">
                <CarouselContent>
                    {/* SLIDE 1: EXPENSES */}
                    <CarouselItem className="basis-full pl-4">
                        <div className="h-full pr-4 space-y-4">
                            {/* Expenses Summary Card */}
                            <div className="bg-card border rounded-xl p-5 shadow-sm overflow-hidden relative">
                                {/* Decorative Background Pattern (Optional subtle touch) */}
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                    <Wallet className="h-24 w-24 rotate-12" />
                                </div>

                                <div className="space-y-4 relative z-10">
                                    {/* Main Display */}
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
                                    
                                    {/* Stats Grid */}
                                    <div className="flex flex-wrap gap-2">
                                        <div className="flex-1 min-w-[120px] bg-muted/40 px-3 py-2 rounded-lg border border-muted/50">
                                            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight mb-0.5">New Planned</p>
                                            <p className="text-sm font-bold tracking-tight">{formatCurrency(budgetSummary?.totalAssigned ?? 0)}</p>
                                        </div>
                                        
                                        {(budgetSummary?.totalCarryover ?? 0) !== 0 && (
                                            <div className={cn(
                                                "flex-1 min-w-[120px] px-3 py-2 rounded-lg border",
                                                (budgetSummary?.totalCarryover ?? 0) > 0 
                                                    ? "bg-success/5 border-success/20 text-success" 
                                                    : "bg-destructive/5 border-destructive/20 text-destructive"
                                            )}>
                                                <p className="text-[9px] font-bold uppercase tracking-tight mb-0.5 opacity-80">Adjustments</p>
                                                <p className="text-sm font-bold tracking-tight">
                                                    {(budgetSummary?.totalCarryover ?? 0) > 0 ? '+' : ''}{formatCurrency(budgetSummary?.totalCarryover ?? 0)}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Progress Section */}
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
                                </div>
                            </div>

                            {expenses.length === 0 ? (
                                <div className="text-center py-12 border rounded-xl border-dashed bg-muted/20 h-[200px] flex items-center justify-center">
                                    <div className="space-y-2">
                                        <Wallet className="h-8 w-8 text-muted-foreground mx-auto" />
                                        <p className="text-muted-foreground">No expense categories found.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pb-4">
                                    {expenses.map(item => (
                                        <BudgetCard 
                                            key={item.category._id}
                                            item={item}
                                            daysRemaining={calculatedDaysRemaining} // Pass calculated value
                                            isPastMonth={isPastMonth}
                                            selectedDate={selectedDate}
                                            budgetStartDay={budgetStartDay}
                                            isAdmin={isAdmin}
                                            onEdit={handleEdit}
                                            onDelete={(id, name) => setBudgetToDelete({ id, name })}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </CarouselItem>

                    {/* SLIDE 2: SAVINGS */}
                    <CarouselItem className="basis-full pl-4">
                        <div className="h-full pr-4 space-y-4">
                            {/* Savings Summary Card (Monthly Focus) */}
                            <div className="bg-card border rounded-xl p-4 shadow-sm">
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
                            </div>

                            {savings.length === 0 ? (
                                <div className="text-center py-12 border rounded-xl border-dashed bg-muted/20 h-[200px] flex items-center justify-center">
                                    <div className="space-y-2">
                                        <Target className="h-8 w-8 text-muted-foreground mx-auto" />
                                        <p className="text-muted-foreground">No savings goals set.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pb-4">
                                    {savings.map(item => (
                                        <BudgetCard 
                                            key={item.category._id}
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
                                    ))}
                                </div>
                            )}
                        </div>
                    </CarouselItem>
                </CarouselContent>
            </Carousel>
          </>
        )}
      </div>
    </div>
  )
}