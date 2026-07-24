'use client'

import { motion } from 'framer-motion'
import { formatCurrency, cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

type CategoryHealth = {
  name: string
  spent: number
  budget: number
  status: 'on-track' | 'warning' | 'overspent'
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
    message: 'Great job!'
  },
  'warning': {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    message: 'Getting close'
  },
  'overspent': {
    icon: XCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    message: 'Over budget'
  }
}

export function CategoryReviewStep({ categories }: CategoryReviewStepProps) {
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
      className="space-y-3"
    >
      {categories.map((cat, idx) => {
        const config = statusConfig[cat.status]
        const Icon = config.icon
        const percentage = cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0

        return (
          <motion.div
            key={idx}
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
                {config.message}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Spent: {formatCurrency(cat.spent)}</span>
              <span>Budget: {formatCurrency(cat.budget)}</span>
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
    </motion.div>
  )
}
