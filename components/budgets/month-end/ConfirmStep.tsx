'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { formatCurrency, cn } from '@/lib/utils'
import { CheckCircle2, ArrowRight, ArrowLeftRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

type ProposalItem = {
  type: 'sweep' | 'rollover'
  categoryId: string
  categoryName: string
  amount: number
}

interface ConfirmStepProps {
  proposals: ProposalItem[]
  isProcessing: boolean
  onConfirm: (selectedIds: string[]) => void
  onBack: () => void
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

export function ConfirmStep({
  proposals,
  isProcessing,
  onConfirm,
  onBack
}: ConfirmStepProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(proposals.map(p => String(p.categoryId)))
  )
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set())

  // Reset when proposals change
  useEffect(() => {
    setSelectedItems(new Set(proposals.map(p => String(p.categoryId))))
    setExcludedItems(new Set())
  }, [proposals])

  const toggleItem = (categoryId: string) => {
    const newSelected = new Set(selectedItems)
    const newExcluded = new Set(excludedItems)

    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId)
      newExcluded.add(categoryId)
    } else {
      newSelected.add(categoryId)
      newExcluded.delete(categoryId)
    }

    setSelectedItems(newSelected)
    setExcludedItems(newExcluded)
  }

  const selectedProposals = proposals.filter(p => selectedItems.has(String(p.categoryId)))
  const selectedSweeps = selectedProposals.filter(p => p.type === 'sweep')
  const selectedRollovers = selectedProposals.filter(p => p.type === 'rollover')
  const totalSwept = selectedSweeps.reduce((acc, p) => acc + p.amount, 0)
  const totalRollover = selectedRollovers.reduce((acc, p) => acc + p.amount, 0)

  const handleConfirm = () => {
    const selectedIds = selectedProposals.map(p => p.categoryId)
    onConfirm(selectedIds)
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      className="space-y-4"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="text-center">
        <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-2" />
        <h3 className="text-lg font-bold">Select Categories to Process</h3>
        <p className="text-xs text-muted-foreground">
          Tap to include or exclude categories
        </p>
      </motion.div>

      {/* Sweep Section */}
      {selectedSweeps.length > 0 && (
        <motion.div variants={fadeInUp} className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-primary">Sweep to Unassigned</p>
            <p className="text-xs text-primary font-medium">+{formatCurrency(totalSwept)}</p>
          </div>

          <div className="space-y-1">
            {proposals.filter(p => p.type === 'sweep').map((item) => {
              const isSelected = selectedItems.has(String(item.categoryId))

              return (
                <motion.div
                  key={String(item.categoryId)}
                  variants={fadeInUp}
                  onClick={() => toggleItem(String(item.categoryId))}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                    isSelected
                      ? "bg-primary/5 border-primary/20"
                      : "bg-muted/30 border-muted opacity-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-4 w-4 rounded border-2 flex items-center justify-center",
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                    )}>
                      {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className="text-sm">{item.categoryName}</span>
                  </div>
                  <span className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}>
                    +{formatCurrency(item.amount)}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Rollover Section */}
      {selectedRollovers.length > 0 && (
        <motion.div variants={fadeInUp} className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-success">Roll Over</p>
            <p className={cn(
              "text-xs font-medium",
              totalRollover >= 0 ? "text-success" : "text-destructive"
            )}>
              {totalRollover > 0 ? '+' : ''}{formatCurrency(totalRollover)}
            </p>
          </div>

          <div className="space-y-1">
            {proposals.filter(p => p.type === 'rollover').map((item) => {
              const isSelected = selectedItems.has(String(item.categoryId))

              return (
                <motion.div
                  key={String(item.categoryId)}
                  variants={fadeInUp}
                  onClick={() => toggleItem(String(item.categoryId))}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                    isSelected
                      ? "bg-success/5 border-success/20"
                      : "bg-muted/30 border-muted opacity-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-4 w-4 rounded border-2 flex items-center justify-center",
                      isSelected ? "bg-success border-success" : "border-muted-foreground"
                    )}>
                      {isSelected && <CheckCircle2 className="h-3 w-3 text-success-foreground" />}
                    </div>
                    <span className="text-sm">{item.categoryName}</span>
                  </div>
                  <span className={cn(
                    "text-sm font-medium",
                    item.amount >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {item.amount > 0 ? '+' : ''}{formatCurrency(item.amount)}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Testing Mode Notice */}
      <motion.div variants={fadeInUp} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
        <p className="text-[10px] text-yellow-600 font-medium">
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
          onClick={handleConfirm}
          disabled={isProcessing || selectedProposals.length === 0}
          className="flex-1"
        >
          {isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <>
              Process {selectedProposals.length} Categories
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  )
}
