'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { MoreHorizontal, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import BudgetDrawer from '@/components/BudgetDrawer'
import { Doc, Id } from '../../convex/_generated/dataModel'
import { cn } from '@/lib/utils'
import { addMonths, subMonths, format } from 'date-fns'
import { toast } from 'sonner'
import { useHousehold } from '@/components/HouseholdProvider'

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
  const budgetStatus = useQuery(api.budgets.getBudgetStatus, {
    month: selectedDate.getMonth(),
    year: selectedDate.getFullYear(),
    householdId: householdId ?? undefined,
  })
  const deleteBudget = useMutation(api.budgets.deleteBudget)

  const handleEdit = (category: Doc<'categories'>, amount?: string) => {
    setSelectedCategory(category)
    setSelectedAmount(amount)
    setOpen(true)
  }

  const handleAdd = () => {
    setSelectedCategory(undefined)
    setSelectedAmount(undefined)
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

  return (
    <div className="p-8 pb-24">
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
           
           <Button onClick={handleAdd}>
             <Plus className="mr-2 h-4 w-4" /> Set New Budget
           </Button>
        </div>
      </div>

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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {budgetStatus?.map(({ category, budget, spent, lastMonthStatus }) => {
          const limit = budget ? parseFloat(budget.amount) : 0
          const percentage = limit > 0 ? (spent / limit) * 100 : 0
          const isOverBudget = spent > limit && limit > 0
          
          let lastMonthBadge = null;
          if (lastMonthStatus) {
              const diff = lastMonthStatus.amount - lastMonthStatus.spent;
              const isSaved = diff >= 0;
              lastMonthBadge = (
                  <div className={cn(
                      "mt-3 pt-3 border-t flex items-center gap-2 text-xs",
                      isSaved ? "text-success" : "text-destructive"
                  )}>
                      {isSaved ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      <span className="font-medium">
                          Last Month: {isSaved ? "Saved" : "Over"} {Math.abs(diff).toLocaleString()}
                      </span>
                  </div>
              )
          }

          return (
            <Card key={category._id} className="p-6 flex flex-col justify-between shadow-sm">
              <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{category.name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">{category.type}</p>
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
                          {budget ? 'Edit Budget' : 'Set Budget'}
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
                  </div>
              </div>
              
              {lastMonthBadge}
            </Card>
          )
        })}
      </div>

      {budgetStatus?.length === 0 && (
        <div className="text-center py-12 border rounded-xl border-dashed bg-muted/20">
          <p className="text-muted-foreground">No expense categories found. Create some in Categories page first.</p>
        </div>
      )}
    </div>
  )
}