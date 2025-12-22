'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { MoreHorizontal, Plus, Edit2, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import BudgetDrawer from '@/components/BudgetDrawer'
import { Doc } from '../../convex/_generated/dataModel'
import { cn } from '@/lib/utils'

export default function BudgetsPage() {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Doc<'categories'> | undefined>(undefined)
  const [selectedAmount, setSelectedAmount] = useState<string | undefined>(undefined)

  const budgetStatus = useQuery(api.budgets.getBudgetStatus, {})
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

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">Manage your monthly spending limits by category.</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> Set New Budget
        </Button>
      </div>

      <BudgetDrawer
        open={open}
        onOpenChange={setOpen}
        defaultCategory={selectedCategory}
        currentAmount={selectedAmount}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {budgetStatus?.map(({ category, budget, spent }) => {
          const limit = budget ? parseFloat(budget.amount) : 0
          const percentage = limit > 0 ? (spent / limit) * 100 : 0
          const isOverBudget = spent > limit && limit > 0

          return (
            <div key={category._id} className="p-6 border rounded-xl bg-card shadow-sm">
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
                        onClick={() => deleteBudget({ id: budget._id })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove Budget
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
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
                    Set Monthly Limit
                  </Button>
                )}
              </div>
            </div>
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
