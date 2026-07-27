'use client'

import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { Wallet, TrendingUp, PiggyBank, Heart } from '@/components/ui/icons'

interface MonthSummaryStepProps {
  totalSpent: number
  totalSaved: number
  savingsRate: number
  healthScore: number
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

export function MonthSummaryStep({ totalSpent, totalSaved, savingsRate, healthScore }: MonthSummaryStepProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-6"
    >
      {/* Health Score */}
      <motion.div variants={fadeInUp} className="flex justify-center">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              className="text-primary"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: healthScore / 100 }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-2xl font-bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {healthScore}
            </motion.span>
            <span className="text-[10px] text-muted-foreground">Health Score</span>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div variants={fadeInUp} className="bg-card border rounded-xl p-4 text-center">
          <Wallet className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-lg font-bold">{formatCurrency(totalSpent)}</p>
          <p className="text-[10px] text-muted-foreground">Total Spent</p>
        </motion.div>

        <motion.div variants={fadeInUp} className="bg-card border rounded-xl p-4 text-center">
          <PiggyBank className="h-5 w-5 text-success mx-auto mb-2" />
          <p className="text-lg font-bold text-success">{formatCurrency(totalSaved)}</p>
          <p className="text-[10px] text-muted-foreground">Total Saved</p>
        </motion.div>

        <motion.div variants={fadeInUp} className="bg-card border rounded-xl p-4 text-center">
          <TrendingUp className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-lg font-bold">{savingsRate.toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">Savings Rate</p>
        </motion.div>
      </div>

      {/* Motivational Message */}
      <motion.div variants={fadeInUp} className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
        <Heart className="h-5 w-5 text-primary mx-auto mb-2" />
        <p className="text-sm text-primary font-medium">
          {healthScore >= 80
            ? "Amazing month! You're crushing your goals!"
            : healthScore >= 60
              ? "Good progress! Keep up the momentum!"
              : "Every step counts. You're building better habits!"}
        </p>
      </motion.div>
    </motion.div>
  )
}
