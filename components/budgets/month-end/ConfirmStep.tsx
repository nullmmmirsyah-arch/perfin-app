'use client'

import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface ConfirmStepProps {
  sweepCount: number
  rolloverCount: number
  totalSwept: number
  totalRollover: number
  isProcessing: boolean
  onConfirm: () => void
  onBack: () => void
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

export function ConfirmStep({
  sweepCount,
  rolloverCount,
  totalSwept,
  totalRollover,
  isProcessing,
  onConfirm,
  onBack
}: ConfirmStepProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-6"
    >
      {/* Summary */}
      <motion.div variants={fadeInUp} className="bg-card border rounded-xl p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
        <h3 className="text-lg font-bold mb-2">Ready to Process</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Review your month-end actions below
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-primary/5 rounded-lg p-3">
            <p className="text-2xl font-bold text-primary">{sweepCount}</p>
            <p className="text-xs text-muted-foreground">Categories to Sweep</p>
            {totalSwept > 0 && (
              <p className="text-xs text-primary mt-1">+{formatCurrency(totalSwept)}</p>
            )}
          </div>

          <div className="bg-success/5 rounded-lg p-3">
            <p className="text-2xl font-bold text-success">{rolloverCount}</p>
            <p className="text-xs text-muted-foreground">Categories to Roll Over</p>
            {totalRollover !== 0 && (
              <p className="text-xs text-success mt-1">
                {totalRollover > 0 ? '+' : ''}{formatCurrency(totalRollover)}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Testing Mode Notice */}
      <motion.div variants={fadeInUp} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
        <p className="text-xs text-yellow-600 font-medium">
          ⚠️ Testing Mode — No execution will be performed
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div variants={fadeInUp} className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="flex-1"
        >
          Back
        </Button>

        <Button
          onClick={onConfirm}
          disabled={isProcessing}
          className="flex-1"
        >
          {isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <>
              Confirm
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  )
}
