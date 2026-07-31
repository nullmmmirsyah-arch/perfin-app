'use client'

import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id, Doc } from '../../convex/_generated/dataModel'
import { useHousehold } from '@/components/HouseholdProvider'
import { getFiscalDateDetails } from '@/lib/finance-utils'
import { formatCurrency, parseAmount } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useRouter } from 'next/navigation'
import { GoalActionDrawer } from '@/components/goals/GoalActionDrawer'
import { useState } from 'react'
import { Sparkles, ShieldCheck, CalendarClock } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

type EnrichedGoal = Doc<'categories'> & {
  currentAmount: number
  currentBudget: Doc<'budgets'> | undefined
  thisMonthContribution: number
  linkedCategoryId?: Id<'accounts'>
}

type Props = {
  isPrivacyMode?: boolean
}

export function GoalsProgressCard({ isPrivacyMode }: Props) {
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

  if (activeGoals.length === 0) {
    return null
  }

  const totalSaved = activeGoals.reduce((acc, g) => acc + g.currentAmount, 0)

  const handleQuickSave = (goal: EnrichedGoal) => {
    if (goal.linkedCategoryId) {
      setSelectedGoal(goal)
      const monthlyLimit = goal.currentBudget ? parseAmount(goal.currentBudget.amount) : 0
      const monthlyContribution = goal.thisMonthContribution || 0
      const gapSuggestion = monthlyLimit > 0 ? Math.max(0, monthlyLimit - monthlyContribution) : 0
      setSuggestionAmount(gapSuggestion > 0 ? gapSuggestion : undefined)
      setActionDrawerOpen(true)
    }
  }

  return (
    <>
      <Card className="w-full">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                🎯 Goals
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalSaved, { isPrivacyMode })}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {activeGoals.map((goal, index) => {
              const targetAmount = parseAmount(goal.targetAmount)
              const hasOverallTarget = targetAmount > 0
              const overallPercentage = hasOverallTarget
                ? (goal.currentAmount / targetAmount) * 100
                : 0

              const monthlyLimit = goal.currentBudget ? parseAmount(goal.currentBudget.amount) : 0
              const hasMonthlyBudget = monthlyLimit > 0
              const monthlyPercentage = hasMonthlyBudget
                ? (goal.thisMonthContribution / monthlyLimit) * 100
                : 0

              const isOverallMet = hasOverallTarget && goal.currentAmount >= targetAmount
              const isMonthlyMet = hasMonthlyBudget && goal.thisMonthContribution >= monthlyLimit

              let typeIcon = Sparkles
              let typeColor = 'text-chart-1'
              if (goal.goalType === 'investment') { typeIcon = ShieldCheck; typeColor = 'text-chart-2' }
              else if (goal.goalType === 'bill') { typeIcon = CalendarClock; typeColor = 'text-chart-3' }

              const Icon = typeIcon

              return (
                <div key={goal._id}>
                  <div className="space-y-2.5">
                    {/* Header: Icon + Name + Status + Tabung button */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', typeColor)} />
                        <span className="text-sm font-semibold truncate">{goal.name}</span>
                        {isOverallMet ? (
                          <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium">
                            Done!
                          </span>
                        ) : isMonthlyMet ? (
                          <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium">
                            On Track
                          </span>
                        ) : hasMonthlyBudget || hasOverallTarget ? (
                          <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-medium">
                            Needs Attention
                          </span>
                        ) : null}
                      </div>
                      {goal.linkedCategoryId && !isOverallMet && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2 text-xs shrink-0"
                          onClick={() => handleQuickSave(goal)}
                        >
                          Tabung
                        </Button>
                      )}
                    </div>

                    {/* Overall Progress */}
                    {hasOverallTarget && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Overall</span>
                          <span className="text-[10px] font-medium tabular-nums">
                            {formatCurrency(goal.currentAmount, { isPrivacyMode })}
                            <span className="text-muted-foreground font-normal">
                              /{formatCurrency(targetAmount, { isPrivacyMode })}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, overallPercentage)} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                            {overallPercentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Monthly Progress */}
                    {hasMonthlyBudget && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Bulanan</span>
                          <span className="text-[10px] font-medium tabular-nums">
                            {formatCurrency(goal.thisMonthContribution, { isPrivacyMode })}
                            <span className="text-muted-foreground font-normal">
                              /{formatCurrency(monthlyLimit, { isPrivacyMode })}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, monthlyPercentage)} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                            {monthlyPercentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* No target set */}
                    {!hasOverallTarget && !hasMonthlyBudget && (
                      <p className="text-[10px] text-muted-foreground">
                        {formatCurrency(goal.currentAmount, { isPrivacyMode })} terkumpul
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  {index < activeGoals.length - 1 && (
                    <div className="border-b border-border/30 mt-3" />
                  )}
                </div>
              )
            })}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => router.push('/goals')}
          >
            Lihat Semua Goals →
          </Button>
        </CardContent>
      </Card>

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
