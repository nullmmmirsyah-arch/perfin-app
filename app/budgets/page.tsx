'use client'

import { useState, useEffect } from 'react'
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
import { cn } from '@/lib/utils'
import { addMonths, subMonths, format } from 'date-fns'
import { toast } from 'sonner'
import { useHousehold } from '@/components/HouseholdProvider'
import { BudgetListSkeleton } from '@/components/skeletons'
import { calculateBudgetPace } from '@/lib/finance-utils'
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
} from "@/components/ui/alert-dialog"

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import { useRouter } from "next/navigation"

export default function BudgetsPage() {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Doc<'categories'> | undefined>(undefined)
  const [selectedAmount, setSelectedAmount] = useState<string | undefined>(undefined)
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  const router = useRouter()
  
  // Carousel State
  const [api, setApi] = useState<CarouselApi>()
  const [activeSection, setActiveSection] = useState<'expenses' | 'savings'>('expenses')

  // State for deletion confirmation
  const [budgetToDelete, setBudgetToDelete] = useState<{ id: Id<'budgets'>, name: string } | undefined>(undefined)

  const { householdId } = useHousehold()
  const budgetData = useQuery(convexApi.budgets.getBudgetStatus, {
    month: selectedDate.getMonth(),
    year: selectedDate.getFullYear(),
    householdId: householdId ?? undefined,
  })
  
  const budgetStatus = budgetData?.data
  const unassignedCash = budgetData?.unassignedCash ?? 0
  const hasLeftoverBudget = budgetData?.hasLeftoverBudget ?? false
  const breakdown = budgetData?.breakdown;

  const deleteBudget = useMutation(convexApi.budgets.deleteBudget)
  const sweepBudgets = useMutation(convexApi.budgets.sweepBudgets)

  useEffect(() => {
    if (!api) return
    api.on("select", () => {
        setActiveSection(api.selectedScrollSnap() === 0 ? 'expenses' : 'savings')
    })
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
      const now = new Date();
      let prevMonth = now.getMonth() - 1;
      let prevYear = now.getFullYear();
      if (prevMonth < 0) { prevMonth = 11; prevYear--; }

      const count = await sweepBudgets({ month: prevMonth, year: prevYear, householdId: householdId ?? undefined });
      if (count > 0) {
          toast.success(`Successfully swept ${count} unused budgets back to available cash.`);
      } else {
          toast.info("No unused budgets found to sweep.");
      }
  }

  const nextMonth = () => setSelectedDate(curr => addMonths(curr, 1))
  const prevMonth = () => setSelectedDate(curr => subMonths(curr, 1))

  const now = new Date();
  const isPastMonth = selectedDate.getFullYear() < now.getFullYear() || 
    (selectedDate.getFullYear() === now.getFullYear() && selectedDate.getMonth() < now.getMonth());

  // Calculate Days Remaining for Safe Spend Logic
  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const daysPassed = selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear() ? now.getDate() : (isPastMonth ? daysInMonth : 0);
  const daysRemaining = Math.max(1, daysInMonth - daysPassed + (selectedDate.getMonth() === now.getMonth() ? 1 : 0)); // Avoid division by zero

  // Split logic
  const savings = budgetStatus?.filter(item => item.category.type === 'saving') || []
  const expenses = budgetStatus?.filter(item => item.category.type === 'expense') || []

  const totalRemainingExpenses = expenses.reduce((acc, item) => {
      const limit = item.budget ? parseFloat(item.budget.amount) : 0;
      // Allow negative (overspending) to reduce the global total
      return acc + (limit - item.spent);
  }, 0);

  return (
    <div className="pb-24 p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">Manage your monthly spending limits by category.</p>
        </div>
        
        <div className="flex items-center gap-2">
           <div className="flex items-center border rounded-md bg-card">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                 <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="w-40 text-center font-medium">
                 {format(selectedDate, 'MMMM yyyy')}
              </div>
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                 <ChevronRight className="h-4 w-4" />
              </Button>
           </div>
           
           {!isPastMonth && (
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

      {hasLeftoverBudget && !isPastMonth && (
        <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/10 text-primary flex justify-between items-center">
            <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                    <h4 className="font-semibold text-sm">Unused funds from last month detected!</h4>
                    <p className="text-xs text-primary/80">Sweep it to increase available cash.</p>
                </div>
            </div>
            <Button size="sm" onClick={handleSweep} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Sweep
            </Button>
        </div>
      )}

      <BudgetDrawer
        open={open}
        onOpenChange={setOpen}
        defaultCategory={selectedCategory}
        currentAmount={selectedAmount}
        year={selectedDate.getFullYear()}
        month={selectedDate.getMonth()}
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
                            <div className="bg-card border rounded-xl p-4 shadow-sm">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Monthly Budget</p>
                                        <div className="flex items-baseline gap-2 mt-1">
                                            <span className="text-2xl font-bold">{totalRemainingExpenses.toLocaleString()}</span>
                                            <span className="text-sm text-muted-foreground">left</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">
                                            {expenses.reduce((acc, i) => acc + i.spent, 0).toLocaleString()} / {expenses.reduce((acc, i) => acc + (i.budget ? parseFloat(i.budget.amount) : 0), 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <Progress 
                                    value={(() => {
                                        const totalLimit = expenses.reduce((acc, i) => acc + (i.budget ? parseFloat(i.budget.amount) : 0), 0);
                                        const totalSpent = expenses.reduce((acc, i) => acc + i.spent, 0);
                                        return totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
                                    })()} 
                                    className="h-2"
                                />
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
                                            daysRemaining={daysRemaining}
                                            isPastMonth={isPastMonth}
                                            selectedDate={selectedDate}
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
                            {/* Savings Summary Card */}
                            <div className="bg-card border rounded-xl p-4 shadow-sm">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Saved (All Goals)</p>
                                        <div className="flex items-baseline gap-2 mt-1">
                                            <span className="text-2xl font-bold text-success">
                                                {savings.reduce((acc, i) => acc + i.accumulated, 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Target Total</p>
                                        <p className="text-sm font-medium">
                                            {savings.reduce((acc, i) => acc + (i.category.targetAmount ? parseFloat(i.category.targetAmount.replace(/,/g, '')) : 0), 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <Progress 
                                    value={(() => {
                                        const totalTarget = savings.reduce((acc, i) => acc + (i.category.targetAmount ? parseFloat(i.category.targetAmount.replace(/,/g, '')) : 0), 0);
                                        const totalSaved = savings.reduce((acc, i) => acc + i.accumulated, 0);
                                        return totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
                                    })()} 
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
                                            daysRemaining={daysRemaining}
                                            isPastMonth={isPastMonth}
                                            selectedDate={selectedDate}
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
