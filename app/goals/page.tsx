'use client'

import React, { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Plus, ChevronDown, ChevronRight, ShieldCheck, CalendarClock, Sparkles, CheckCircle2 } from '@/components/ui/icons'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GoalWizardDrawer } from '@/components/GoalWizardDrawer'
import GoalCard from '@/components/GoalCard'
import { Doc, Id } from '../../convex/_generated/dataModel'
import { useHousehold } from '@/components/HouseholdProvider'
import { cn } from '@/lib/utils'
import { getFiscalDateDetails } from '@/lib/finance-utils'
import { useRouter } from 'next/navigation'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

type EnrichedGoal = Doc<'categories'> & {
  currentAmount: number
  currentBudget: Doc<'budgets'> | undefined
  thisMonthContribution: number
}

function SectionHeader({ title, icon: Icon, count, className }: { title: string, icon: React.ComponentType<{ className?: string }>, count: number, className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 mb-3 pb-2 border-b", className)}>
      <div className="p-1.5 rounded-md bg-muted">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <span className="text-xs text-muted-foreground ml-auto bg-muted px-2 py-0.5 rounded-full font-medium">{count}</span>
    </div>
  );
}

export default function GoalsPage() {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [goalToEdit, setGoalToEdit] = useState<Doc<'categories'> | undefined>(undefined)
  const [showCompleted, setShowCompleted] = useState(false)
  const { householdId, households } = useHousehold()
  const router = useRouter()
  
  // 1. Fetch Categories
  const goals = useQuery(api.categories.get, { 
      type: 'saving', 
      householdId: householdId ?? undefined,
      showArchived: true 
  })

  // 2. Fetch Budget Status (Contains Accumulated Amount Calculation)
  const activeHousehold = households.find(h => h._id === householdId);
  const budgetStartDay = activeHousehold?.budgetStartDay ?? 1;
  const now = new Date();
  const { month, year } = getFiscalDateDetails(now.toISOString(), budgetStartDay);
  const budgetData = useQuery(api.budgets.getBudgetStatus, {
      month,
      year,
      householdId: householdId ?? undefined,
  });

  // 3. Merge Data
  const enrichedGoals: EnrichedGoal[] | undefined = goals?.map(g => {
      const status = budgetData?.data?.find(b => b.category._id === g._id);
      return {
          ...g,
          currentAmount: status?.accumulated || 0,
          currentBudget: status?.budget,
          thisMonthContribution: status?.spent || 0
      };
  });

  // Separate Active vs Completed
  const activeGoals = enrichedGoals?.filter(g => !g.isArchived && g.status !== 'achieved') || []
  const completedGoals = enrichedGoals?.filter(g => g.status === 'achieved') || []

  // Group Active Goals
  const investments = activeGoals.filter(g => g.goalType === 'investment');
  const bills = activeGoals.filter(g => g.goalType === 'bill');
  const purchases = activeGoals.filter(g => !g.goalType || g.goalType === 'purchase');

  const handleGoalClick = (id: Id<"categories">) => {
      router.push(`/goals/${id}`)
  }

  const handleEditGoal = (category: Doc<'categories'>) => {
      setGoalToEdit(category)
      setWizardOpen(true)
  }

  const handleOpenChange = (open: boolean) => {
      setWizardOpen(open)
      if (!open) setGoalToEdit(undefined)
  }

  return (
    <div className="pb-24 p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold">Goals</h1>
          <p className="text-muted-foreground">Track your savings targets.</p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="gap-2 shadow-sm shrink-0">
            <Plus className="h-4 w-4" />
            Add Goal
        </Button>
      </div>

      {goals === undefined ? (
          <div className="text-center py-12 text-muted-foreground">Loading goals...</div>
      ) : (
          <>
            {/* 1. WEALTH & INVESTMENTS */}
            <section>
                <SectionHeader title="Security & Growth" icon={ShieldCheck} count={investments.length} className="text-chart-2" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {investments.map(goal => (
                        <GoalCard key={goal._id} goal={goal} onClick={() => handleGoalClick(goal._id)} onEdit={handleEditGoal} />
                    ))}
                    {investments.length === 0 && (
                        <div className="col-span-full py-6 text-center border rounded-lg border-dashed bg-chart-2/5">
                            <p className="text-sm text-muted-foreground">No investment goals yet. Start building wealth!</p>
                        </div>
                    )}
                </div>
            </section>

            {/* 2. BILLS (SINKING FUNDS) */}
            <section>
                <SectionHeader title="Upcoming Obligations" icon={CalendarClock} count={bills.length} className="text-chart-3" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {bills.map(goal => (
                        <GoalCard key={goal._id} goal={goal} onClick={() => handleGoalClick(goal._id)} onEdit={handleEditGoal} />
                    ))}
                    {bills.length === 0 && (
                        <div className="col-span-full py-6 text-center border rounded-lg border-dashed bg-chart-3/5">
                            <p className="text-sm text-muted-foreground">No sinking funds. Use this for recurring bills like Tax or Insurance.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* 3. WISHLIST (PURCHASES) */}
            <section>
                <SectionHeader title="Wishlist" icon={Sparkles} count={purchases.length} className="text-chart-1" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {purchases.map(goal => (
                        <GoalCard key={goal._id} goal={goal} onClick={() => handleGoalClick(goal._id)} onEdit={handleEditGoal} />
                    ))}
                    {purchases.length === 0 && (
                        <div className="col-span-full py-6 text-center border rounded-lg border-dashed bg-chart-1/5">
                            <p className="text-sm text-muted-foreground">No active wishlist items.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* 4. COMPLETED */}
            {completedGoals.length > 0 && (
                <Collapsible open={showCompleted} onOpenChange={setShowCompleted} className="space-y-2 pt-4 border-t">
                    <div className="flex items-center justify-between">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full flex justify-between p-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
                                <span className="flex items-center gap-2">
                                    {showCompleted ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    <CheckCircle2 className="h-4 w-4" />
                                    Completed Goals ({completedGoals.length})
                                </span>
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
                            {completedGoals.map(goal => (
                                <GoalCard key={goal._id} goal={goal} isCompleted onClick={() => handleGoalClick(goal._id)} onEdit={handleEditGoal} />
                            ))}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}
          </>
      )}

      <GoalWizardDrawer 
        open={wizardOpen} 
        onOpenChange={handleOpenChange}
        editGoal={goalToEdit}
      />
    </div>
  )
}
