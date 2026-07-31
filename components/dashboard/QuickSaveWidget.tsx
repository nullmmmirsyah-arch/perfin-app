'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id, Doc } from '../../convex/_generated/dataModel'
import { useHousehold } from '@/components/HouseholdProvider'
import { getFiscalDateDetails } from '@/lib/finance-utils'
import { formatCurrency, parseAmount } from '@/lib/utils'
import { calculateGoalStrategy } from '@/lib/finance-utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useRouter } from 'next/navigation'
import { GoalActionDrawer } from '@/components/goals/GoalActionDrawer'
import { useState } from 'react'

type EnrichedGoal = Doc<'categories'> & {
  currentAmount: number
  currentBudget: Doc<'budgets'> | undefined
  thisMonthContribution: number
  linkedCategoryId?: Id<'accounts'>
}

export function QuickSaveWidget() {
  const { householdId, households } = useHousehold()
  const router = useRouter()

  const [actionDrawerOpen, setActionDrawerOpen] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<EnrichedGoal | undefined>(undefined)
  const [suggestionAmount, setSuggestionAmount] = useState<number | undefined>(undefined)

  const goals = useQuery(api.categories.get, {
    type: 'saving',
    householdId: householdId ?? undefined,
    showArchived: false
  })

  const activeHousehold = households.find(h => h._id === householdId)
  const budgetStartDay = activeHousehold?.budgetStartDay ?? 1
  const now = new Date()
  const { month, year } = getFiscalDateDetails(now.toISOString(), budgetStartDay)

  const budgetData = useQuery(api.budgets.getBudgetStatus, {
    month,
    year,
    householdId: householdId ?? undefined,
  })

  const accounts = useQuery(api.accounts.get, {
    householdId: householdId ?? undefined,
    showArchived: false,
  })

  const enrichedGoals: EnrichedGoal[] | undefined = goals?.map(g => {
    const status = budgetData?.data?.find(b => b.category._id === g._id)
    const linkedAccount = accounts?.find(a => a.linkedCategoryId === g._id)
    return {
      ...g,
      currentAmount: status?.accumulated || 0,
      currentBudget: status?.budget,
      thisMonthContribution: status?.spent || 0,
      linkedCategoryId: linkedAccount?._id
    }
  })

  const activeGoals = enrichedGoals?.filter(g => !g.isArchived && g.status !== 'achieved') || []

  const sortedGoals = activeGoals
    .map(goal => {
      const monthlyLimit = goal.currentBudget ? parseAmount(goal.currentBudget.amount) : 0
      const monthlyContribution = goal.thisMonthContribution || 0
      const targetAmount = parseAmount(goal.targetAmount)
      const globalTarget = targetAmount
      const globalCollected = goal.currentAmount || 0

      const strategy = globalTarget > 0
        ? calculateGoalStrategy(globalCollected, globalTarget, goal.targetDate)
        : null

      let gapSuggestion = 0
      if (monthlyLimit > 0) {
        gapSuggestion = Math.max(0, monthlyLimit - monthlyContribution)
      } else if (strategy && strategy.monthly > 0) {
        gapSuggestion = Math.ceil(strategy.monthly)
      }

      return { ...goal, gapSuggestion, strategy }
    })
    .sort((a, b) => b.gapSuggestion - a.gapSuggestion)
    .slice(0, 3)

  const handleQuickSave = (goal: EnrichedGoal) => {
    if (goal.linkedCategoryId) {
      setSelectedGoal(goal)
      setSuggestionAmount(goal.gapSuggestion > 0 ? goal.gapSuggestion : undefined)
      setActionDrawerOpen(true)
    }
  }

  if (activeGoals.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Belum ada goal. Mulai menabung untuk tujuan keuanganmu!</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push('/goals')}
          >
            + Buat Goal Pertama
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {sortedGoals.map(goal => {
          const targetAmount = parseAmount(goal.targetAmount)
          const progress = targetAmount > 0 ? (goal.currentAmount / targetAmount) * 100 : 0
          const monthlyLimit = goal.currentBudget ? parseAmount(goal.currentBudget.amount) : 0
          const isMonthlyMet = monthlyLimit > 0 && (goal.thisMonthContribution || 0) >= monthlyLimit

          return (
            <Card
              key={goal._id}
              className="p-3 cursor-pointer hover:shadow-md transition active:scale-[0.98]"
              onClick={() => router.push(`/goals/${goal._id}`)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm truncate">{goal.name}</h4>
                    {isMonthlyMet && (
                      <span className="text-[9px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium">
                        On Track
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {goal.gapSuggestion > 0
                      ? `Sisa: ${formatCurrency(goal.gapSuggestion)} untuk on-track`
                      : goal.strategy && goal.strategy.monthly > 0
                        ? `Target: ${formatCurrency(Math.ceil(goal.strategy.monthly))}/bulan`
                        : `${Math.round(progress)}% tercapai`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={progress} className="h-1.5 w-16" />
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleQuickSave(goal)
                    }}
                  >
                    Tabung
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => router.push('/goals')}
        >
          Lihat Semua Goals →
        </Button>
      </div>

      {selectedGoal && selectedGoal.linkedCategoryId && (
        <GoalActionDrawer
          open={actionDrawerOpen}
          onOpenChange={setActionDrawerOpen}
          goalName={selectedGoal.name}
          goalAccountId={selectedGoal.linkedCategoryId}
          goalCategoryId={selectedGoal._id}
          actionType="deposit"
          suggestionAmount={suggestionAmount}
        />
      )}
    </>
  )
}
