'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Plus } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CategoryDrawer from '@/components/CategoryDrawer'
import GoalCard from '@/components/GoalCard'
import { Doc, Id } from '../../convex/_generated/dataModel'
import { useHousehold } from '@/components/HouseholdProvider'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export default function GoalsPage() {
  const [openCreate, setOpenCreate] = useState(false)
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

  const handleGoalClick = (id: Id<"categories">) => {
      router.push(`/goals/${id}`)
  }

  return (
    <div className="pb-24 p-4 md:p-8 space-y-6">
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

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="active">Active ({activeGoals.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedGoals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
            {goals === undefined ? (
                <div className="text-center py-8 text-muted-foreground">Loading goals...</div>
            ) : activeGoals.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl">
                    <p className="text-muted-foreground">No active goals. Start saving!</p>
                    <Button variant="link" onClick={() => setOpenCreate(true)}>Create Goal</Button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {activeGoals.map(goal => (
                        <GoalCard key={goal._id} goal={goal as any} onClick={() => handleGoalClick(goal._id)} />
                    ))}
                </div>
            )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
             {completedGoals.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">No completed goals yet.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {completedGoals.map(goal => (
                        <GoalCard key={goal._id} goal={goal as any} isCompleted onClick={() => handleGoalClick(goal._id)} />
                    ))}
                </div>
            )}
        </TabsContent>
      </Tabs>

      <CategoryDrawer 
        open={openCreate} 
        onOpenChange={setOpenCreate} 
        defaultType="saving"
      />
    </div>
  )
}
