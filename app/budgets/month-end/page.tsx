'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api as convexApi } from '../../../convex/_generated/api'
import { useHousehold } from '@/components/HouseholdProvider'
import { StepIndicator } from '@/components/budgets/month-end/StepIndicator'
import { MonthSummaryStep } from '@/components/budgets/month-end/MonthSummaryStep'
import { CategoryReviewStep } from '@/components/budgets/month-end/CategoryReviewStep'
import { InsightsStep } from '@/components/budgets/month-end/InsightsStep'
import { ConfirmStep } from '@/components/budgets/month-end/ConfirmStep'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { PartyPopper } from 'lucide-react'
import confetti from 'canvas-confetti'

type CategoryHealth = {
  name: string
  spent: number
  budget: number
  status: 'on-track' | 'warning' | 'overspent'
  type: 'expense' | 'saving'
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 100 : -100,
    opacity: 0
  })
}

export default function MonthEndPage() {
  const router = useRouter()
  const { householdId } = useHousehold()
  const [currentStep, setCurrentStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  // Calculate previous month for proposals and budget data
  const now = new Date()
  let prevMonth = now.getMonth() - 1
  let prevYear = now.getFullYear()
  if (prevMonth < 0) { prevMonth = 11; prevYear-- }

  const proposals = useQuery(convexApi.budgets.getMonthEndProposals, {
    householdId: householdId ?? undefined
  })

  const budgetData = useQuery(convexApi.budgets.getBudgetStatus, {
    month: prevMonth,
    year: prevYear,
    householdId: householdId ?? undefined
  })

  const totalSteps = 4

  // Calculate data from proposals
  // Use real proposals, or mock data for testing when empty
  const realSweeps = proposals?.filter(p => p.type === 'sweep') || []
  const realRollovers = proposals?.filter(p => p.type === 'rollover') || []

  // Mock data for testing (when proposals are empty)
  const mockSweeps = realSweeps.length === 0 ? [
    { type: 'sweep' as const, categoryId: 'mock1' as any, categoryName: 'Food & Dining', amount: 150000 },
    { type: 'sweep' as const, categoryId: 'mock2' as any, categoryName: 'Transport', amount: 75000 },
    { type: 'sweep' as const, categoryId: 'mock3' as any, categoryName: 'Entertainment', amount: 50000 },
  ] : []
  const mockRollovers = realRollovers.length === 0 ? [
    { type: 'rollover' as const, categoryId: 'mock4' as any, categoryName: 'Emergency Fund', amount: 200000 },
    { type: 'rollover' as const, categoryId: 'mock5' as any, categoryName: 'Vacation', amount: -50000 },
  ] : []

  const sweeps = realSweeps.length > 0 ? realSweeps : mockSweeps
  const rollovers = realRollovers.length > 0 ? realRollovers : mockRollovers
  const totalSwept = sweeps.reduce((acc, p) => acc + p.amount, 0)
  const totalRollover = rollovers.reduce((acc, p) => acc + p.amount, 0)

  // Calculate budget data for summary
  const totalSpent = budgetData?.data
    ?.filter(item => item.category.type === 'expense')
    .reduce((acc, item) => acc + item.spent, 0) || 0
  const totalSaved = budgetData?.data
    ?.filter(item => item.category.type === 'saving')
    .reduce((acc, item) => acc + item.spent, 0) || 0
  const totalBudget = budgetData?.data
    ?.filter(item => item.category.type === 'expense')
    .reduce((acc, item) => {
      const amount = parseFloat(item.budget?.amount?.replace(/,/g, '') || '0')
      return acc + amount
    }, 0) || 0
  const savingsRate = totalBudget > 0 ? (totalSaved / totalBudget) * 100 : 0
  const healthScore = Math.min(100, Math.max(0, Math.round(savingsRate + (totalSaved > 0 ? 20 : 0))))

  // Calculate category health
  const categoryHealth: CategoryHealth[] = budgetData?.data?.map(item => {
    const allocated = parseFloat(item.budget?.amount?.replace(/,/g, '') || '0')
    const carryover = parseFloat(item.budget?.carryoverAmount?.replace(/,/g, '') || '0')
    const swept = parseFloat(item.budget?.sweptAmount?.replace(/,/g, '') || '0')
    const spent = item.spent
    const isSaving = item.category.type === 'saving'

    // For expenses: effective budget includes carryover from previous months
    const effectiveBudget = isSaving ? allocated : allocated + carryover
    const percentage = effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : 0

    let status: 'on-track' | 'warning' | 'overspent'
    if (isSaving) {
      // Savings: more saved = better
      if (allocated === 0 && spent > 0) {
        // No budget set but actively saving — show as on-track
        status = 'on-track'
      } else if (percentage >= 100) {
        status = 'on-track' // Met or exceeded target
      } else if (percentage >= 80) {
        status = 'warning' // Close to target
      } else {
        status = 'overspent' // Under target (needs attention)
      }
    } else {
      // Expenses: less spent = better (considering carryover)
      if (percentage <= 80) {
        status = 'on-track'
      } else if (percentage <= 100) {
        status = 'warning'
      } else {
        status = 'overspent'
      }
    }

    return {
      name: item.category.name,
      spent,
      budget: effectiveBudget,
      status,
      type: item.category.type as 'expense' | 'saving'
    }
  }) || []

  // Calculate insights
  const tips = categoryHealth
    .filter(c => c.status === 'warning' || c.status === 'overspent')
    .map(c => {
      if (c.type === 'saving') {
        if (c.status === 'overspent') {
          return { text: `${c.name}: You've saved only`, amount: c.spent, suffix: `of ${c.budget} target. Try to save more next month!` }
        }
        return { text: `${c.name}: Almost there! You've saved`, amount: c.spent, suffix: `of ${c.budget} target.` }
      }
      if (c.status === 'overspent') {
        return { text: `${c.name}: Consider reducing spending by ${Math.round(((c.spent - c.budget) / c.budget) * 100)}% next month.`, amount: null, suffix: '' }
      }
      return { text: `${c.name}: You're close to the limit. Try to stay under`, amount: c.budget * 0.9, suffix: 'next month.' }
    })
    .slice(0, 3)

  const achievements = []
  const onTrackCount = categoryHealth.filter(c => c.status === 'on-track').length
  if (onTrackCount >= 3) {
    achievements.push({
      title: 'Budget Master',
      description: `${onTrackCount} categories on track!`,
      icon: 'award' as const
    })
  }
  if (totalSaved > 0) {
    achievements.push({
      title: 'Smart Saver',
      description: 'Saved',
      amount: totalSaved,
      suffix: 'this month',
      icon: 'star' as const
    })
  }
  if (onTrackCount === categoryHealth.length && categoryHealth.length > 0) {
    achievements.push({
      title: 'Perfect Streak',
      description: 'All categories on track!',
      icon: 'flame' as const
    })
  }

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setDirection(1)
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setDirection(-1)
      setCurrentStep(currentStep - 1)
    }
  }

  const handleConfirm = () => {
    setIsProcessing(true)

    // Testing mode — no execution
    setTimeout(() => {
      setIsProcessing(false)
      setIsComplete(true)

      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      })
    }, 1000)
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 max-w-md"
        >
          <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <PartyPopper className="h-10 w-10 text-primary" />
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-2">Month Complete!</h2>
            <p className="text-muted-foreground">
              You&apos;ve reviewed your month-end budget. Great job staying on top of your finances!
            </p>
          </div>

          <div className="bg-card border rounded-xl p-4 text-sm text-muted-foreground">
            ⚠️ Testing Mode — No changes were made
          </div>

          <Button onClick={() => router.push('/budgets')} className="w-full">
            Back to Budgets
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <StepIndicator
        currentStep={currentStep}
        totalSteps={totalSteps}
        onBack={prevStep}
        onClose={() => router.push('/budgets')}
        showBack={currentStep > 1}
      />

      <div className="max-w-lg mx-auto p-4">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            {currentStep === 1 && (
              <MonthSummaryStep
                totalSpent={totalSpent}
                totalSaved={totalSaved}
                savingsRate={savingsRate}
                healthScore={healthScore}
              />
            )}

            {currentStep === 2 && (
              <CategoryReviewStep categories={categoryHealth} />
            )}

            {currentStep === 3 && (
              <InsightsStep
                monthComparison={{
                  thisMonth: totalSpent,
                  lastMonth: totalSpent * 1.1
                }}
                tips={tips}
                achievements={achievements}
              />
            )}

            {currentStep === 4 && (
              <ConfirmStep
                sweepCount={sweeps.length}
                rolloverCount={rollovers.length}
                totalSwept={totalSwept}
                totalRollover={totalRollover}
                isProcessing={isProcessing}
                onConfirm={handleConfirm}
                onBack={prevStep}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        {currentStep < totalSteps && (
          <div className="mt-6">
            <Button onClick={nextStep} className="w-full">
              {currentStep === totalSteps - 1 ? 'Review & Confirm' : 'Continue'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
