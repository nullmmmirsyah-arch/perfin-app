'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { formatCurrency, cn } from '@/lib/utils'
import { CheckCircle2, ArrowRight, ArrowLeftRight, CircleArrowRight, CircleArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

type ProposalType = 'sweep' | 'rollover'

type ProposalItem = {
  type: ProposalType
  categoryId: string
  categoryName: string
  amount: number
}

interface ConfirmStepProps {
  proposals: ProposalItem[]
  isProcessing: boolean
  onConfirm: (result: { categoryId: string; type: ProposalType }[]) => void
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
  // Track which categories are selected and their overridden type
  const [items, setItems] = useState<Map<string, { selected: boolean; type: ProposalType }>>(
    new Map()
  )

  // Initialize from proposals
  useEffect(() => {
    const map = new Map<string, { selected: boolean; type: ProposalType }>()
    proposals.forEach(p => {
      map.set(String(p.categoryId), { selected: true, type: p.type })
    })
    setItems(map)
  }, [proposals])

  const toggleSelected = (categoryId: string) => {
    setItems(prev => {
      const newMap = new Map(prev)
      const item = newMap.get(categoryId)
      if (item) {
        newMap.set(categoryId, { ...item, selected: !item.selected })
      }
      return newMap
    })
  }

  const toggleType = (categoryId: string) => {
    setItems(prev => {
      const newMap = new Map(prev)
      const item = newMap.get(categoryId)
      if (item) {
        const newType: ProposalType = item.type === 'sweep' ? 'rollover' : 'sweep'
        newMap.set(categoryId, { ...item, type: newType })
      }
      return newMap
    })
  }

  // Build final list with overridden types
  const finalProposals = proposals.map(p => {
    const state = items.get(String(p.categoryId))
    return {
      ...p,
      selected: state?.selected ?? true,
      finalType: state?.type ?? p.type
    }
  })

  const selectedItems = finalProposals.filter(p => p.selected)
  const sweepItems = selectedItems.filter(p => p.finalType === 'sweep')
  const rolloverItems = selectedItems.filter(p => p.finalType === 'rollover')
  const totalSwept = sweepItems.reduce((acc, p) => acc + p.amount, 0)
  const totalRollover = rolloverItems.reduce((acc, p) => acc + p.amount, 0)

  const handleConfirm = () => {
    const result = selectedItems.map(p => ({
      categoryId: p.categoryId,
      type: p.finalType
    }))
    onConfirm(result)
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
        <h3 className="text-lg font-bold">Customize Actions</h3>
        <p className="text-xs text-muted-foreground">
          Toggle type or exclude categories
        </p>
      </motion.div>

      {/* Category List */}
      <motion.div variants={fadeInUp} className="space-y-2">
        {proposals.map((item) => {
          const state = items.get(String(item.categoryId)) || { selected: true, type: item.type }
          const isSweep = state.type === 'sweep'

          return (
            <motion.div
              key={String(item.categoryId)}
              variants={fadeInUp}
              className={cn(
                "p-3 rounded-xl border transition-all",
                state.selected
                  ? isSweep
                    ? "bg-primary/5 border-primary/20"
                    : "bg-success/5 border-success/20"
                  : "bg-muted/30 border-muted opacity-50"
              )}
            >
              {/* Top row: checkbox + name + amount */}
              <div
                onClick={() => toggleSelected(String(item.categoryId))}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-4 w-4 rounded border-2 flex items-center justify-center transition-colors",
                    state.selected
                      ? isSweep ? "bg-primary border-primary" : "bg-success border-success"
                      : "border-muted-foreground"
                  )}>
                    {state.selected && <CheckCircle2 className={cn(
                      "h-3 w-3",
                      isSweep ? "text-primary-foreground" : "text-success-foreground"
                    )} />}
                  </div>
                  <span className={cn("text-sm font-medium", !state.selected && "text-muted-foreground")}>
                    {item.categoryName}
                  </span>
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  state.selected
                    ? isSweep ? "text-primary" : "text-success"
                    : "text-muted-foreground"
                )}>
                  {item.amount > 0 ? '+' : ''}{formatCurrency(item.amount)}
                </span>
              </div>

              {/* Bottom row: type toggle */}
              {state.selected && (
                <div className="mt-2 pt-2 border-t border-dashed flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Action
                  </span>
                  <button
                    onClick={() => toggleType(String(item.categoryId))}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                      isSweep
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-success/10 text-success hover:bg-success/20"
                    )}
                  >
                    {isSweep ? (
                      <>
                        <CircleArrowRight className="h-3 w-3" />
                        Sweep to Unassigned
                      </>
                    ) : (
                      <>
                        <CircleArrowDown className="h-3 w-3" />
                        Roll Over to Next Month
                      </>
                    )}
                    <ArrowLeftRight className="h-3 w-3 ml-1 opacity-50" />
                  </button>
                </div>
              )}
            </motion.div>
          )
        })}
      </motion.div>

      {/* Summary */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
        <div className="bg-primary/5 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-primary">{sweepItems.length}</p>
          <p className="text-[10px] text-muted-foreground">Sweep</p>
          {totalSwept > 0 && (
            <p className="text-[10px] text-primary">+{formatCurrency(totalSwept)}</p>
          )}
        </div>
        <div className="bg-success/5 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-success">{rolloverItems.length}</p>
          <p className="text-[10px] text-muted-foreground">Rollover</p>
          {totalRollover !== 0 && (
            <p className={cn("text-[10px]", totalRollover >= 0 ? "text-success" : "text-destructive")}>
              {totalRollover > 0 ? '+' : ''}{formatCurrency(totalRollover)}
            </p>
          )}
        </div>
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
          disabled={isProcessing || selectedItems.length === 0}
          className="flex-1"
        >
          {isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <>
              Process {selectedItems.length} Categories
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  )
}
