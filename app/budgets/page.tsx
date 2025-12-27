'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { MoreHorizontal, Edit2, Trash2, ChevronLeft, ChevronRight, CheckCircle2, Info } from 'lucide-react'
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

export default function BudgetsPage() {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Doc<'categories'> | undefined>(undefined)
  const [selectedAmount, setSelectedAmount] = useState<string | undefined>(undefined)
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  // State for deletion confirmation
  const [budgetToDelete, setBudgetToDelete] = useState<{ id: Id<'budgets'>, name: string } | undefined>(undefined)

  const { householdId } = useHousehold()
  const budgetData = useQuery(api.budgets.getBudgetStatus, {
    month: selectedDate.getMonth(),
    year: selectedDate.getFullYear(),
    householdId: householdId ?? undefined,
  })
  
  const budgetStatus = budgetData?.data
  const unassignedCash = budgetData?.unassignedCash ?? 0
  const hasLeftoverBudget = budgetData?.hasLeftoverBudget ?? false
  const breakdown = budgetData?.breakdown;

  const deleteBudget = useMutation(api.budgets.deleteBudget)
  const sweepBudgets = useMutation(api.budgets.sweepBudgets)

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
      // Calculate previous month relative to NOW, not selectedDate
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

  return (
    <div className="pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
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
                     Current Unassigned Cash: {unassignedCash.toLocaleString()}
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
                    <p className="text-xs text-primary/80">You have leftover budget from last month. Sweep it to increase your available cash for this month.</p>
                </div>
            </div>
            <Button size="sm" onClick={handleSweep} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Sweep to Available Cash
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
              This will not delete any transactions, but you will lose the budget tracking for this month.
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

      <div className="mt-8">
        {budgetStatus === undefined ? (
          <BudgetListSkeleton />
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {budgetStatus.map(({ category, budget, spent, accumulated }) => {
                const isGoal = category.type === 'saving' && category.targetAmount;
                
                // Goal Logic
                // Fix: Remove commas before parsing to ensure correct number (e.g. "40,000,000" -> 40000000)
                const targetAmount = isGoal ? parseFloat(category.targetAmount!.replace(/,/g, '')) : 0;
                const goalPercentage = isGoal && targetAmount > 0 ? (accumulated / targetAmount) * 100 : 0;
                
                // Monthly Budget Logic
                const limit = budget ? parseFloat(budget.amount) : 0
                const percentage = limit > 0 ? (spent / limit) * 100 : 0
                const isOverBudget = spent > limit && limit > 0
                
                return (
                  <Card key={category._id} className="p-6 flex flex-col justify-between shadow-sm">
                    <div>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-lg">{category.name}</h3>
                            <p className="text-sm text-muted-foreground capitalize">
                                {isGoal ? 'Financial Goal' : category.type}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(category, budget?.amount)}>
                                <Edit2 className="mr-2 h-4 w-4" />
                                {isGoal ? 'Set Monthly Contribution' : (budget ? 'Edit Budget' : 'Set Budget')}
                              </DropdownMenuItem>
                                                  {budget && (
                                                    <DropdownMenuItem
                                                      className="text-destructive"
                                                      onClick={() => setBudgetToDelete({ id: budget._id, name: category.name })}
                                                    >
                                                      <Trash2 className="mr-2 h-4 w-4" />
                                                      Remove Budget
                                                    </DropdownMenuItem>
                                                  )}                      </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="space-y-4">
                          {/* Goal View */}
                          {isGoal ? (
                              <>
                                  <div className="flex justify-between text-sm">
                                      <span className="font-medium text-primary">
                                          {accumulated.toLocaleString()} <span className="text-muted-foreground font-normal">saved</span>
                                      </span>
                                      <span className="text-muted-foreground">
                                          of {targetAmount.toLocaleString()} goal
                                      </span>
                                  </div>
                                  <Progress 
                                      value={Math.min(goalPercentage, 100)} 
                                      className="h-2 bg-muted [&>div]:bg-success"
                                  />
                                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                                      <span>{Math.round(goalPercentage)}% Completed</span>
                                      {category.targetDate && (
                                          <span>Due: {format(new Date(category.targetDate), 'MMM yyyy')}</span>
                                      )}
                                  </div>
                                  
                                  {/* Monthly Contribution Context */}
                                  <div className="pt-2 border-t mt-2">
                                      <div className="flex justify-between text-xs">
                                          <span>Monthly Contribution:</span>
                                          <span className="font-medium">
                                              {spent.toLocaleString()} / {budget ? limit.toLocaleString() : 'No Limit'}
                                          </span>
                                      </div>
                                  </div>
                              </>
                          ) : (
                              /* Standard Expense View */
                              <>
                                  <div className="flex justify-between text-sm">
                                  <span className="font-medium">
                                      {spent.toLocaleString()} <span className="text-muted-foreground font-normal">spent</span>
                                  </span>
                                  <span className="text-muted-foreground">
                                      {budget ? `${limit.toLocaleString()} limit` : 'No limit set'}
                                  </span>
                                  </div>

                                  {budget && (
                                  <>
                                      <Progress 
                                      value={Math.min(percentage, 100)} 
                                      className={cn(
                                          "h-2",
                                          isOverBudget ? "bg-destructive/20 [&>div]:bg-destructive" : ""
                                      )}
                                      />
                                      <div className="flex justify-between items-center">
                                          <p className={cn(
                                              "text-xs font-medium",
                                              isOverBudget ? "text-destructive" : "text-muted-foreground"
                                          )}>
                                              {isOverBudget 
                                                  ? `${(spent - limit).toLocaleString()} over budget` 
                                                  : `${(limit - spent).toLocaleString()} remaining`
                                              }
                                          </p>
                                          <span className="text-xs text-muted-foreground">
                                              {Math.round(percentage)}%
                                          </span>
                                      </div>
                                  </>
                                  )}
                                  
                                  {!budget && (
                                  <Button 
                                      variant="outline" 
                                      className="w-full border-dashed"
                                      onClick={() => handleEdit(category)}
                                  >
                                      Set {format(selectedDate, 'MMM')} Limit
                                  </Button>
                                  )}
                              </>
                          )}
                        </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            {budgetStatus.length === 0 && (
              <div className="text-center py-12 border rounded-xl border-dashed bg-muted/20">
                <p className="text-muted-foreground">No expense categories found. Create some in Categories page first.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}