'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Plus, ChevronDown, ChevronRight, ShieldCheck, CalendarClock, Sparkles, CheckCircle2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CategoryDrawer from '@/components/CategoryDrawer'
import GoalCard from '@/components/GoalCard'
import { Doc, Id } from '../../convex/_generated/dataModel'
import { useHousehold } from '@/components/HouseholdProvider'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export default function GoalsPage() {
  const [openCreate, setOpenCreate] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const { householdId } = useHousehold()
  const router = useRouter()
  
  // Fetch ALL saving categories (including archived/achieved)
  const goals = useQuery(api.categories.get, { 
      type: 'saving', 
      householdId: householdId ?? undefined,
      showArchived: true 
  })

  // Separate Active vs Completed
  const activeGoals = goals?.filter(g => !g.isArchived && g.status !== 'achieved') || []
  const completedGoals = goals?.filter(g => g.status === 'achieved') || []

  // Group Active Goals
  const investments = activeGoals.filter(g => g.goalType === 'investment');
  const bills = activeGoals.filter(g => g.goalType === 'bill');
  const purchases = activeGoals.filter(g => !g.goalType || g.goalType === 'purchase'); // Default to purchase

  const handleGoalClick = (id: Id<"categories">) => {
      router.push(`/goals/${id}`)
  }

  const SectionHeader = ({ title, icon: Icon, count, className }: { title: string, icon: any, count: number, className?: string }) => (
      <div className={cn("flex items-center gap-2 mb-3 pb-2 border-b", className)}>
          <div className="p-1.5 rounded-md bg-muted">
            <Icon className="h-4 w-4 text-foreground" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <span className="text-xs text-muted-foreground ml-auto bg-muted px-2 py-0.5 rounded-full font-medium">{count}</span>
      </div>
  );

  return (
    <div className="pb-24 p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold">Goals</h1>
          <p className="text-muted-foreground">Track your savings targets.</p>
        </div>
        <Button onClick={() => setOpenCreate(true)} className="gap-2 shadow-sm shrink-0">
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
                <SectionHeader title="Security & Growth" icon={ShieldCheck} count={investments.length} className="text-blue-600 dark:text-blue-400" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {investments.map(goal => (
                        <GoalCard key={goal._id} goal={goal as any} onClick={() => handleGoalClick(goal._id)} />
                    ))}
                    {investments.length === 0 && (
                        <div className="col-span-full py-6 text-center border rounded-lg border-dashed bg-blue-50/30 dark:bg-blue-900/10">
                            <p className="text-sm text-muted-foreground">No investment goals yet. Start building wealth!</p>
                        </div>
                    )}
                </div>
            </section>

            {/* 2. BILLS (SINKING FUNDS) */}
            <section>
                <SectionHeader title="Upcoming Obligations" icon={CalendarClock} count={bills.length} className="text-amber-600 dark:text-amber-400" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {bills.map(goal => (
                        <GoalCard key={goal._id} goal={goal as any} onClick={() => handleGoalClick(goal._id)} />
                    ))}
                    {bills.length === 0 && (
                        <div className="col-span-full py-6 text-center border rounded-lg border-dashed bg-amber-50/30 dark:bg-amber-900/10">
                            <p className="text-sm text-muted-foreground">No sinking funds. Use this for recurring bills like Tax or Insurance.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* 3. WISHLIST (PURCHASES) */}
            <section>
                <SectionHeader title="Wishlist" icon={Sparkles} count={purchases.length} className="text-purple-600 dark:text-purple-400" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {purchases.map(goal => (
                        <GoalCard key={goal._id} goal={goal as any} onClick={() => handleGoalClick(goal._id)} />
                    ))}
                    {purchases.length === 0 && (
                        <div className="col-span-full py-6 text-center border rounded-lg border-dashed bg-purple-50/30 dark:bg-purple-900/10">
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
                                <GoalCard key={goal._id} goal={goal as any} isCompleted onClick={() => handleGoalClick(goal._id)} />
                            ))}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}
          </>
      )}

      <CategoryDrawer 
        open={openCreate} 
        onOpenChange={setOpenCreate} 
        defaultType="saving"
      />
    </div>
  )
}
