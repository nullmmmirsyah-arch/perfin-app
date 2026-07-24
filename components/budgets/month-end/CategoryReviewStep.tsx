'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { formatCurrency, cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle, XCircle, Wallet, Target } from 'lucide-react'

type CategoryHealth = {
  name: string
  spent: number
  budget: number
  status: 'on-track' | 'warning' | 'overspent'
  type: 'expense' | 'saving'
}

interface CategoryReviewStepProps {
  categories: CategoryHealth[]
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

const statusConfig = {
  'on-track': {
    icon: CheckCircle2,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
    expenseMessage: 'Great job!',
    savingMessage: 'On track!'
  },
  'warning': {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    expenseMessage: 'Getting close',
    savingMessage: 'Almost there!'
  },
  'overspent': {
    icon: XCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    expenseMessage: 'Over budget',
    savingMessage: 'Needs attention'
  }
}

export function CategoryReviewStep({ categories }: CategoryReviewStepProps) {
  const [activeTab, setActiveTab] = useState<'expense' | 'saving'>('expense')

  const expenses = categories.filter(c => c.type === 'expense')
  const savings = categories.filter(c => c.type === 'saving')

  const activeCategories = activeTab === 'expense' ? expenses : savings

  if (categories.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No categories to review</p>
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      className="space-y-4"
    >
      {/* Tab Switcher */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab('expense')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'expense'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Wallet className="h-4 w-4" />
          Expenses
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
            {expenses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('saving')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'saving'
              ? "bg-success/10 text-success"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Target className="h-4 w-4" />
          Goals
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
            {savings.length}
          </span>
        </button>
      </div>

      {/* Category Cards */}
      {activeCategories.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            No {activeTab === 'expense' ? 'expense' : 'savings'} categories
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeCategories.map((cat, idx) => {
            const config = statusConfig[cat.status]
            const Icon = config.icon
            const percentage = cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0
            const message = cat.type === 'saving' ? config.savingMessage : config.expenseMessage

            return (
              <motion.div
                key={cat.name}
                variants={fadeInUp}
                className={cn(
                  "border rounded-xl p-4",
                  config.bg,
                  config.border
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", config.color)} />
                    <span className="font-medium text-sm">{cat.name}</span>
                  </div>
                  <span className={cn("text-xs font-medium", config.color)}>
                    {message}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>
                    {cat.type === 'saving' ? 'Saved' : 'Spent'}: {formatCurrency(cat.spent)}
                  </span>
                  <span>Target: {formatCurrency(cat.budget)}</span>
                </div>

                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={cn(
                      "h-full rounded-full",
                      cat.status === 'on-track' && "bg-success",
                      cat.status === 'warning' && "bg-yellow-500",
                      cat.status === 'overspent' && "bg-destructive"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(percentage, 100)}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.05 }}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
