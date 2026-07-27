'use client'

import { motion } from 'framer-motion'
import { formatCurrency, cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Lightbulb, Award, Star, Flame } from '@/components/ui/icons'

interface InsightsStepProps {
  monthComparison: {
    thisMonth: number
    lastMonth: number
  }
  tips: {
    text: string
    amount: number | null
    suffix: string
  }[]
  achievements: {
    title: string
    description: string
    amount?: number
    suffix?: string
    icon: 'award' | 'star' | 'flame'
  }[]
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

const iconMap = {
  award: Award,
  star: Star,
  flame: Flame
}

export function InsightsStep({ monthComparison, tips, achievements }: InsightsStepProps) {
  const diff = monthComparison.thisMonth - monthComparison.lastMonth
  const isBetter = diff < 0

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-6"
    >
      {/* Month Comparison */}
      <motion.div variants={fadeInUp} className="bg-card border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          {isBetter ? (
            <TrendingDown className="h-4 w-4 text-success" />
          ) : (
            <TrendingUp className="h-4 w-4 text-destructive" />
          )}
          <span className="text-sm font-medium">Month Comparison</span>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold">{formatCurrency(monthComparison.thisMonth)}</p>
            <p className="text-[10px] text-muted-foreground">This Month</p>
          </div>

          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-medium",
            isBetter ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {isBetter ? '↓' : '↑'} {formatCurrency(Math.abs(diff))}
          </div>

          <div className="text-right">
            <p className="text-lg text-muted-foreground">{formatCurrency(monthComparison.lastMonth)}</p>
            <p className="text-[10px] text-muted-foreground">Last Month</p>
          </div>
        </div>
      </motion.div>

      {/* Tips */}
      {tips.length > 0 && (
        <motion.div variants={fadeInUp} className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">Spending Tips</span>
          </div>

          <div className="space-y-2">
            {tips.map((tip, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <span className="text-yellow-500 mt-0.5">•</span>
                <span>
                  {tip.text}
                  {tip.amount !== null && (
                    <span className="font-medium text-foreground"> {formatCurrency(tip.amount)}</span>
                  )}
                  {tip.suffix && ` ${tip.suffix}`}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <motion.div variants={fadeInUp} className="space-y-3">
          <p className="text-sm font-medium">Achievements</p>

          <div className="grid grid-cols-1 gap-3">
            {achievements.map((achievement, idx) => {
              const Icon = iconMap[achievement.icon]

              return (
                <motion.div
                  key={idx}
                  variants={fadeInUp}
                  className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{achievement.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {achievement.description}
                      {achievement.amount !== undefined && (
                        <span className="font-medium text-foreground"> {formatCurrency(achievement.amount)}</span>
                      )}
                      {achievement.suffix && ` ${achievement.suffix}`}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
