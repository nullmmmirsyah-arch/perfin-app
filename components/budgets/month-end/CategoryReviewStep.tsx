'use client'

import { motion } from 'framer-motion'
import { formatCurrency, cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle, XCircle, Wallet, Target } from '@/components/ui/icons'

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

function CategoryCard({ cat, idx }: { cat: CategoryHealth; idx: number }) {
  const config = statusConfig[cat.status]
  const Icon = config.icon
  const percentage = cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0
  const message = cat.type === 'saving' ? config.savingMessage : config.expenseMessage

  return (
    <motion.div
      variants={fadeInUp}
      className={cn("border rounded-xl p-3", config.bg, config.border)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-3.5 w-3.5", config.color)} />
          <span className="font-medium text-sm">{cat.name}</span>
        </div>
        <span className={cn("text-[10px] font-medium", config.color)}>
          {message}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
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
}

export function CategoryReviewStep({ categories }: CategoryReviewStepProps) {
  const expenses = categories.filter(c => c.type === 'expense')
  const savings = categories.filter(c => c.type === 'saving')

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
      variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
      className="space-y-5"
    >
      {/* Expenses Section */}
      {expenses.length > 0 && (
        <motion.div variants={fadeInUp} className="space-y-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-primary">Expenses</p>
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {expenses.length}
            </span>
          </div>
          <div className="space-y-2">
            {expenses.map((cat, idx) => (
              <CategoryCard key={cat.name} cat={cat} idx={idx} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Goals Section */}
      {savings.length > 0 && (
        <motion.div variants={fadeInUp} className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-success" />
            <p className="text-xs font-medium text-success">Goals</p>
            <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">
              {savings.length}
            </span>
          </div>
          <div className="space-y-2">
            {savings.map((cat, idx) => (
              <CategoryCard key={cat.name} cat={cat} idx={idx} />
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
